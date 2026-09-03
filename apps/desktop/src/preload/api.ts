import type {
  ConnectionTestResult,
  ImapEndpoint,
  MigrationCancelResult,
  MigrationInput,
  MigrationLifecycleEvent,
  MigrationOutput,
  MigrationStartResult,
} from '../shared/contracts'
import { IPC_CHANNELS } from '../shared/contracts'

export interface PreloadApi {
  testConnection: (endpoint: ImapEndpoint) => Promise<ConnectionTestResult>
  startMigration: (input: MigrationInput) => Promise<MigrationStartResult>
  cancelMigration: () => Promise<MigrationCancelResult>
  onMigrationOutput: (listener: (output: MigrationOutput) => void) => () => void
  onMigrationLifecycle: (listener: (event: MigrationLifecycleEvent) => void) => () => void
}

export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>
export type Subscribe = (channel: string, listener: (...args: unknown[]) => void) => () => void

export function createApi(invoke: Invoke, subscribe: Subscribe): PreloadApi {
  return {
    testConnection: (endpoint) =>
      invoke(IPC_CHANNELS.testConnection, endpoint) as Promise<ConnectionTestResult>,
    startMigration: (input) =>
      invoke(IPC_CHANNELS.startMigration, input) as Promise<MigrationStartResult>,
    cancelMigration: () => invoke(IPC_CHANNELS.cancelMigration) as Promise<MigrationCancelResult>,
    onMigrationOutput: (listener) =>
      subscribe(IPC_CHANNELS.output, (output) => listener(output as MigrationOutput)),
    onMigrationLifecycle: (listener) =>
      subscribe(IPC_CHANNELS.lifecycle, (event) => listener(event as MigrationLifecycleEvent)),
  }
}
