import type { ConnectionTestResult, ImapEndpoint } from '../../shared/contracts'
import { classifySocketError, ConnectionTestError, messageForCode } from './errors'
import type { Connection, SocketLayer } from './types'

export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000

export interface ConnectionTestOptions {
  timeoutMs?: number
}

interface LineReader {
  nextLine(): Promise<string>
  fail(error: Error): void
}

function createLineReader(connection: Connection): LineReader {
  let buffer = ''
  let terminalError: Error | null = null
  const waiters: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = []

  const fail = (error: Error): void => {
    terminalError = terminalError ?? error
    for (const waiter of waiters.splice(0)) {
      waiter.reject(error)
    }
  }

  connection.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    let index = buffer.indexOf('\r\n')
    while (index !== -1) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const waiter = waiters.shift()
      if (waiter) {
        waiter.resolve(line)
      }
      index = buffer.indexOf('\r\n')
    }
  })
  connection.on('error', (error) => fail(error))
  connection.on('close', () => fail(terminalError ?? new ConnectionTestError('connection')))

  return {
    nextLine() {
      return new Promise<string>((resolve, reject) => {
        if (terminalError) {
          reject(terminalError)
          return
        }
        const index = buffer.indexOf('\r\n')
        if (index !== -1) {
          const line = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          resolve(line)
          return
        }
        waiters.push({ resolve, reject })
      })
    },
    fail,
  }
}

function isOkGreeting(line: string): boolean {
  return /^\* (OK|PREAUTH)\b/.test(line)
}

function quote(value: string): string {
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

async function readTaggedStatus(reader: LineReader, tag: string): Promise<'OK' | 'NO' | 'BAD'> {
  for (;;) {
    const line = await reader.nextLine()
    if (line.startsWith(tag + ' ')) {
      const rest = line.slice(tag.length + 1)
      if (rest.startsWith('OK')) {
        return 'OK'
      }
      if (rest.startsWith('NO')) {
        return 'NO'
      }
      if (rest.startsWith('BAD')) {
        return 'BAD'
      }
      throw new ConnectionTestError('protocol')
    }
    if (line.startsWith('*')) {
      continue
    }
    throw new ConnectionTestError('protocol')
  }
}

async function runTest(endpoint: ImapEndpoint, layer: SocketLayer, timeoutMs: number): Promise<void> {
  const { host, port, security, username, password } = endpoint

  let connection: Connection = security === 'tls'
    ? layer.connectTls(host, port)
    : layer.connect(host, port)

  let reader = createLineReader(connection)

  const onTimeout = (): void => {
    reader.fail(new ConnectionTestError('timeout'))
    connection.destroy()
  }
  connection.setTimeout(timeoutMs)
  connection.on('timeout', onTimeout)

  try {
    const greeting = await reader.nextLine()
    if (!isOkGreeting(greeting)) {
      throw new ConnectionTestError('protocol')
    }

    if (security === 'starttls') {
      connection.write('a0 STARTTLS\r\n')
      const status = await readTaggedStatus(reader, 'a0')
      if (status !== 'OK') {
        throw new ConnectionTestError('tls')
      }

      connection = layer.startTls(connection, host)
      reader = createLineReader(connection)
      connection.setTimeout(timeoutMs)
      connection.on('timeout', onTimeout)

      const tlsGreeting = await reader.nextLine()
      if (!isOkGreeting(tlsGreeting)) {
        throw new ConnectionTestError('protocol')
      }
    }

    connection.write(`a1 LOGIN ${quote(username)} ${quote(password)}\r\n`)
    const status = await readTaggedStatus(reader, 'a1')

    if (status === 'OK') {
      return
    }
    if (status === 'NO') {
      throw new ConnectionTestError('authentication')
    }
    throw new ConnectionTestError('protocol')
  } finally {
    connection.destroy()
  }
}

export async function testConnection(
  endpoint: ImapEndpoint,
  layer: SocketLayer,
  options: ConnectionTestOptions = {},
): Promise<ConnectionTestResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS

  try {
    await runTest(endpoint, layer, timeoutMs)
    return { ok: true, message: 'Connection and authentication succeeded.' }
  } catch (error) {
    const code = error instanceof ConnectionTestError ? error.kind : classifySocketError(error)
    return { ok: false, code, message: messageForCode(code) }
  }
}
