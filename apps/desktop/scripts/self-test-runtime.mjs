#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
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
  })
}

function fail(message) {
  console.error(`self-test failed: ${message}`)
  process.exit(1)
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

  const version = run(binary, ['--noreleasecheck', '--version'], env).trim()
  console.log(`imapsync starts: ${version}`)

  console.log('runtime self-test OK (host-isolation environment applied)')
}

main()
