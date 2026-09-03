import { describe, expect, it } from 'vitest'
import { classifySocketError, messageForCode } from './errors'

function errorWithCode(code: string): Error {
  return Object.assign(new Error(code), { code })
}

describe('classifySocketError', () => {
  it('maps DNS resolution failures', () => {
    expect(classifySocketError(errorWithCode('ENOTFOUND'))).toBe('dns')
    expect(classifySocketError(errorWithCode('EAI_AGAIN'))).toBe('dns')
  })

  it('maps connection refusal and unreachable hosts', () => {
    expect(classifySocketError(errorWithCode('ECONNREFUSED'))).toBe('connection')
    expect(classifySocketError(errorWithCode('EHOSTUNREACH'))).toBe('connection')
  })

  it('maps socket timeouts', () => {
    expect(classifySocketError(errorWithCode('ETIMEDOUT'))).toBe('timeout')
  })

  it('maps TLS failures', () => {
    expect(classifySocketError(errorWithCode('DEPTH_ZERO_SELF_SIGNED_CERT'))).toBe('tls')
    expect(classifySocketError(errorWithCode('ERR_TLS_CERT_ALTNAME_INVALID'))).toBe('tls')
    expect(classifySocketError(errorWithCode('ERR_SSL_WRONG_VERSION_NUMBER'))).toBe('tls')
  })

  it('maps unknown errors to internal', () => {
    expect(classifySocketError(new Error('something'))).toBe('internal')
    expect(classifySocketError(undefined)).toBe('internal')
  })
})

describe('messageForCode', () => {
  it('never contains credential values', () => {
    const secret = 'supersecret'
    for (const code of ['invalid-input', 'dns', 'connection', 'timeout', 'tls', 'authentication', 'protocol', 'internal'] as const) {
      expect(messageForCode(code)).not.toContain(secret)
    }
  })

  it('returns a message for every failure code', () => {
    for (const code of ['invalid-input', 'dns', 'connection', 'timeout', 'tls', 'authentication', 'protocol', 'internal'] as const) {
      expect(messageForCode(code).length).toBeGreaterThan(0)
    }
  })
})
