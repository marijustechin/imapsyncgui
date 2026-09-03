import { describe, expect, it } from 'vitest'
import type { ImapEndpoint } from '../../shared/contracts'
import { DEFAULT_CONNECTION_TIMEOUT_MS, testConnection } from './client'
import type { Connection, SocketLayer } from './types'

class FakeConnection {
  written: string[] = []
  destroyed = false
  timeoutMs: number | null = null
  listeners: Record<string, Array<(...args: unknown[]) => void>> = {}

  write(data: string): void {
    this.written.push(data)
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    ;(this.listeners[event] ??= []).push(listener)
  }

  setTimeout(ms: number): void {
    this.timeoutMs = ms
  }

  destroy(): void {
    this.destroyed = true
    for (const listener of this.listeners.close ?? []) {
      listener()
    }
  }

  emitData(line: string): void {
    for (const listener of this.listeners.data ?? []) {
      listener(Buffer.from(line, 'utf8'))
    }
  }

  emitError(error: Error): void {
    for (const listener of this.listeners.error ?? []) {
      listener(error)
    }
  }

  emitTimeout(): void {
    for (const listener of this.listeners.timeout ?? []) {
      listener()
    }
  }
}

function createFakeLayer() {
  const connections: FakeConnection[] = []
  const layer: SocketLayer = {
    connect: () => {
      const connection = new FakeConnection()
      connections.push(connection)
      return connection as unknown as Connection
    },
    connectTls: () => {
      const connection = new FakeConnection()
      connections.push(connection)
      return connection as unknown as Connection
    },
    startTls: () => {
      const connection = new FakeConnection()
      connections.push(connection)
      return connection as unknown as Connection
    },
  }
  return { layer, connections }
}

function endpoint(overrides: Partial<ImapEndpoint> = {}): ImapEndpoint {
  return {
    host: 'imap.example.com',
    port: 993,
    security: 'tls',
    username: 'user@example.com',
    password: 'secret123',
    ...overrides,
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('testConnection', () => {
  it('succeeds on implicit TLS when greeting and login succeed', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'tls' }), layer)
    connections[0].emitData('* OK imap ready\r\n')
    await flush()
    connections[0].emitData('a1 OK LOGIN completed\r\n')

    const result = await promise

    expect(result).toEqual({ ok: true, message: 'Connection and authentication succeeded.' })
    expect(connections[0].written.some((w) => w.startsWith('a1 LOGIN '))).toBe(true)
  })

  it('succeeds over plaintext without STARTTLS', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'none', port: 143 }), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 OK done\r\n')

    const result = await promise

    expect(result.ok).toBe(true)
    expect(connections).toHaveLength(1)
  })

  it('upgrades with STARTTLS, issues CAPABILITY, and does not wait for a second greeting', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls', port: 143 }), layer)

    connections[0].emitData('* OK ready\r\n')
    await flush()
    expect(connections[0].written.some((w) => w.includes('STARTTLS'))).toBe(true)

    connections[0].emitData('a1 OK begin TLS\r\n')
    await flush()

    // No second greeting is sent; the client must proceed to CAPABILITY.
    expect(connections[1].written.some((w) => w.startsWith('a2 CAPABILITY'))).toBe(true)

    connections[1].emitData('* CAPABILITY IMAP4rev1 STARTTLS AUTH=PLAIN\r\n')
    await flush()
    connections[1].emitData('a2 OK done\r\n')
    await flush()

    expect(connections[1].written.some((w) => w.startsWith('a3 LOGIN '))).toBe(true)
    connections[1].emitData('a3 OK done\r\n')

    const result = await promise

    expect(result.ok).toBe(true)
  })

  it('issues LOGIN only after the TLS upgrade completes', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls', port: 143 }), layer)

    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 OK begin TLS\r\n')
    await flush()

    // LOGIN must not have been sent on the plaintext connection.
    expect(connections[0].written.some((w) => w.startsWith('a3 LOGIN ') || w.includes('LOGIN'))).toBe(false)

    connections[1].emitData('a2 OK done\r\n')
    await flush()
    expect(connections[1].written.some((w) => w.startsWith('a3 LOGIN '))).toBe(true)

    connections[1].emitData('a3 OK done\r\n')
    await promise
  })

  it('maps authentication failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 NO authentication failed\r\n')

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'authentication', message: 'Authentication failed. Check the username and password.' })
  })

  it('maps a malformed greeting to a protocol failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer)
    connections[0].emitData('* BYE service unavailable\r\n')

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'protocol', message: 'The server returned an unexpected response.' })
  })

  it('maps a rejected STARTTLS to a TLS failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls' }), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 NO STARTTLS not supported\r\n')

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'tls', message: 'The TLS connection could not be established.' })
  })

  it('maps a malformed STARTTLS response to a protocol failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls' }), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('unexpected garbage\r\n')

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'protocol', message: 'The server returned an unexpected response.' })
  })

  it('maps a TLS upgrade failure to a TLS failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls' }), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 OK begin TLS\r\n')
    await flush()
    connections[1].emitError(Object.assign(new Error('handshake failure'), { code: 'ERR_SSL_WRONG_VERSION_NUMBER' }))

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'tls', message: 'The TLS connection could not be established.' })
  })

  it('maps a timeout during STARTTLS', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls' }), layer, { timeoutMs: 1000 })
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitTimeout()

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'timeout', message: 'The connection timed out.' })
  })

  it('maps an idle timeout', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer, { timeoutMs: 1000 })
    connections[0].emitTimeout()

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'timeout', message: 'The connection timed out.' })
  })

  it('maps DNS resolution failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer)
    connections[0].emitError(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'dns', message: 'Could not resolve the server host name.' })
  })

  it('maps a TLS handshake failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer)
    connections[0].emitError(Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }))

    const result = await promise

    expect(result).toEqual({ ok: false, code: 'tls', message: 'The TLS connection could not be established.' })
  })

  it('destroys the connection on completion', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 OK done\r\n')
    await promise

    expect(connections[0].destroyed).toBe(true)
  })

  it('destroys the connection on failure', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint(), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 NO bad credentials\r\n')
    await promise

    expect(connections[0].destroyed).toBe(true)
  })

  it('never exposes credentials in returned results', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ password: 'supersecret' }), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 NO denied\r\n')

    const result = await promise

    expect(JSON.stringify(result)).not.toContain('supersecret')
  })

  it('never exposes credentials in STARTTLS failures', async () => {
    const { layer, connections } = createFakeLayer()

    const promise = testConnection(endpoint({ security: 'starttls', password: 'supersecret' }), layer)
    connections[0].emitData('* OK ready\r\n')
    await flush()
    connections[0].emitData('a1 NO rejected\r\n')

    const result = await promise

    expect(JSON.stringify(result)).not.toContain('supersecret')
  })

  it('uses the documented default timeout', async () => {
    const { layer, connections } = createFakeLayer()

    void testConnection(endpoint(), layer)

    expect(DEFAULT_CONNECTION_TIMEOUT_MS).toBeGreaterThan(0)
    expect(connections[0].timeoutMs).toBe(DEFAULT_CONNECTION_TIMEOUT_MS)
  })
})
