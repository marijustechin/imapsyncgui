import { describe, expect, it } from 'vitest'
import { secureWebPreferences } from './security'

describe('secure web preferences', () => {
  it('disables node integration in the renderer', () => {
    expect(secureWebPreferences.nodeIntegration).toBe(false)
  })

  it('enables context isolation', () => {
    expect(secureWebPreferences.contextIsolation).toBe(true)
  })

  it('enables the renderer sandbox', () => {
    expect(secureWebPreferences.sandbox).toBe(true)
  })
})
