import { describe, expect, it } from 'vitest'
import { archToRuntimeArch } from './arch'

describe('archToRuntimeArch', () => {
  it('maps x64 to darwin-x64', () => {
    expect(archToRuntimeArch('x64')).toBe('darwin-x64')
  })

  it('maps arm64 to darwin-arm64', () => {
    expect(archToRuntimeArch('arm64')).toBe('darwin-arm64')
  })

  it('rejects unsupported architectures', () => {
    expect(archToRuntimeArch('ia32')).toBeNull()
  })
})
