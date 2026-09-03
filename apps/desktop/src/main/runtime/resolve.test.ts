import { describe, expect, it } from 'vitest'
import { resolveRuntime } from './resolve'

describe('resolveRuntime', () => {
  it('uses the IMAPSYNC_EXECUTABLE override in development', () => {
    const result = resolveRuntime({
      isPackaged: false,
      arch: 'x64',
      env: { IMAPSYNC_EXECUTABLE: '/opt/imapsync/imapsync' },
      resourcesPath: '/resources',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('development-override')
      expect(result.runtime.executable).toBe('/opt/imapsync/imapsync')
      expect(result.runtime.prefixArgs).toEqual([])
    }
  })

  it('falls back to PATH in development when no override is set', () => {
    const result = resolveRuntime({ isPackaged: false, arch: 'x64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('development-path')
      expect(result.runtime.executable).toBe('imapsync')
      expect(result.runtime.prefixArgs).toEqual([])
    }
  })

  it('resolves the bundled x64 runtime in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, arch: 'x64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.executable).toBe('/resources/runtime/darwin-x64/bin/imapsync')
      expect(result.runtime.prefixArgs).toEqual([])
      expect(result.runtime.runtimeArch).toBe('darwin-x64')
    }
  })

  it('resolves the bundled arm64 runtime in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, arch: 'arm64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.executable).toBe('/resources/runtime/darwin-arm64/bin/imapsync')
      expect(result.runtime.prefixArgs).toEqual([])
      expect(result.runtime.runtimeArch).toBe('darwin-arm64')
    }
  })

  it('does not fall back to PATH or the override in packaged mode', () => {
    const result = resolveRuntime({
      isPackaged: true,
      arch: 'x64',
      env: { IMAPSYNC_EXECUTABLE: '/evil/imapsync' },
      resourcesPath: '/resources',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.executable).toBe('/resources/runtime/darwin-x64/bin/imapsync')
    }
  })

  it('rejects an unsupported architecture in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, arch: 'ia32', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('architecture-mismatch')
    }
  })

  it('never uses PATH or IMAPSYNC_EXECUTABLE for arm64 packaged mode', () => {
    const result = resolveRuntime({
      isPackaged: true,
      arch: 'arm64',
      env: { IMAPSYNC_EXECUTABLE: '/evil/imapsync', PATH: '/homebrew/bin' },
      resourcesPath: '/resources',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.executable).toBe('/resources/runtime/darwin-arm64/bin/imapsync')
      expect(result.runtime.runtimeArch).toBe('darwin-arm64')
    }
  })
})
