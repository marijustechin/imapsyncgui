#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { executableNameFor, expectedBinaryArchFor, runtimeArchFromArgs } from './lib/runtime-arch.mjs'
import { assertPeX64 } from './lib/winpe.mjs'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')

function fail(message) {
  console.error(`validation failed: ${message}`)
  process.exit(1)
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

  try {
    const output = execFileSync('otool', ['-L', binary], { encoding: 'utf8' })
    const suspicious = output
      .split('\n')
      .filter((line) => line.startsWith('\t'))
      .filter((line) => line.includes('/opt/homebrew') || line.includes('/usr/local/Cellar') || line.includes('/opt/local') || line.includes('/Users/'))
    if (suspicious.length > 0) {
      fail(`bundled binary references developer-machine paths:\n${suspicious.join('\n')}`)
    }
    console.log('dynamic library references checked (no developer paths)')
  } catch {
    fail('could not inspect the bundled binary with otool -L')
  }
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
