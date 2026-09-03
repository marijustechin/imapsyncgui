import { describe, expect, it } from 'vitest'
import { messageForRuntimeFailure } from './errors'

describe('messageForRuntimeFailure', () => {
  it('returns a message for every failure code', () => {
    for (const code of ['runtime-missing', 'architecture-mismatch', 'runtime-invalid', 'runtime-startup-failure'] as const) {
      expect(messageForRuntimeFailure(code).length).toBeGreaterThan(0)
    }
  })

  it('never contains sensitive host information', () => {
    for (const code of ['runtime-missing', 'architecture-mismatch', 'runtime-invalid', 'runtime-startup-failure'] as const) {
      expect(messageForRuntimeFailure(code)).not.toContain('/opt/homebrew')
      expect(messageForRuntimeFailure(code)).not.toContain('/usr/local')
      expect(messageForRuntimeFailure(code)).not.toContain('Cellar')
    }
  })
})
