import { describe, expect, it } from 'vitest'
import type { ImapEndpoint, MigrationInput } from '../../shared/contracts'
import { buildMigrationArgs } from './arguments'

const source: ImapEndpoint = {
  host: 'imap.source.example.com',
  port: 993,
  security: 'tls',
  username: 'source-user',
  password: 'source-secret',
}

const destination: ImapEndpoint = {
  host: 'imap.destination.example.com',
  port: 143,
  security: 'starttls',
  username: 'dest-user',
  password: 'dest-secret',
}

function input(overrides?: Partial<{ source: Partial<ImapEndpoint>; destination: Partial<ImapEndpoint> }>): MigrationInput {
  return {
    source: { ...source, ...overrides?.source },
    destination: { ...destination, ...overrides?.destination },
  }
}

describe('buildMigrationArgs', () => {
  it('generates deterministic arguments for source and destination', () => {
    expect(buildMigrationArgs(input())).toEqual([
      '--host1', 'imap.source.example.com',
      '--port1', '993',
      '--user1', 'source-user',
      '--ssl1',
      '--host2', 'imap.destination.example.com',
      '--port2', '143',
      '--user2', 'dest-user',
      '--tls2',
      '--noreleasecheck',
    ])
  })

  it('maps implicit TLS to --ssl and STARTTLS to --tls', () => {
    const args = buildMigrationArgs(input({ source: { security: 'tls' }, destination: { security: 'starttls' } }))
    expect(args).toContain('--ssl1')
    expect(args).toContain('--tls2')
    expect(args).not.toContain('--ssl2')
    expect(args).not.toContain('--tls1')
  })

  it('maps no encryption to --nossl and --notls', () => {
    const args = buildMigrationArgs(input({ source: { security: 'none' }, destination: { security: 'none' } }))
    expect(args).toEqual(expect.arrayContaining(['--nossl1', '--notls1', '--nossl2', '--notls2']))
  })

  it('never includes passwords in the argument list', () => {
    const args = buildMigrationArgs(input())
    expect(args).not.toContain('source-secret')
    expect(args).not.toContain('dest-secret')
  })

  it('passes only supported imapsync options', () => {
    const flags = buildMigrationArgs(input()).filter((arg) => arg.startsWith('--'))
    expect(flags).toEqual(['--host1', '--port1', '--user1', '--ssl1', '--host2', '--port2', '--user2', '--tls2', '--noreleasecheck'])
  })

  it('keeps a malicious host value as a value, not as a flag', () => {
    const args = buildMigrationArgs(input({ source: { host: '--ssl2' } }))
    expect(args[0]).toBe('--host1')
    expect(args[1]).toBe('--ssl2')
  })

  it('keeps a malicious username with shell syntax as a single value', () => {
    const malicious = 'user; rm -rf /'
    const args = buildMigrationArgs(input({ source: { username: malicious } }))
    expect(args).toContain(malicious)
    expect(args[args.indexOf(malicious) - 1]).toBe('--user1')
  })
})
