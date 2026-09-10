#!/usr/bin/env node
// Build (stage) the self-contained Windows x64 imapsync runtime (TASK-011,
// ADR-016).
//
// The Windows runtime is the official upstream standalone `imapsync.exe`
// distributed inside the free `imapsync_2.314.zip` archive. It is a PE32+
// x86-64 console executable that embeds Perl, the required CPAN modules, and
// the OpenSSL stack via PAR::Packer, so it requires no end-user dependency
// beyond write access to the OS temporary directory.
//
// This script downloads the pinned zip, verifies both the zip and the embedded
// `imapsync.exe` by SHA-256, and stages the binary + manifest + license texts
// under runtime/win32-x64/.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')
const licensesDir = join(dirname(fileURLToPath(import.meta.url)), 'licenses')

const FORMAT_VERSION = 1
const IMAPSYNC_VERSION = '2.314'
const IMAPSYNC_ZIP_URL = 'https://imapsync.lamiral.info/dist/imapsync_2.314.zip'
const IMAPSYNC_ZIP_SHA256 = '61972bf94532bf186dd6d6ee54a4c70bb7ab3bdb79f324321cd742fd50953a0c'
const IMAPSYNC_EXE_SHA256 = '329c0bfecab410a2bf5e57cc3319aa00b8e494fd792fe3a5476db9efdb1d2aab'
const ARCHIVE_MEMBER = 'imapsync_2.314/imapsync.exe'

const LICENSE_FILES = [
  'imapsync-LICENSE.txt',
  'perl-ARTISTIC.txt',
  'perl-GPL-1.0.txt',
  'openssl-LICENSE.txt',
]

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function fail(message) {
  console.error(`windows runtime build failed: ${message}`)
  process.exit(1)
}

function main() {
  const workDir = join(tmpdir(), `imapsync-win-runtime-${process.pid}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const zipPath = join(workDir, 'imapsync_2.314.zip')

    console.log(`downloading ${IMAPSYNC_ZIP_URL}`)
    execFileSync('curl', ['-fsSL', IMAPSYNC_ZIP_URL, '-o', zipPath], { maxBuffer: 8 * 1024 * 1024 })

    const zipBuffer = readFileSync(zipPath)
    const zipDigest = sha256Hex(zipBuffer)
    if (zipDigest !== IMAPSYNC_ZIP_SHA256) {
      fail(`zip checksum mismatch: expected ${IMAPSYNC_ZIP_SHA256}, got ${zipDigest}`)
    }
    console.log(`zip SHA-256 verified: ${zipDigest}`)

    console.log(`extracting ${ARCHIVE_MEMBER}`)
    execFileSync('tar', ['-xf', zipPath, '-C', workDir, ARCHIVE_MEMBER], { maxBuffer: 8 * 1024 * 1024 })

    const extractedExe = join(workDir, ARCHIVE_MEMBER)
    if (!existsSync(extractedExe)) {
      fail(`extracted imapsync.exe is missing: ${extractedExe}`)
    }

    const exeBuffer = readFileSync(extractedExe)
    const exeDigest = sha256Hex(exeBuffer)
    if (exeDigest !== IMAPSYNC_EXE_SHA256) {
      fail(`imapsync.exe checksum mismatch: expected ${IMAPSYNC_EXE_SHA256}, got ${exeDigest}`)
    }
    console.log(`imapsync.exe SHA-256 verified: ${exeDigest}`)

    const runtimeDir = join(runtimeRoot, 'win32-x64')
    const binDir = join(runtimeDir, 'bin')
    rmSync(runtimeDir, { recursive: true, force: true })
    mkdirSync(join(runtimeDir, 'licenses'), { recursive: true })
    mkdirSync(binDir, { recursive: true })

    const targetBinary = join(binDir, 'imapsync.exe')
    writeFileSync(targetBinary, exeBuffer)
    if (process.platform !== 'win32') {
      chmodSync(targetBinary, 0o755)
    }

    for (const license of LICENSE_FILES) {
      const source = join(licensesDir, license)
      if (existsSync(source)) {
        copyFileSync(source, join(runtimeDir, 'licenses', license))
      }
    }

    const manifest = {
      formatVersion: FORMAT_VERSION,
      platform: 'win32',
      architecture: 'win32-x64',
      imapsyncVersion: IMAPSYNC_VERSION,
      artifactFilename: 'imapsync.exe',
      artifactSha256: IMAPSYNC_EXE_SHA256,
      perlVersion: 'embedded (PAR::Packer)',
      opensslVersion: 'embedded',
      builtAt: new Date().toISOString(),
      components: [
        { name: 'imapsync', version: IMAPSYNC_VERSION, license: 'NLPL', source: IMAPSYNC_ZIP_URL },
        { name: 'perl', version: 'embedded', license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://www.perl.org/' },
        { name: 'openssl', version: 'embedded', license: 'OpenSSL + Apache-SSLeay', source: 'https://www.openssl.org/' },
        { name: 'perl modules (CPAN)', version: 'embedded', license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://metacpan.org/' },
      ],
    }

    writeFileSync(join(runtimeDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

    console.log(`staged runtime: ${runtimeDir}`)
    console.log(`  platform/architecture: win32-x64`)
    console.log(`  imapsync: ${IMAPSYNC_VERSION} (self-contained imapsync.exe, sha256 ${IMAPSYNC_EXE_SHA256.slice(0, 16)}…)`)
    console.log(`  licenses: ${LICENSE_FILES.join(', ')}`)
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()
