import type { MigrationInput, SecurityMode } from '../../shared/contracts'

function securityFlags(security: SecurityMode, side: 1 | 2): string[] {
  switch (security) {
    case 'tls':
      return [`--ssl${side}`]
    case 'starttls':
      return [`--tls${side}`]
    case 'none':
      return [`--nossl${side}`, `--notls${side}`]
  }
}

export function buildMigrationArgs(input: MigrationInput): string[] {
  const { source, destination } = input

  return [
    '--host1', source.host,
    '--port1', String(source.port),
    '--user1', source.username,
    ...securityFlags(source.security, 1),
    '--host2', destination.host,
    '--port2', String(destination.port),
    '--user2', destination.username,
    ...securityFlags(destination.security, 2),
    '--noreleasecheck',
  ]
}
