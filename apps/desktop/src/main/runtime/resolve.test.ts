import { describe, expect, it } from 'vitest'
import { resolveRuntime } from './resolve'

describe('resolveRuntime', () => {
  it('uses the IMAPSYNC_EXECUTABLE override in development', () => {
    const result = resolveRuntime({
      isPackaged: false,
      platform: 'darwin',
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
    const result = resolveRuntime({ isPackaged: false, platform: 'darwin', arch: 'x64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('development-path')
      expect(result.runtime.executable).toBe('imapsync')
      expect(result.runtime.prefixArgs).toEqual([])
    }
  })

  it('resolves the bundled x64 runtime in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, platform: 'darwin', arch: 'x64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.executable).toMatch(/runtime[/\\]darwin-x64[/\\]bin[/\\]imapsync$/)
      expect(result.runtime.prefixArgs).toEqual([])
      expect(result.runtime.runtimeArch).toBe('darwin-x64')
    }
  })

  it('resolves the bundled arm64 runtime in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, platform: 'darwin', arch: 'arm64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.executable).toMatch(/runtime[/\\]darwin-arm64[/\\]bin[/\\]imapsync$/)
      expect(result.runtime.prefixArgs).toEqual([])
      expect(result.runtime.runtimeArch).toBe('darwin-arm64')
    }
  })

  it('resolves the bundled win32-x64 runtime in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, platform: 'win32', arch: 'x64', env: {}, resourcesPath: 'C:\\resources' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.runtimeArch).toBe('win32-x64')
      expect(result.runtime.executable).toMatch(/runtime[/\\]win32-x64[/\\]bin[/\\]imapsync\.exe$/)
      expect(result.runtime.prefixArgs).toEqual([])
    }
  })

  it('does not fall back to PATH or the override in packaged mode', () => {
    const result = resolveRuntime({
      isPackaged: true,
      platform: 'darwin',
      arch: 'x64',
      env: { IMAPSYNC_EXECUTABLE: '/evil/imapsync' },
      resourcesPath: '/resources',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.executable).toMatch(/runtime[/\\]darwin-x64[/\\]bin[/\\]imapsync$/)
    }
  })

  it('rejects an unsupported architecture in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, platform: 'darwin', arch: 'ia32', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('architecture-mismatch')
    }
  })

  it('rejects an unsupported Windows architecture in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, platform: 'win32', arch: 'arm64', env: {}, resourcesPath: 'C:\\resources' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('architecture-mismatch')
    }
  })

  it('rejects an unsupported platform in packaged mode', () => {
    const result = resolveRuntime({ isPackaged: true, platform: 'linux', arch: 'x64', env: {}, resourcesPath: '/resources' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('architecture-mismatch')
    }
  })

  it('never uses PATH or IMAPSYNC_EXECUTABLE for arm64 packaged mode', () => {
    const result = resolveRuntime({
      isPackaged: true,
      platform: 'darwin',
      arch: 'arm64',
      env: { IMAPSYNC_EXECUTABLE: '/evil/imapsync', PATH: '/homebrew/bin' },
      resourcesPath: '/resources',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.executable).toMatch(/runtime[/\\]darwin-arm64[/\\]bin[/\\]imapsync$/)
      expect(result.runtime.runtimeArch).toBe('darwin-arm64')
    }
  })

  it('never uses PATH or IMAPSYNC_EXECUTABLE for win32 packaged mode', () => {
    const result = resolveRuntime({
      isPackaged: true,
      platform: 'win32',
      arch: 'x64',
      env: { IMAPSYNC_EXECUTABLE: 'C:\\evil\\imapsync.exe', PATH: 'C:\\strawberry\\perl\\bin' },
      resourcesPath: 'C:\\resources',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtime.mode).toBe('packaged')
      expect(result.runtime.runtimeArch).toBe('win32-x64')
      expect(result.runtime.executable).toMatch(/runtime[/\\]win32-x64[/\\]bin[/\\]imapsync\.exe$/)
    }
  })
})
