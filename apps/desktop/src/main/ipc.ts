import { ipcMain } from 'electron'
import { IPC_CHANNELS, type MigrationCancelResult, type MigrationStartResult } from '../shared/contracts'
import type { MigrationAdapter } from './imapsync/adapter'
import { testConnectionHandler, type ConnectionTester } from './handlers'
import { formatIssues, validateMigrationInput } from './validation'

export function registerIpcHandlers(adapter: MigrationAdapter, testConnection: ConnectionTester): void {
  ipcMain.handle(IPC_CHANNELS.testConnection, (_event, request: unknown) => testConnectionHandler(request, testConnection))

  ipcMain.handle(IPC_CHANNELS.startMigration, async (_event, request: unknown): Promise<MigrationStartResult> => {
    const result = validateMigrationInput(request)
    if (!result.ok) {
      return { ok: false, message: formatIssues(result.issues) }
    }
    return adapter.start(result.value)
  })

  ipcMain.handle(IPC_CHANNELS.cancelMigration, async (): Promise<MigrationCancelResult> => {
    return adapter.cancel()
  })
}
