import { describe, expect, it } from 'vitest'
import { toLifecycleEvent } from './lifecycle'

describe('toLifecycleEvent', () => {
  it('maps a succeeded result to a succeeded event', () => {
    expect(toLifecycleEvent({ phase: 'succeeded', message: 'Migration completed successfully.' })).toEqual({
      phase: 'succeeded',
    })
  })

  it('maps a cancelled result to a cancelled event', () => {
    expect(toLifecycleEvent({ phase: 'cancelled', message: 'Migration cancelled.' })).toEqual({
      phase: 'cancelled',
    })
  })

  it('maps a failed result to a failed event with its category, message, and exit code', () => {
    expect(
      toLifecycleEvent({
        phase: 'failed',
        code: 'process-failed',
        message: 'The migration did not complete successfully.',
        exitCode: 1,
      }),
    ).toEqual({
      phase: 'failed',
      code: 'process-failed',
      message: 'The migration did not complete successfully.',
      exitCode: 1,
    })
  })

  it('defaults an unclassified failure to internal with no exit code', () => {
    expect(toLifecycleEvent({ phase: 'failed', message: 'boom' })).toEqual({
      phase: 'failed',
      code: 'internal',
      message: 'boom',
      exitCode: null,
    })
  })

  it('never carries an Error object across the mapping', () => {
    const event = toLifecycleEvent({ phase: 'failed', message: 'boom' })
    expect(event).not.toBeInstanceOf(Error)
    expect(Object.keys(event).sort()).toEqual(['code', 'exitCode', 'message', 'phase'])
  })
})
