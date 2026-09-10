#!/usr/bin/env node
// Shared, dependency-free argument/runtime-arch helpers for the runtime
// build/validate/self-test/smoke scripts. Keeps the darwin/win32 runtime-arch
// mapping in one place so the native scripts agree.

import { tmpdir } from 'node:os'

export const RUNTIME_ARCHES = ['darwin-x64', 'darwin-arm64', 'win32-x64']

export function argValue(argv, name) {
  const index = argv.indexOf(name)
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) return true
  return value
}

export function runtimeArchFromArgs(argv, { platform = process.platform, arch = process.arch } = {}) {
  const explicit = argValue(argv, '--runtime-arch')
  if (typeof explicit === 'string' && RUNTIME_ARCHES.includes(explicit)) {
    return explicit
  }

  const platformArg = argValue(argv, '--platform')
  const archArg = argValue(argv, '--arch')

  const effectivePlatform = typeof platformArg === 'string' ? platformArg : platform
  const effectiveArch = typeof archArg === 'string' ? archArg : arch

  if (effectivePlatform === 'darwin') {
    if (effectiveArch === 'x64') return 'darwin-x64'
    if (effectiveArch === 'arm64') return 'darwin-arm64'
    return null
  }

  if (effectivePlatform === 'win32') {
    if (effectiveArch === 'x64') return 'win32-x64'
    return null
  }

  return null
}

export function executableNameFor(runtimeArch) {
  return runtimeArch === 'win32-x64' ? 'imapsync.exe' : 'imapsync'
}

export function expectedBinaryArchFor(runtimeArch) {
  if (runtimeArch === 'darwin-arm64') return 'arm64'
  if (runtimeArch === 'darwin-x64') return 'x86_64'
  return 'AMD64'
}

// Host-isolation baseline: no Homebrew/MacPorts/Strawberry-Perl executable
// paths, no developer Perl configuration. On Windows only the system
// directories are left on PATH so the runtime proves it has no PATH-installed
// imapsync/Perl dependency.
export function isolationEnv(platform = process.platform) {
  if (platform === 'win32') {
    return {
      PATH: 'C:\\Windows\\System32;C:\\Windows',
      SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',
      TEMP: process.env.TEMP ?? tmpdir(),
      TMP: process.env.TMP ?? tmpdir(),
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
    }
  }
  return {
    PATH: '/usr/bin:/bin:/usr/sbin',
    HOME: process.env.HOME ?? '/tmp',
    TMPDIR: tmpdir(),
  }
}
