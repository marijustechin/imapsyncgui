import { describe, expect, it } from 'vitest'
import { redactSecrets } from './sanitize'

describe('redactSecrets', () => {
  it('redacts every occurrence of a secret', () => {
    const text = 'login with password hunter2 then hunter2 again'
    expect(redactSecrets(text, ['hunter2'])).toBe('login with password [REDACTED] then [REDACTED] again')
  })

  it('redacts multiple secrets', () => {
    const text = 'source: alpha, destination: beta'
    expect(redactSecrets(text, ['alpha', 'beta'])).toBe('source: [REDACTED], destination: [REDACTED]')
  })

  it('leaves unrelated text untouched', () => {
    const text = 'no secrets here'
    expect(redactSecrets(text, ['hunter2'])).toBe('no secrets here')
  })

  it('ignores empty secrets', () => {
    const text = 'nothing to do'
    expect(redactSecrets(text, [''])).toBe('nothing to do')
  })
})
