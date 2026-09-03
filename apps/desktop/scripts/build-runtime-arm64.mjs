#!/usr/bin/env node
// Build the self-contained arm64 imapsync runtime (TASK-009B, ADR-013).
//
// This mirrors the x86_64 strategy (a single PAR::Packer-packed binary) using
// the upstream's own documented macOS build method, but executed natively on
// Apple Silicon so the produced binary is arm64.
//
// NATIVE EXECUTION IS MANDATORY: this script refuses to run on a non-arm64
// host. It has not been executed or verified on this repository's x86_64 host.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')
const licensesDir = join(dirname(fileURLToPath(import.meta.url)), 'licenses')

const IMAPSYNC_VERSION = '2.314'
const IMAPSYNC_SCRIPT_URL = 'https://imapsync.lamiral.info/imapsync'
const PERL_MAJOR = '5.34'

const LICENSE_FILES = [
  'imapsync-LICENSE.txt',
  'perl-ARTISTIC.txt',
  'perl-GPL-1.0.txt',
  'openssl-LICENSE.txt',
]

function sh(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: 'inherit' })
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function fail(message) {
  console.error(`arm64 runtime build failed: ${message}`)
  process.exit(1)
}

function main() {
  if (process.arch !== 'arm64') {
    fail('native Apple Silicon hardware (process.arch === "arm64") is required to build and verify this runtime')
  }

  const runtimeDir = join(runtimeRoot, 'darwin-arm64')
  const binDir = join(runtimeDir, 'bin')
  rmSync(runtimeDir, { recursive: true, force: true })
  mkdirSync(join(runtimeDir, 'licenses'), { recursive: true })
  mkdirSync(binDir, { recursive: true })

  console.log('installing build-time prerequisites (build machine only, not runtime deps)')
  sh('brew', ['install', `perl@${PERL_MAJOR}`, 'cpanminus', 'openssl@3'])

  console.log('installing imapsync prerequisites into the build perl')
  for (const module of ['Authen::NTLM', 'IO::Tee', 'Mail::IMAPClient', 'Unicode::String', 'Sys::MemInfo', 'File::Tail', 'Proc::ProcessTable', 'Test::MockObject', 'Readonly', 'Data::Uniqid', 'JSON::WebToken', 'IO::Socket::SSL']) {
    sh('cpanm', ['--notest', module])
  }

  console.log('installing PAR::Packer (to produce a self-contained binary)')
  sh('cpanm', ['--notest', 'Module::ScanDeps', 'PAR::Packer'])

  console.log('downloading imapsync script')
  const scriptBuffer = execFileSync('curl', ['-fsSL', IMAPSYNC_SCRIPT_URL], { maxBuffer: 32 * 1024 * 1024 })
  const scriptPath = join(runtimeDir, 'imapsync')
  writeFileSync(scriptPath, scriptBuffer)
  chmodSync(scriptPath, 0o755)
  console.log(`  imapsync script sha256: ${sha256Hex(Buffer.from(scriptBuffer))}`)

  console.log('packing self-contained arm64 binary with pp')
  sh('pp', ['-x', '-u', '-o', join(binDir, 'imapsync'), scriptPath])

  for (const license of LICENSE_FILES) {
    const source = join(licensesDir, license)
    if (existsSync(source)) {
      copyFileSync(source, join(runtimeDir, 'licenses', license))
    }
  }

  const manifest = {
    formatVersion: 1,
    architecture: 'darwin-arm64',
    imapsyncVersion: IMAPSYNC_VERSION,
    perlVersion: `${PERL_MAJOR} (embedded via PAR::Packer)`,
    opensslVersion: 'embedded',
    builtAt: new Date().toISOString(),
    components: [
      { name: 'imapsync', version: IMAPSYNC_VERSION, license: 'NLPL', source: IMAPSYNC_SCRIPT_URL },
      { name: 'perl', version: `${PERL_MAJOR} (embedded)`, license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://www.perl.org/' },
      { name: 'openssl', version: 'embedded', license: 'OpenSSL + Apache-SSLeay', source: 'https://www.openssl.org/' },
      { name: 'perl modules (CPAN)', version: 'embedded', license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://metacpan.org/' },
    ],
  }
  writeFileSync(join(runtimeDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`staged runtime: ${runtimeDir}`)
  console.log('next steps: pnpm runtime:validate --arch arm64 && pnpm runtime:self-test --arch arm64')
}

main()
