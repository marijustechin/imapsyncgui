import { describe, expect, it } from 'vitest'
import {
  platformForRuntimeArch,
  runtimeArchFor,
  runtimeExecutableName,
  type RuntimeArch,
} from './arch'

describe('runtimeArchFor', () => {
  it('maps darwin x64 to darwin-x64', () => {
    expect(runtimeArchFor('darwin', 'x64')).toBe('darwin-x64')
  })

  it('maps darwin arm64 to darwin-arm64', () => {
    expect(runtimeArchFor('darwin', 'arm64')).toBe('darwin-arm64')
  })

  it('maps win32 x64 to win32-x64', () => {
    expect(runtimeArchFor('win32', 'x64')).toBe('win32-x64')
  })

  it('rejects unsupported win32 architectures (ia32, arm64)', () => {
    expect(runtimeArchFor('win32', 'ia32')).toBeNull()
    expect(runtimeArchFor('win32', 'arm64')).toBeNull()
  })

  it('rejects unsupported darwin architectures', () => {
    expect(runtimeArchFor('darwin', 'ia32')).toBeNull()
  })

  it('rejects unsupported platforms (linux)', () => {
    expect(runtimeArchFor('linux', 'x64')).toBeNull()
  })
})

describe('platformForRuntimeArch', () => {
  it('maps win32-x64 to win32', () => {
    expect(platformForRuntimeArch('win32-x64')).toBe('win32')
  })

  it('maps darwin runtime directories to darwin', () => {
    expect(platformForRuntimeArch('darwin-x64')).toBe('darwin')
    expect(platformForRuntimeArch('darwin-arm64')).toBe('darwin')
  })
})

describe('runtimeExecutableName', () => {
  it('uses imapsync.exe on Windows', () => {
    expect(runtimeExecutableName('win32-x64')).toBe('imapsync.exe')
  })

  it('uses imapsync on macOS', () => {
    expect(runtimeExecutableName('darwin-x64')).toBe('imapsync')
    expect(runtimeExecutableName('darwin-arm64')).toBe('imapsync')
  })
})

describe('runtime matrix', () => {
  it('covers exactly the supported runtime targets', () => {
    const supported: Array<[NodeJS.Platform, NodeJS.Architecture, RuntimeArch]> = [
      ['darwin', 'x64', 'darwin-x64'],
      ['darwin', 'arm64', 'darwin-arm64'],
      ['win32', 'x64', 'win32-x64'],
    ]
    for (const [platform, arch, expected] of supported) {
      expect(runtimeArchFor(platform, arch)).toBe(expected)
    }
  })
})
