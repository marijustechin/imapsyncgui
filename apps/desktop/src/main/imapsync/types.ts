import type { MigrationOutput } from '../../shared/contracts'

export type MigrationPhase = 'idle' | 'starting' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type MigrationEndPhase = 'succeeded' | 'failed' | 'cancelled'

export interface MigrationResult {
  phase: MigrationEndPhase
  message: string
}

export type OutputListener = (output: MigrationOutput) => void
export type PhaseListener = (phase: MigrationPhase) => void
export type ResultListener = (result: MigrationResult) => void

export interface MigrationProcess {
  onSpawn(listener: () => void): void
  onError(listener: (error: Error) => void): void
  onExit(listener: (code: number | null, signal: string | null) => void): void
  onData(listener: (chunk: Buffer) => void, stream: 'stdout' | 'stderr'): void
  kill(signal?: NodeJS.Signals | number): boolean
}

export interface LaunchSpec {
  executable: string
  args: string[]
  env?: NodeJS.ProcessEnv
}

export type ProcessLauncher = (spec: LaunchSpec) => MigrationProcess
