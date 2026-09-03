#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

function findApp() {
  if (!existsSync(releaseDir)) return null
  for (const entry of readdirSync(releaseDir)) {
    const candidate = join(releaseDir, entry, 'imapSyncGUI.app')
    if (existsSync(candidate)) return candidate
  }
  return null
}

function isolationEnv() {
  const env = { PATH: '/usr/bin:/bin:/usr/sbin', HOME: process.env.HOME ?? '/tmp' }
  for (const key of ['PERL5LIB', 'PERL_LOCAL_LIB_ROOT', 'PERL_MB_OPT', 'PERL_MM_OPT', 'PERL5OPT']) {
    delete env[key]
  }
  return env
}

function main() {
  const archArg = arg('--arch') ?? process.arch
  const runtimeArch = archArg === 'x64' ? 'darwin-x64' : archArg === 'arm64' ? 'darwin-arm64' : null
  if (runtimeArch === null) fail(`unsupported architecture: ${archArg}`)

  const app = findApp()
  if (!app) fail(`no packaged .app found under ${releaseDir}`)

  const resources = join(app, 'Contents', 'Resources')
  const runtimeDir = join(resources, 'runtime', runtimeArch)
  console.log(`app: ${app}`)
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

  const binary = join(runtimeDir, 'bin', 'imapsync')
  if (!existsSync(binary)) fail('bundled imapsync binary is missing')

  const env = isolationEnv()

  const fileOutput = execFileSync('file', [binary], { encoding: 'utf8', env }).trim()
  console.log(`file: ${fileOutput}`)

  const version = execFileSync(binary, ['--noreleasecheck', '--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  }).trim()
  console.log(`imapsync starts: ${version}`)

  console.log('packaged runtime smoke test OK')
}

main()
