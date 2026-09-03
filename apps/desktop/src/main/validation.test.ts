import { describe, expect, it } from 'vitest'
import { type ImapEndpoint } from '../shared/contracts'
import { type ValidationIssue, type ValidationResult, validateEndpoint, validateMigrationInput } from './validation'

const validEndpoint: ImapEndpoint = {
  host: 'imap.example.com',
  port: 993,
  security: 'tls',
  username: 'user@example.com',
  password: 'secret',
}

function issuesOf(result: ValidationResult<unknown>): ValidationIssue[] {
  return result.ok ? [] : result.issues
}

describe('validateEndpoint', () => {
  it('accepts a valid endpoint', () => {
    const result = validateEndpoint(validEndpoint)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(validEndpoint)
    }
  })

  it('rejects an empty host', () => {
    const result = validateEndpoint({ ...validEndpoint, host: '   ' })
    expect(issuesOf(result).some((issue) => issue.field === 'host')).toBe(true)
  })

  it('rejects a missing host', () => {
    const { port, security, username, password } = validEndpoint
    const result = validateEndpoint({ port, security, username, password })
    expect(issuesOf(result).some((issue) => issue.field === 'host')).toBe(true)
  })

  it('rejects a port below 1', () => {
    const result = validateEndpoint({ ...validEndpoint, port: 0 })
    expect(issuesOf(result).some((issue) => issue.field === 'port')).toBe(true)
  })

  it('rejects a port above 65535', () => {
    const result = validateEndpoint({ ...validEndpoint, port: 65536 })
    expect(issuesOf(result).some((issue) => issue.field === 'port')).toBe(true)
  })

  it('rejects a non-integer port', () => {
    const result = validateEndpoint({ ...validEndpoint, port: 993.5 })
    expect(issuesOf(result).some((issue) => issue.field === 'port')).toBe(true)
  })

  it('rejects a string port', () => {
    const result = validateEndpoint({ ...validEndpoint, port: '993' })
    expect(issuesOf(result).some((issue) => issue.field === 'port')).toBe(true)
  })

  it('rejects an empty username', () => {
    const result = validateEndpoint({ ...validEndpoint, username: '' })
    expect(issuesOf(result).some((issue) => issue.field === 'username')).toBe(true)
  })

  it('rejects an empty password', () => {
    const result = validateEndpoint({ ...validEndpoint, password: '' })
    expect(issuesOf(result).some((issue) => issue.field === 'password')).toBe(true)
  })

  it('rejects an invalid security mode', () => {
    const result = validateEndpoint({ ...validEndpoint, security: 'bogus' })
    expect(issuesOf(result).some((issue) => issue.field === 'security')).toBe(true)
  })

  it('rejects a non-object input', () => {
    const result = validateEndpoint('nope')
    expect(issuesOf(result).length).toBeGreaterThan(0)
  })

  it('never includes credential values in messages', () => {
    const result = validateEndpoint({ ...validEndpoint, host: '', password: 'supersecret' })
    const messages = issuesOf(result).map((issue) => issue.message).join(' ')
    expect(messages).not.toContain('supersecret')
    expect(messages).not.toContain('user@example.com')
  })
})

describe('validateMigrationInput', () => {
  it('accepts valid source and destination', () => {
    const input = { source: validEndpoint, destination: validEndpoint }
    const result = validateMigrationInput(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(input)
    }
  })

  it('rejects when the source is invalid', () => {
    const input = { source: { ...validEndpoint, port: 0 }, destination: validEndpoint }
    const result = validateMigrationInput(input)
    expect(issuesOf(result).some((issue) => issue.field === 'source.port')).toBe(true)
  })

  it('rejects when the destination is invalid', () => {
    const input = { source: validEndpoint, destination: { ...validEndpoint, host: '' } }
    const result = validateMigrationInput(input)
    expect(issuesOf(result).some((issue) => issue.field === 'destination.host')).toBe(true)
  })
})
