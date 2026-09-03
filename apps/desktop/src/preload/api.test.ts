import { describe, expect, it, vi } from 'vitest'
import { createApi } from './api'
import { IPC_CHANNELS, type ImapEndpoint } from '../shared/contracts'

const endpoint: ImapEndpoint = {
  host: 'imap.example.com',
  port: 993,
  security: 'tls',
  username: 'user@example.com',
  password: 'secret',
}

function makeInvoke() {
  return vi.fn()
}

function makeSubscribe() {
  return vi.fn().mockReturnValue(() => undefined)
}

describe('preload API surface', () => {
  it('exposes only the five required operations', () => {
    const api = createApi(makeInvoke(), makeSubscribe())
    expect(Object.keys(api).sort()).toEqual([
      'cancelMigration',
      'onMigrationLifecycle',
      'onMigrationOutput',
      'startMigration',
      'testConnection',
    ])
  })

  it('does not expose generic IPC or Node.js capabilities', () => {
    const api = createApi(makeInvoke(), makeSubscribe())
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('send')
    expect(api).not.toHaveProperty('on')
    expect(api).not.toHaveProperty('ipcRenderer')
    expect(api).not.toHaveProperty('require')
  })

  it('invokes the test-connection channel with the endpoint', async () => {
    const invoke = makeInvoke()
    invoke.mockResolvedValue({ ok: true, message: 'ok' })
    const api = createApi(invoke, makeSubscribe())

    await api.testConnection(endpoint)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.testConnection, endpoint)
  })

  it('invokes the start channel with the migration input', async () => {
    const invoke = makeInvoke()
    invoke.mockResolvedValue({ ok: true, message: 'ok' })
    const api = createApi(invoke, makeSubscribe())

    const input = { source: endpoint, destination: endpoint }

    await api.startMigration(input)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.startMigration, input)
  })

  it('invokes the cancel channel with no arguments', async () => {
    const invoke = makeInvoke()
    invoke.mockResolvedValue({ ok: true, message: 'ok' })
    const api = createApi(invoke, makeSubscribe())

    await api.cancelMigration()

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.cancelMigration)
  })

  it('subscribes to the output channel and forwards the payload', () => {
    const subscribe = makeSubscribe()
    const listener = vi.fn()
    const api = createApi(makeInvoke(), subscribe)

    api.onMigrationOutput(listener)

    expect(subscribe).toHaveBeenCalledWith(IPC_CHANNELS.output, expect.any(Function))

    const forward = subscribe.mock.calls[0][1] as (output: unknown) => void
    forward({ stream: 'stdout', text: 'hello' })

    expect(listener).toHaveBeenCalledWith({ stream: 'stdout', text: 'hello' })
  })

  it('subscribes to the lifecycle channel and forwards the payload', () => {
    const subscribe = makeSubscribe()
    const listener = vi.fn()
    const api = createApi(makeInvoke(), subscribe)

    api.onMigrationLifecycle(listener)

    expect(subscribe).toHaveBeenCalledWith(IPC_CHANNELS.lifecycle, expect.any(Function))

    const forward = subscribe.mock.calls[0][1] as (event: unknown) => void
    forward({ phase: 'cancelled' })

    expect(listener).toHaveBeenCalledWith({ phase: 'cancelled' })
  })
})
