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

  it('maps a failed result to a failed event with its message', () => {
    expect(toLifecycleEvent({ phase: 'failed', message: 'Migration exited with code 1.' })).toEqual({
      phase: 'failed',
      message: 'Migration exited with code 1.',
    })
  })

  it('never carries an Error object across the mapping', () => {
    const event = toLifecycleEvent({ phase: 'failed', message: 'boom' })
    expect(event).not.toBeInstanceOf(Error)
    expect(Object.keys(event).sort()).toEqual(['message', 'phase'])
  })
})
