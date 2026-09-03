#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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

function run(command, args, env) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
}

function fail(message) {
  console.error(`self-test failed: ${message}`)
  process.exit(1)
}

// Host-isolation baseline: no Homebrew/MacPorts executable paths, no developer
// Perl configuration. The bundled binary must still run.
function isolationEnv() {
  const env = {
    PATH: '/usr/bin:/bin:/usr/sbin',
    HOME: process.env.HOME ?? '/tmp',
  }
  for (const key of ['PERL5LIB', 'PERL_LOCAL_LIB_ROOT', 'PERL_MB_OPT', 'PERL_MM_OPT', 'PERL5OPT']) {
    delete env[key]
  }
  return env
}

function main() {
  const archArg = arg('--arch') ?? process.arch
  const runtimeArch = archArg === 'x64' ? 'darwin-x64' : archArg === 'arm64' ? 'darwin-arm64' : null
  if (runtimeArch === null) {
    fail(`unsupported architecture: ${archArg}`)
  }

  const binary = join(runtimeRoot, runtimeArch, 'bin', 'imapsync')
  if (!existsSync(binary)) {
    fail(`bundled imapsync binary is missing: ${binary}`)
  }

  const env = isolationEnv()

  const fileOutput = run('file', [binary], env).trim()
  if (!fileOutput.includes('x86_64')) {
    fail(`bundled imapsync is not x86_64: ${fileOutput}`)
  }
  console.log(`architecture: ${fileOutput}`)

  const version = run(binary, ['--noreleasecheck', '--version'], env).trim()
  console.log(`imapsync starts: ${version}`)

  console.log('runtime self-test OK (host-isolation environment applied)')
}

main()
