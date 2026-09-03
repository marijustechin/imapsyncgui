import { describe, expect, it, vi } from 'vitest'
import type { ImapEndpoint } from '../shared/contracts'
import { testConnectionHandler } from './handlers'

const endpoint: ImapEndpoint = {
  host: 'imap.example.com',
  port: 993,
  security: 'tls',
  username: 'user@example.com',
  password: 'secret',
}

describe('testConnectionHandler', () => {
  it('rejects invalid input without invoking the network tester', async () => {
    const tester = vi.fn().mockResolvedValue({ ok: true, message: 'ok' })

    const result = await testConnectionHandler({ ...endpoint, port: 0 }, tester)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid-input')
    }
    expect(tester).not.toHaveBeenCalled()
  })

  it('delegates valid input to the network tester', async () => {
    const tester = vi.fn().mockResolvedValue({ ok: true, message: 'ok' })

    const result = await testConnectionHandler(endpoint, tester)

    expect(tester).toHaveBeenCalledWith(endpoint)
    expect(result).toEqual({ ok: true, message: 'ok' })
  })
})
