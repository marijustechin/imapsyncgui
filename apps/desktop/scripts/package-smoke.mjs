#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { executableNameFor, expectedBinaryArchFor, isolationEnv, runtimeArchFromArgs } from './lib/runtime-arch.mjs'
import { assertPeX64 } from './lib/winpe.mjs'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(projectDir, 'release')

function arg(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) return true
  return value
}

function fail(message) {
  console.error(`packaged runtime smoke test failed: ${message}`)
  process.exit(1)
}

// The packaged runtime must load the SSL stack offline and resolve it without
// developer-machine paths. See TASK-014 / docs/runtime.md.
function assertSslStackResolves(binary, env, { requireBundle }) {
  const result = spawnSync(binary, ['--noreleasecheck', '--version'], {
    encoding: 'utf8',
    env: { ...env, DYLD_PRINT_LIBRARIES: '1' },
    timeout: 60_000,
  })
  if (result.error) {
    fail(`running the packaged imapsync failed: ${result.error.message}`)
  }
  const trace = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (result.status !== 0) {
    fail(`imapsync --version failed with status ${result.status}:\n${trace.trim()}`)
  }
  const sslLines = trace.split('\n').filter((line) => /libssl|libcrypto|SSLeay\.bundle/.test(line))
  if (sslLines.length === 0) {
    fail('the packaged runtime did not load the SSL stack (Net::SSLeay / libssl / libcrypto)')
  }
  if (requireBundle && !sslLines.some((line) => line.includes('SSLeay.bundle'))) {
    fail('the packaged runtime did not load Net::SSLeay::SSLeay.bundle from the bundle')
  }
  const developerLines = sslLines.filter((line) =>
    /\/opt\/homebrew|\/usr\/local\/Cellar|\/usr\/local\/opt|\/opt\/local|\/Users\//.test(line),
  )
  if (developerLines.length > 0) {
    fail(`the packaged runtime resolved an SSL component from a developer path:\n${developerLines.join('\n')}`)
  }
  console.log(`SSL stack loaded from packaged/system locations (${sslLines.length} image(s))`)
}

function findMacApp() {
  if (!existsSync(releaseDir)) return null
  for (const entry of readdirSync(releaseDir)) {
    const candidate = join(releaseDir, entry, 'imapSyncGUI.app')
    if (existsSync(candidate)) return candidate
  }
  return null
}

function findWinUnpackedResources() {
  if (!existsSync(releaseDir)) return null
  const candidate = join(releaseDir, 'win-unpacked', 'resources')
  if (existsSync(candidate)) return candidate
  return null
}

function resourcesDirFor(runtimeArch) {
  const resourcesArg = arg('--resources')
  if (resourcesArg) {
    const resolved = resolve(resourcesArg)
    if (!existsSync(resolved)) fail(`resources path does not exist: ${resolved}`)
    return resolved
  }

  const appArg = arg('--app')
  if (appArg) {
    const app = resolve(appArg)
    if (!existsSync(app)) fail(`app path does not exist: ${app}`)
    const resources = join(app, 'Contents', 'Resources')
    if (!existsSync(resources)) fail(`app resources not found under: ${app}`)
    return resources
  }

  if (runtimeArch === 'win32-x64') {
    const resources = findWinUnpackedResources()
    if (!resources) fail('no win-unpacked resources found under release/')
    return resources
  }

  const app = findMacApp()
  if (!app) fail(`no packaged .app found under ${releaseDir}`)
  return join(app, 'Contents', 'Resources')
}

function main() {
  const runtimeArch = runtimeArchFromArgs(process.argv)
  if (runtimeArch === null) fail(`unsupported platform/architecture (resolve with --platform/--arch or --runtime-arch)`)

  const resources = resourcesDirFor(runtimeArch)
  const runtimeDir = join(resources, 'runtime', runtimeArch)
  console.log(`resources: ${resources}`)
  console.log(`runtime: ${runtimeDir}`)

  if (!existsSync(runtimeDir)) fail(`runtime directory is missing: ${runtimeDir}`)

  const manifestPath = join(runtimeDir, 'manifest.json')
  if (!existsSync(manifestPath)) fail('runtime manifest is missing')

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    fail('runtime manifest is not valid JSON')
  }
  if (manifest.architecture !== runtimeArch) {
    fail(`manifest architecture ${manifest.architecture} does not match ${runtimeArch}`)
  }
  console.log(`manifest architecture: ${manifest.architecture} OK`)

  const executableName = executableNameFor(runtimeArch)
  const binary = join(runtimeDir, 'bin', executableName)
  if (!existsSync(binary)) fail(`bundled imapsync binary is missing: ${executableName}`)

  const env = isolationEnv(runtimeArch === 'win32-x64' ? 'win32' : 'darwin')

  if (runtimeArch === 'win32-x64') {
    try {
      const machine = assertPeX64(binary)
      console.log(`PE machine: 0x${machine.toString(16)} (AMD64/x86-64)`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'bundled imapsync.exe is not AMD64')
    }
  } else {
    const fileOutput = execFileSync('file', [binary], { encoding: 'utf8', env }).trim()
    console.log(`file: ${fileOutput}`)
    if (!fileOutput.includes(expectedBinaryArchFor(runtimeArch))) {
      fail(`bundled binary is not ${expectedBinaryArchFor(runtimeArch)}`)
    }
  }

  const version = execFileSync(binary, ['--noreleasecheck', '--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  }).trim()
  console.log(`imapsync starts: ${version}`)

  if (runtimeArch !== 'win32-x64') {
    assertSslStackResolves(binary, env, { requireBundle: runtimeArch === 'darwin-arm64' })
  }

  console.log('packaged runtime smoke test OK')
}

main()
