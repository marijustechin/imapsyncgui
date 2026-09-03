#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')
const licensesDir = join(dirname(fileURLToPath(import.meta.url)), 'licenses')

const FORMAT_VERSION = 1
const IMAPSYNC_VERSION = '2.314'
const IMAPSYNC_BINARY_URL = 'https://imapsync.lamiral.info/dist/imapsync_bin_Darwin_x86_64'
const IMAPSYNC_BINARY_SHA256 = 'cf15ed54a50bdbc9a1f4e118916a95e7bb36deb2c1b6f643d16b84223cc49b88'

const LICENSE_FILES = [
  'imapsync-LICENSE.txt',
  'perl-ARTISTIC.txt',
  'perl-GPL-1.0.txt',
  'openssl-LICENSE.txt',
]

function runtimeArchFor(arch) {
  if (arch === 'x64') return 'darwin-x64'
  if (arch === 'arm64') return 'darwin-arm64'
  return null
}

function arg(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) return true
  return value
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function fetchBinary() {
  const result = execFileSync('curl', ['-fsSL', IMAPSYNC_BINARY_URL], { maxBuffer: 64 * 1024 * 1024 })
  const buffer = Buffer.from(result)
  const digest = sha256Hex(buffer)
  if (digest !== IMAPSYNC_BINARY_SHA256) {
    throw new Error(`imapsync binary checksum mismatch: expected ${IMAPSYNC_BINARY_SHA256}, got ${digest}`)
  }
  return buffer
}

function main() {
  const archArg = arg('--arch') ?? process.arch
  const runtimeArch = runtimeArchFor(archArg)
  if (runtimeArch === null) {
    console.error(`unsupported architecture: ${archArg}`)
    process.exit(1)
  }
  if (runtimeArch !== 'darwin-x64') {
    console.error(`this task builds darwin-x64 only; requested ${runtimeArch}`)
    process.exit(1)
  }

  const binaryPath = arg('--imapsync-binary')
  let binaryBuffer
  if (binaryPath) {
    if (!existsSync(binaryPath)) {
      console.error(`--imapsync-binary path does not exist: ${binaryPath}`)
      process.exit(1)
    }
    binaryBuffer = readFileSync(binaryPath)
  } else {
    binaryBuffer = fetchBinary()
  }

  const runtimeDir = join(runtimeRoot, runtimeArch)
  const binDir = join(runtimeDir, 'bin')
  rmSync(runtimeDir, { recursive: true, force: true })
  mkdirSync(join(runtimeDir, 'licenses'), { recursive: true })
  mkdirSync(binDir, { recursive: true })

  const targetBinary = join(binDir, 'imapsync')
  writeFileSync(targetBinary, binaryBuffer)
  chmodSync(targetBinary, 0o755)

  for (const license of LICENSE_FILES) {
    const source = join(licensesDir, license)
    if (existsSync(source)) {
      copyFileSync(source, join(runtimeDir, 'licenses', license))
    }
  }

  const manifest = {
    formatVersion: FORMAT_VERSION,
    architecture: runtimeArch,
    imapsyncVersion: IMAPSYNC_VERSION,
    perlVersion: '5.34 (embedded)',
    opensslVersion: 'embedded',
    builtAt: new Date().toISOString(),
    components: [
      { name: 'imapsync', version: IMAPSYNC_VERSION, license: 'NLPL', source: IMAPSYNC_BINARY_URL },
      { name: 'perl', version: '5.34 (embedded)', license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://www.perl.org/' },
      { name: 'openssl', version: 'embedded', license: 'OpenSSL + Apache-SSLeay', source: 'https://www.openssl.org/' },
      { name: 'perl modules (CPAN)', version: 'embedded', license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://metacpan.org/' },
    ],
  }

  writeFileSync(join(runtimeDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`staged runtime: ${runtimeDir}`)
  console.log(`  architecture: ${runtimeArch}`)
  console.log(`  imapsync: ${IMAPSYNC_VERSION} (self-contained binary, sha256 ${IMAPSYNC_BINARY_SHA256.slice(0, 16)}…)`)
  console.log(`  licenses: ${LICENSE_FILES.join(', ')}`)
}

main()
