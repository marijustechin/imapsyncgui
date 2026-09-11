#!/usr/bin/env node
// Build the self-contained arm64 imapsync runtime (TASK-009B, ADR-013; hardened
// in TASK-014).
//
// This mirrors the x86_64 strategy (a single PAR::Packer-packed binary) using
// the upstream's own documented macOS build method, but executed natively on
// Apple Silicon so the produced binary is arm64.
//
// OpenSSL portability: cpanm builds Net::SSLeay against the Homebrew OpenSSL
// prefix, which makes the generated `SSLeay.bundle` reference an absolute
// `/opt/homebrew/...` (or `/usr/local/Cellar/...`) dylib path. PAR::Packer then
// embeds that bundle, so the packed runtime only works on a machine that still
// has the build machine's Homebrew OpenSSL. TASK-014 fixes this by copying the
// referenced OpenSSL dylibs into the PAR archive next to the bundle and
// rewriting every reference to `@loader_path/<dylib>`, so resolution is
// relative to the extracted bundle and needs no Homebrew at run time.
//
// NATIVE EXECUTION IS MANDATORY: this script refuses to run on a non-arm64
// host.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(projectDir, 'runtime')
const licensesDir = join(dirname(fileURLToPath(import.meta.url)), 'licenses')

const IMAPSYNC_SCRIPT_URL = 'https://imapsync.lamiral.info/imapsync'
const CPANM_URL = 'https://cpanmin.us'

const REQUIRED_MODULES = [
  'Authen::NTLM',
  'Data::Uniqid',
  'Digest::HMAC',
  'Encode::IMAPUTF7',
  'File::Copy::Recursive',
  'File::Tail',
  'IO::Socket::IP',
  'IO::Socket::SSL',
  'IO::Tee',
  'JSON',
  'JSON::WebToken',
  'Mail::IMAPClient',
  'Module::Build::Tiny',
  'Proc::ProcessTable',
  'Readonly',
  'Regexp::Common',
  'Sys::MemInfo',
  'Term::ReadKey',
  'Test::MockObject',
  'Unicode::String',
]

const LICENSE_FILES = [
  'imapsync-LICENSE.txt',
  'perl-ARTISTIC.txt',
  'perl-GPL-1.0.txt',
  'openssl-LICENSE.txt',
]

function sh(command, args, env, cwd) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, ...env },
    cwd,
  })
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function fail(message) {
  console.error(`arm64 runtime build failed: ${message}`)
  process.exit(1)
}

// A dependency that ships with macOS itself and is safe to leave absolute.
function isSystemDependency(dep) {
  return dep.startsWith('/usr/lib/') || dep.startsWith('/System/') || dep.startsWith('/Library/Apple/')
}

function otoolDependencies(file) {
  const output = capture('otool', ['-L', file])
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(' (')[0])
}

// Copies every non-system dependency of `bundlePath` (recursively) into
// `stagingDir` and rewrites all references to `@loader_path/<basename>` so the
// extracted PAR archive resolves them next to the bundle. Returns the mapping
// of original path -> bundled basename.
function bundleDependencies(bundlePath, stagingDir) {
  mkdirSync(stagingDir, { recursive: true })

  const mapping = new Map()
  const queue = otoolDependencies(bundlePath).filter((dep) => !isSystemDependency(dep) && !dep.startsWith('@'))

  while (queue.length > 0) {
    const dependency = queue.shift()
    if (mapping.has(dependency)) {
      continue
    }
    const resolved = realpathSync(dependency)
    const bundledName = basename(dependency)
    copyFileSync(resolved, join(stagingDir, bundledName))
    chmodSync(join(stagingDir, bundledName), 0o755)
    mapping.set(dependency, bundledName)
    mapping.set(resolved, bundledName)

    for (const child of otoolDependencies(resolved)) {
      if (!isSystemDependency(child) && !child.startsWith('@') && !mapping.has(child)) {
        queue.push(child)
      }
    }
  }

  if (mapping.size === 0) {
    fail(`no external (non-system) dependencies were found for ${bundlePath}`)
  }

  const bundledNames = [...new Set(mapping.values())]

  // Rewrite the bundle's references.
  for (const [original, bundledName] of mapping) {
    try {
      sh('install_name_tool', ['-change', original, `@loader_path/${bundledName}`, bundlePath])
    } catch {
      // The bundle does not reference this path; ignore.
    }
  }

  // Rewrite the copied dylibs' ids and their own inter-dependencies.
  for (const bundledName of bundledNames) {
    const file = join(stagingDir, bundledName)
    sh('install_name_tool', ['-id', `@loader_path/${bundledName}`, file])
    for (const dependency of otoolDependencies(file)) {
      const target = mapping.get(dependency)
      if (target !== undefined) {
        sh('install_name_tool', ['-change', dependency, `@loader_path/${target}`, file])
      }
    }
  }

  // install_name_tool invalidates the code signature; on arm64 an unsigned or
  // invalidly-signed Mach-O cannot be loaded, so re-sign everything ad-hoc.
  for (const file of [bundlePath, ...bundledNames.map((name) => join(stagingDir, name))]) {
    sh('codesign', ['--force', '--sign', '-', file])
  }

  return mapping
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
  sh('brew', ['install', 'perl', 'openssl@3'])

  const brewPrefix = capture('brew', ['--prefix'])
  const brewPerl = join(brewPrefix, 'bin', 'perl')
  const perlVersion = capture(brewPerl, ['-e', 'print $^V']).replace(/^v/, '')
  const opensslPrefix = capture('brew', ['--prefix', 'openssl@3'])
  const opensslVersion = capture(join(opensslPrefix, 'bin', 'openssl'), ['version']).replace(/^OpenSSL\s+/, '')
  console.log(`build perl: ${brewPerl} (${perlVersion})`)
  console.log(`build openssl prefix: ${opensslPrefix} (${opensslVersion})`)

  // Use a standalone cpanm run under the build perl, so every module (and
  // PAR::Packer / pp) installs into and runs under the same perl. The Homebrew
  // `cpanminus` formula targets the system Perl and must not be used.
  const cpanmPath = join(tmpdir(), 'cpanm-arm64')
  execFileSync('curl', ['-fsSL', CPANM_URL, '-o', cpanmPath], { maxBuffer: 8 * 1024 * 1024 })
  const cpanm = (...modules) => sh(brewPerl, [cpanmPath, '--notest', ...modules], { OPENSSL_PREFIX: opensslPrefix })

  console.log('installing imapsync prerequisites into the build perl')
  for (const module of REQUIRED_MODULES) {
    cpanm(module)
  }

  console.log('installing PAR::Packer (to produce a self-contained binary)')
  cpanm('Module::ScanDeps', 'PAR::Packer')

  console.log('downloading imapsync script')
  const scriptBuffer = execFileSync('curl', ['-fsSL', IMAPSYNC_SCRIPT_URL], { maxBuffer: 32 * 1024 * 1024 })
  const scriptPath = join(runtimeDir, 'imapsync')
  writeFileSync(scriptPath, scriptBuffer)
  chmodSync(scriptPath, 0o755)
  const scriptSha256 = sha256Hex(Buffer.from(scriptBuffer))
  const versionMatch = scriptBuffer.toString('utf8').match(/\$Id: imapsync,v\s+(\d+\.\d+)/)
  const imapsyncVersion = versionMatch ? versionMatch[1] : 'unknown'
  console.log(`  imapsync version: ${imapsyncVersion}`)
  console.log(`  imapsync script sha256: ${scriptSha256}`)

  let pp = join(brewPrefix, 'bin', 'pp')
  if (!existsSync(pp)) {
    const sitebin = capture(brewPerl, ['-MConfig', '-e', 'print $Config{installsitebin}'])
    pp = join(sitebin, 'pp')
  }

  // Locate the XS bundle built for Net::SSLeay and make its OpenSSL
  // dependencies relocatable before PAR packs it.
  const sitearch = capture(brewPerl, ['-MConfig', '-e', 'print $Config{sitearch}'])
  const archlib = capture(brewPerl, ['-MConfig', '-e', 'print $Config{archlib}'])
  const sslBundle = [join(sitearch, 'auto/Net/SSLeay/SSLeay.bundle'), join(archlib, 'auto/Net/SSLeay/SSLeay.bundle')].find(existsSync)
  if (!sslBundle) {
    fail('could not locate Net::SSLeay SSLeay.bundle in the build perl')
  }

  console.log('bundling OpenSSL dependencies and rewriting Net::SSLeay to @loader_path')
  const parExtraRoot = join(runtimeDir, 'par-extra')
  const sslStagingDir = join(parExtraRoot, 'lib', 'auto', 'Net', 'SSLeay')
  const dependencyMapping = bundleDependencies(sslBundle, sslStagingDir)
  console.log(`  bundled ${new Set(dependencyMapping.values()).size} OpenSSL dylib(s): ${[...new Set(dependencyMapping.values())].join(', ')}`)

  console.log('packing self-contained arm64 binary with pp')
  sh(brewPerl, [pp, '-x', '-u', '-a', 'lib', '-o', join(binDir, 'imapsync'), scriptPath], undefined, parExtraRoot)

  // The staging directory was only needed while packing; the dylibs now live
  // inside the PAR archive.
  rmSync(parExtraRoot, { recursive: true, force: true })

  const binaryPath = join(binDir, 'imapsync')
  const binarySha256 = sha256Hex(readFileSync(binaryPath))

  for (const license of LICENSE_FILES) {
    const source = join(licensesDir, license)
    if (existsSync(source)) {
      copyFileSync(source, join(runtimeDir, 'licenses', license))
    }
  }

  const manifest = {
    formatVersion: 1,
    platform: 'darwin',
    architecture: 'darwin-arm64',
    imapsyncVersion,
    artifactFilename: 'imapsync',
    artifactSha256: binarySha256,
    imapsyncScriptSha256: scriptSha256,
    perlVersion: `${perlVersion} (embedded via PAR::Packer)`,
    opensslVersion: `${opensslVersion} (embedded via PAR, @loader_path)`,
    builtAt: new Date().toISOString(),
    components: [
      { name: 'imapsync', version: imapsyncVersion, license: 'NLPL', source: IMAPSYNC_SCRIPT_URL },
      { name: 'perl', version: `${perlVersion} (embedded)`, license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://www.perl.org/' },
      { name: 'openssl', version: `${opensslVersion} (embedded)`, license: 'OpenSSL + Apache-SSLeay', source: 'https://www.openssl.org/' },
      { name: 'perl modules (CPAN)', version: 'embedded', license: 'Artistic-1.0 or GPL-1.0-or-later', source: 'https://metacpan.org/' },
    ],
  }
  writeFileSync(join(runtimeDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`staged runtime: ${runtimeDir}`)
  console.log('next steps: pnpm runtime:validate --arch arm64 && pnpm runtime:self-test --arch arm64')
}

main()
