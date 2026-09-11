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
// with DYLD_PRINT_LIBRARIES proves the SSL stack actually resolves, and that it
// does not come from a developer-machine path (Homebrew/MacPorts/home). This is
// the offline check that the previous self-test lacked (TASK-014).
function assertSslStackResolves(binary, env, { requireBundle }) {
  const result = spawnSync(binary, ['--noreleasecheck', '--version'], {
    encoding: 'utf8',
    env: { ...env, DYLD_PRINT_LIBRARIES: '1' },
    timeout: 60_000,
  })

  if (result.error) {
    fail(`running the bundled imapsync failed: ${result.error.message}`)
  }

  const trace = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (result.status !== 0) {
    fail(`imapsync --version failed with status ${result.status}:\n${trace.trim()}`)
  }

  const sslLines = trace
    .split('\n')
    .filter((line) => /libssl|libcrypto|SSLeay\.bundle/.test(line))
  if (sslLines.length === 0) {
    fail('the runtime did not load the SSL stack (Net::SSLeay / libssl / libcrypto)')
  }
  if (requireBundle && !sslLines.some((line) => line.includes('SSLeay.bundle'))) {
    fail('Net::SSLeay::SSLeay.bundle was not loaded from the bundled runtime')
  }

  const developerLines = sslLines.filter((line) =>
    /\/opt\/homebrew|\/usr\/local\/Cellar|\/usr\/local\/opt|\/opt\/local|\/Users\//.test(line),
  )
  if (developerLines.length > 0) {
    fail(`the runtime resolved an SSL component from a developer path:\n${developerLines.join('\n')}`)
  }

  console.log(`SSL stack loaded and resolved without developer paths (${sslLines.length} image(s))`)
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
    assertSslStackResolves(binary, env, { requireBundle: runtimeArch === 'darwin-arm64' })
  }

  console.log('runtime self-test OK (host-isolation environment applied)')
}

main()
