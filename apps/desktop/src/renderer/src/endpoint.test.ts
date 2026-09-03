import { describe, expect, it } from 'vitest'
import type { SecurityMode } from '../../shared/contracts'
import {
  CONNECTION_FAILURE_MESSAGES,
  DEFAULT_PORTS,
  emptyEndpointValues,
  endpointsEqual,
  hasErrors,
  toEndpoint,
  validateEndpointValues,
} from './endpoint'

describe('DEFAULT_PORTS', () => {
  it('uses 993 for TLS and 143 for STARTTLS and plaintext', () => {
    expect(DEFAULT_PORTS.tls).toBe(993)
    expect(DEFAULT_PORTS.starttls).toBe(143)
    expect(DEFAULT_PORTS.none).toBe(143)
  })
})

describe('emptyEndpointValues', () => {
  it('defaults to TLS on port 993', () => {
    const values = emptyEndpointValues()
    expect(values.security).toBe('tls')
    expect(values.port).toBe('993')
  })
})

describe('validateEndpointValues', () => {
  const valid = { host: 'imap.example.com', port: '993', security: 'tls' as SecurityMode, username: 'user', password: 'pw' }

  it('accepts a valid endpoint', () => {
    expect(hasErrors(validateEndpointValues(valid))).toBe(false)
  })

  it('rejects an empty host', () => {
    expect(validateEndpointValues({ ...valid, host: '   ' }).host).toBeDefined()
  })

  it('rejects an empty username', () => {
    expect(validateEndpointValues({ ...valid, username: '' }).username).toBeDefined()
  })

  it('rejects an empty password', () => {
    expect(validateEndpointValues({ ...valid, password: '' }).password).toBeDefined()
  })

  it('rejects a non-integer port', () => {
    expect(validateEndpointValues({ ...valid, port: '99.5' }).port).toBeDefined()
  })

  it('rejects a port below 1', () => {
    expect(validateEndpointValues({ ...valid, port: '0' }).port).toBeDefined()
  })

  it('rejects a port above 65535', () => {
    expect(validateEndpointValues({ ...valid, port: '65536' }).port).toBeDefined()
  })
})

describe('toEndpoint', () => {
  it('converts form values into an ImapEndpoint', () => {
    const values = { host: ' imap.example.com ', port: '993', security: 'tls' as SecurityMode, username: 'u', password: 'p' }
    expect(toEndpoint(values)).toEqual({
      host: 'imap.example.com',
      port: 993,
      security: 'tls',
      username: 'u',
      password: 'p',
    })
  })
})

describe('endpointsEqual', () => {
  const base = { host: 'h', port: '993', security: 'tls' as SecurityMode, username: 'u', password: 'p' }

  it('is true for identical values', () => {
    expect(endpointsEqual(base, { ...base })).toBe(true)
  })

  it('is false when any value differs', () => {
    expect(endpointsEqual(base, { ...base, password: 'other' })).toBe(false)
  })
})

describe('CONNECTION_FAILURE_MESSAGES', () => {
  it('maps every failure code to a non-empty, credential-free message', () => {
    for (const code of Object.keys(CONNECTION_FAILURE_MESSAGES)) {
      const message = CONNECTION_FAILURE_MESSAGES[code as keyof typeof CONNECTION_FAILURE_MESSAGES]
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toContain('secret')
    }
  })
})
