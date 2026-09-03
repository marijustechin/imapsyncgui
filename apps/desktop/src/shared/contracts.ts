export const SECURITY_MODES = ['none', 'tls', 'starttls'] as const

export type SecurityMode = (typeof SECURITY_MODES)[number]

export interface ImapEndpoint {
  host: string
  port: number
  security: SecurityMode
  username: string
  password: string
}

export interface MigrationInput {
  source: ImapEndpoint
  destination: ImapEndpoint
}

export type ConnectionTestFailureCode =
  | 'invalid-input'
  | 'dns'
  | 'connection'
  | 'timeout'
  | 'tls'
  | 'authentication'
  | 'protocol'
  | 'internal'

export type ConnectionTestResult =
  | { ok: true; message: string }
  | { ok: false; code: ConnectionTestFailureCode; message: string }

export interface MigrationStartResult {
  ok: boolean
  message: string
}

export interface MigrationCancelResult {
  ok: boolean
  message: string
}

export interface MigrationOutput {
  stream: 'stdout' | 'stderr'
  text: string
}

export type MigrationEndPhase = 'succeeded' | 'failed' | 'cancelled'

export type MigrationLifecycleEvent =
  | { phase: 'succeeded' }
  | { phase: 'failed'; message: string }
  | { phase: 'cancelled' }

export const IPC_CHANNELS = {
  testConnection: 'migration:test-connection',
  startMigration: 'migration:start',
  cancelMigration: 'migration:cancel',
  output: 'migration:output',
  lifecycle: 'migration:lifecycle',
} as const
