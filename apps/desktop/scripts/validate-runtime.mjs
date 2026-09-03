#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')

function arg(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) return true
  return value
}

function fail(message) {
  console.error(`validation failed: ${message}`)
  process.exit(1)
}

function main() {
  const archArg = arg('--arch') ?? process.arch
  const runtimeArch = archArg === 'x64' ? 'darwin-x64' : archArg === 'arm64' ? 'darwin-arm64' : null
  if (runtimeArch === null) {
    fail(`unsupported architecture: ${archArg}`)
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

  const binary = join(runtimeDir, 'bin', 'imapsync')
  if (!existsSync(binary)) {
    fail('required executable is missing: bin/imapsync')
  }

  console.log(`architecture check: ${runtimeArch} OK`)
  console.log(`imapsync version: ${manifest.imapsyncVersion ?? '(unknown)'}`)

  try {
    const fileOutput = execFileSync('file', [binary], { encoding: 'utf8' })
    console.log(`file: ${fileOutput.trim()}`)
  } catch {
    fail('could not inspect bin/imapsync with file')
  }

  try {
    const output = execFileSync('otool', ['-L', binary], { encoding: 'utf8' })
    const suspicious = output
      .split('\n')
      .filter((line) => line.startsWith('\t'))
      .filter((line) => line.includes('/opt/homebrew') || line.includes('/usr/local/Cellar') || line.includes('/opt/local') || line.includes('/Users/'))
    if (suspicious.length > 0) {
      fail(`bin/imapsync references developer-machine paths:\n${suspicious.join('\n')}`)
    }
    console.log('dynamic library references checked (no developer paths)')
  } catch {
    fail('could not inspect bin/imapsync with otool -L')
  }

  console.log('runtime validation OK')
}

main()
