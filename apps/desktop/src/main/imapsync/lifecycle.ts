import type { MigrationLifecycleEvent } from '../../shared/contracts'
import type { MigrationResult } from './types'

export function toLifecycleEvent(result: MigrationResult): MigrationLifecycleEvent {
  if (result.phase === 'failed') {
    return { phase: 'failed', message: result.message }
  }
  if (result.phase === 'cancelled') {
    return { phase: 'cancelled' }
  }
  return { phase: 'succeeded' }
}
