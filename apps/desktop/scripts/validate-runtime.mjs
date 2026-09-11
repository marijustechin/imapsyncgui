#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyNativeDependency, parseOtoolDependencies } from './lib/native-deps.mjs'
import { executableNameFor, expectedBinaryArchFor, runtimeArchFromArgs } from './lib/runtime-arch.mjs'
import { assertPeX64 } from './lib/winpe.mjs'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')

function fail(message) {
  console.error(`validation failed: ${message}`)
  process.exit(1)
}

function checkDarwinDependencies(file, label) {
  const dependencies = parseOtoolDependencies(execFileSync('otool', ['-L', file], { encoding: 'utf8' }))
  for (const dependency of dependencies) {
    const kind = classifyNativeDependency(dependency)
    if (kind === 'developer') {
      fail(`${label} references a developer-machine path:\n  ${dependency}`)
    }
    if (kind === 'unknown') {
      fail(`${label} references an unresolved dependency:\n  ${dependency}`)
    }
  }
  return dependencies
}

function findNativeComponents(rootDir) {
  const components = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && (entry.name.endsWith('.bundle') || entry.name.endsWith('.dylib'))) {
        components.push(full)
      }
    }
  }
  return components
}

function resolveBundledDependency(dependency, componentDir) {
  if (dependency.startsWith('@loader_path/')) {
    return join(componentDir, dependency.slice('@loader_path/'.length))
  }
  if (dependency.startsWith('@executable_path/')) {
    return join(componentDir, dependency.slice('@executable_path/'.length))
  }
  return null
}

// The packaged PAR executable links only system libraries at the top level;
// the SSL stack lives in native components embedded inside the PAR archive and
// extracted at run time. Inspect those too, otherwise a non-relocatable
// `Net::SSLeay::SSLeay.bundle` (e.g. one referencing `/opt/homebrew/...`) would
// pass validation. See TASK-014.
function inspectEmbeddedPar(binary, expectedArch) {
  const extractDir = mkdtempSync(join(tmpdir(), 'imapsync-par-'))
  try {
    execFileSync('unzip', ['-o', '-q', binary, '-d', extractDir], { stdio: ['ignore', 'ignore', 'pipe'] })
    const components = findNativeComponents(extractDir)
    if (components.length === 0) {
      fail('the PAR archive contains no native components to inspect')
    }

    let sslBundleSeen = false
    for (const component of components) {
      const label = relative(extractDir, component)
      const fileOutput = execFileSync('file', [component], { encoding: 'utf8' })
      if (!fileOutput.includes(expectedArch)) {
        fail(`embedded native component is not ${expectedArch}:\n  ${label}\n  ${fileOutput.trim()}`)
      }

      const dependencies = checkDarwinDependencies(component, `embedded native component ${label}`)
      for (const dependency of dependencies) {
        if (classifyNativeDependency(dependency) === 'bundled') {
          const resolved = resolveBundledDependency(dependency, dirname(component))
          if (!resolved || !existsSync(resolved)) {
            fail(`embedded native component references a missing bundled dependency:\n  ${label} -> ${dependency}`)
          }
        }
      }

      if (component.endsWith('auto/Net/SSLeay/SSLeay.bundle')) {
        sslBundleSeen = true
      }
    }

    if (!sslBundleSeen) {
      fail('Net::SSLeay::SSLeay.bundle was not found in the PAR archive')
    }

    console.log(`embedded PAR native components inspected: ${components.length} file(s), no developer paths`)
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

function validateDarwinBinary(binary, expectedArch) {
  let fileOutput
  try {
    fileOutput = execFileSync('file', [binary], { encoding: 'utf8' })
  } catch {
    fail('could not inspect the bundled binary with file')
  }
  console.log(`file: ${fileOutput.trim()}`)
  if (!fileOutput.includes(expectedArch)) {
    fail(`bundled binary is not ${expectedArch}: ${fileOutput.trim()}`)
  }

  checkDarwinDependencies(binary, 'bundled binary')
  console.log('top-level dynamic library references checked (no developer paths)')

  inspectEmbeddedPar(binary, expectedArch)
}

function validateWindowsBinary(binary) {
  try {
    const machine = assertPeX64(binary)
    console.log(`PE machine: 0x${machine.toString(16)} (AMD64/x86-64)`)
  } catch (error) {
    fail(error instanceof Error ? error.message : 'could not inspect the bundled binary PE header')
  }
  console.log('PE executable verified as x86-64 (AMD64)')
}

function main() {
  const runtimeArch = runtimeArchFromArgs(process.argv)
  if (runtimeArch === null) {
    fail(`unsupported platform/architecture (resolve with --platform/--arch or --runtime-arch)`)
  }

  const runtimeDir = join(runtimeRoot, runtimeArch)
  if (!existsSync(runtimeDir)) {
    fail('runtime directory does not exist')
  }

  const manifestPath = join(runtimeDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    fail('manifest.json is missing')
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    fail('manifest.json is not valid JSON')
  }

  if (manifest.architecture !== runtimeArch) {
    fail(`manifest architecture ${manifest.architecture} does not match ${runtimeArch}`)
  }

  const expectedPlatform = runtimeArch === 'win32-x64' ? 'win32' : 'darwin'
  if (manifest.platform !== expectedPlatform) {
    fail(`manifest platform ${manifest.platform} does not match expected ${expectedPlatform}`)
  }

  const executableName = executableNameFor(runtimeArch)
  if (manifest.artifactFilename !== executableName) {
    fail(`manifest artifactFilename ${manifest.artifactFilename} does not match expected ${executableName}`)
  }

  if (typeof manifest.artifactSha256 !== 'string' || manifest.artifactSha256.length === 0) {
    fail('manifest is missing artifactSha256')
  }

  const binary = join(runtimeDir, 'bin', executableName)
  if (!existsSync(binary)) {
    fail(`required executable is missing: bin/${executableName}`)
  }

  console.log(`platform/architecture check: ${runtimeArch} OK`)
  console.log(`imapsync version: ${manifest.imapsyncVersion ?? '(unknown)'}`)

  if (runtimeArch === 'win32-x64') {
    validateWindowsBinary(binary)
  } else {
    validateDarwinBinary(binary, expectedBinaryArchFor(runtimeArch))
  }

  console.log('runtime validation OK')
}

main()
