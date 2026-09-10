import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

interface ResolveResult {
  ok: boolean
  targetPlatform?: string
  targetArch?: string
  runtimeArch?: string
  error?: string
}

interface RuntimeHelpers {
  requestedPlatformFromArgv: (argv: string[]) => string | null
  requestedArchFromArgv: (argv: string[]) => string | null
  runtimeArchFor: (platform: string, arch: string) => string | null
  resolvePackagingTarget: (options: {
    env: Record<string, string | undefined>
    argv: string[]
    hostPlatform: string
  }) => ResolveResult
}

const require = createRequire(import.meta.url)
const helpers = require('../../electron-builder-runtime.cjs') as RuntimeHelpers

const CLI = ['/path/to/node', '/path/to/electron-builder/cli.js']

describe('requestedPlatformFromArgv', () => {
  it('detects the Windows target from long and short flags', () => {
    expect(helpers.requestedPlatformFromArgv([...CLI, '--win', '--x64'])).toBe('win32')
    expect(helpers.requestedPlatformFromArgv([...CLI, '--win32'])).toBe('win32')
    expect(helpers.requestedPlatformFromArgv([...CLI, '-w'])).toBe('win32')
  })

  it('detects the macOS target from long and short flags', () => {
    expect(helpers.requestedPlatformFromArgv([...CLI, '--mac', '--arm64'])).toBe('darwin')
    expect(helpers.requestedPlatformFromArgv([...CLI, '--macos'])).toBe('darwin')
    expect(helpers.requestedPlatformFromArgv([...CLI, '-m'])).toBe('darwin')
  })

  it('ignores unrelated flags and arguments', () => {
    expect(helpers.requestedPlatformFromArgv([...CLI, '--x64', '--config', 'x.cjs'])).toBeNull()
    expect(helpers.requestedPlatformFromArgv([])).toBeNull()
  })
})

describe('requestedArchFromArgv', () => {
  it('detects the requested architecture', () => {
    expect(helpers.requestedArchFromArgv([...CLI, '--x64'])).toBe('x64')
    expect(helpers.requestedArchFromArgv([...CLI, '--arm64'])).toBe('arm64')
    expect(helpers.requestedArchFromArgv([...CLI, '--ia32'])).toBe('ia32')
  })

  it('ignores unrelated flags', () => {
    expect(helpers.requestedArchFromArgv([...CLI, '--win', '--config', 'x.cjs'])).toBeNull()
    expect(helpers.requestedArchFromArgv([])).toBeNull()
  })
})

describe('runtimeArchFor', () => {
  it('maps supported platform/arch combinations to runtime directories', () => {
    expect(helpers.runtimeArchFor('darwin', 'x64')).toBe('darwin-x64')
    expect(helpers.runtimeArchFor('darwin', 'arm64')).toBe('darwin-arm64')
    expect(helpers.runtimeArchFor('win32', 'x64')).toBe('win32-x64')
  })

  it('rejects unsupported platform/arch combinations', () => {
    expect(helpers.runtimeArchFor('win32', 'arm64')).toBeNull()
    expect(helpers.runtimeArchFor('win32', 'ia32')).toBeNull()
    expect(helpers.runtimeArchFor('linux', 'x64')).toBeNull()
    expect(helpers.runtimeArchFor('darwin', 'ia32')).toBeNull()
  })
})

describe('resolvePackagingTarget', () => {
  it('bundles win32-x64 for a native Windows build', () => {
    const result = helpers.resolvePackagingTarget({
      env: {},
      argv: [...CLI, '--win', '--x64'],
      hostPlatform: 'win32',
    })
    expect(result).toEqual({ ok: true, targetPlatform: 'win32', targetArch: 'x64', runtimeArch: 'win32-x64' })
  })

  it('bundles darwin-x64/arm64 for native macOS builds', () => {
    expect(
      helpers.resolvePackagingTarget({ env: {}, argv: [...CLI, '--mac', '--x64'], hostPlatform: 'darwin' }),
    ).toEqual({ ok: true, targetPlatform: 'darwin', targetArch: 'x64', runtimeArch: 'darwin-x64' })
    expect(
      helpers.resolvePackagingTarget({ env: {}, argv: [...CLI, '--mac', '--arm64'], hostPlatform: 'darwin' }),
    ).toEqual({ ok: true, targetPlatform: 'darwin', targetArch: 'arm64', runtimeArch: 'darwin-arm64' })
  })

  it('refuses an implicit cross-host Windows build instead of bundling the host runtime', () => {
    const result = helpers.resolvePackagingTarget({
      env: {},
      argv: [...CLI, '--win', '--x64'],
      hostPlatform: 'darwin',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/cross-host/i)
    expect(result.error).toContain('win32-x64')
    expect(result.runtimeArch).toBeUndefined()
  })

  it('allows an explicit TARGET_PLATFORM cross-host override with the target runtime', () => {
    const result = helpers.resolvePackagingTarget({
      env: { TARGET_PLATFORM: 'win32', TARGET_ARCH: 'x64' },
      argv: [...CLI, '--win', '--x64'],
      hostPlatform: 'darwin',
    })
    expect(result).toEqual({ ok: true, targetPlatform: 'win32', targetArch: 'x64', runtimeArch: 'win32-x64' })
  })

  it('honours an explicit TARGET_PLATFORM without a CLI flag', () => {
    const result = helpers.resolvePackagingTarget({
      env: { TARGET_PLATFORM: 'win32' },
      argv: [...CLI],
      hostPlatform: 'darwin',
    })
    expect(result.ok).toBe(true)
    expect(result.runtimeArch).toBe('win32-x64')
  })

  it('rejects a CLI target that conflicts with TARGET_PLATFORM', () => {
    const result = helpers.resolvePackagingTarget({
      env: { TARGET_PLATFORM: 'darwin' },
      argv: [...CLI, '--win'],
      hostPlatform: 'win32',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/conflicting/i)
  })

  it('rejects a CLI architecture that conflicts with TARGET_ARCH', () => {
    const result = helpers.resolvePackagingTarget({
      env: { TARGET_PLATFORM: 'darwin', TARGET_ARCH: 'x64' },
      argv: [...CLI, '--mac', '--arm64'],
      hostPlatform: 'darwin',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/conflicting/i)
  })

  it('rejects unsupported target architectures', () => {
    const result = helpers.resolvePackagingTarget({
      env: { TARGET_PLATFORM: 'win32', TARGET_ARCH: 'arm64' },
      argv: [...CLI, '--win', '--arm64'],
      hostPlatform: 'win32',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/unsupported target platform\/arch/i)
  })

  it('falls back to the host platform when no target is specified', () => {
    const result = helpers.resolvePackagingTarget({ env: {}, argv: [...CLI], hostPlatform: 'darwin' })
    expect(result.ok).toBe(true)
    expect(result.runtimeArch).toBe('darwin-x64')
  })
})
