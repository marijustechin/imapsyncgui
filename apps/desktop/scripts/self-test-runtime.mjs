#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { executableNameFor, expectedBinaryArchFor, isolationEnv, runtimeArchFromArgs } from './lib/runtime-arch.mjs'
import { assertPeX64 } from './lib/winpe.mjs'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')

function run(command, args, env) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    timeout: 60_000,
  })
}

function fail(message) {
  console.error(`self-test failed: ${message}`)
  process.exit(1)
}

// imapsync `use`s IO::Socket::SSL, which `use`s Net::SSLeay, at compile time,
// so even `--version` loads the SSL XS bundle and the OpenSSL dylibs. Running
// that under a sandbox that denies read access to Homebrew/MacPorts proves the
// runtime resolves its SSL stack from the bundled `@loader_path` dylibs and
// does not fall back to a developer-machine install. This is the offline check
// the previous self-test lacked (TASK-014); the static PAR inspection in
// `runtime:validate` provides the same guarantee without executing the binary.
function assertSslStackResolvesWithoutDeveloperPaths(binary, env) {
  const sandboxExec = '/usr/bin/sandbox-exec'
  if (!existsSync(sandboxExec)) {
    console.log('sandbox-exec unavailable; Homebrew independence is covered by runtime:validate')
    return
  }

  const profile =
    '(version 1)(allow default)' +
    '(deny file-read* (subpath "/opt/homebrew"))' +
    '(deny file-read* (subpath "/usr/local"))' +
    '(deny file-read* (subpath "/opt/local"))'

  const result = spawnSync(sandboxExec, ['-p', profile, binary, '--noreleasecheck', '--version'], {
    encoding: 'utf8',
    env,
    timeout: 60_000,
  })
  if (result.error) {
    fail(`sandboxed SSL check failed to run: ${result.error.message}`)
  }
  if (result.status !== 0) {
    fail(
      'the bundled runtime could not load its SSL stack with Homebrew/MacPorts access denied ' +
        `(a developer OpenSSL dependency is still present):\n${(result.stderr ?? '').trim()}`,
    )
  }
  console.log('bundled runtime loads its SSL stack with Homebrew/MacPorts access denied')
}

function main() {
  const runtimeArch = runtimeArchFromArgs(process.argv)
  if (runtimeArch === null) {
    fail(`unsupported platform/architecture (resolve with --platform/--arch or --runtime-arch)`)
  }

  const binary = join(runtimeRoot, runtimeArch, 'bin', executableNameFor(runtimeArch))
  if (!existsSync(binary)) {
    fail(`bundled imapsync binary is missing: ${binary}`)
  }

  const env = isolationEnv()

  if (runtimeArch === 'win32-x64') {
    try {
      const machine = assertPeX64(binary)
      console.log(`architecture: PE AMD64 (machine 0x${machine.toString(16)})`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'bundled imapsync.exe is not AMD64')
    }
  } else {
    const expectedArch = expectedBinaryArchFor(runtimeArch)
    const fileOutput = run('file', [binary], env).trim()
    if (!fileOutput.includes(expectedArch)) {
      fail(`bundled imapsync is not ${expectedArch}: ${fileOutput}`)
    }
    console.log(`architecture: ${fileOutput}`)
  }

  console.log('running bundled imapsync --version')
  const version = run(binary, ['--noreleasecheck', '--version'], env).trim()
  console.log(`imapsync starts: ${version}`)

  if (runtimeArch !== 'win32-x64') {
    console.log('checking bundled SSL stack resolution')
    assertSslStackResolvesWithoutDeveloperPaths(binary, env)
  }

  console.log('runtime self-test OK (host-isolation environment applied)')
}

main()
