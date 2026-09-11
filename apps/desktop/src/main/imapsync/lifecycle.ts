import type { MigrationLifecycleEvent } from '../../shared/contracts'
import type { MigrationResult } from './types'

export function toLifecycleEvent(result: MigrationResult): MigrationLifecycleEvent {
  if (result.phase === 'failed') {
    return {
      phase: 'failed',
      code: result.code ?? 'internal',
      message: result.message,
      exitCode: result.exitCode ?? null,
    }
  }
  if (result.phase === 'cancelled') {
    return { phase: 'cancelled' }
  }
  return { phase: 'succeeded' }
}
