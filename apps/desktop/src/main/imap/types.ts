export interface Connection {
  write(data: string): void
  on(event: 'data', listener: (chunk: Buffer) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  on(event: 'close', listener: () => void): void
  on(event: 'timeout', listener: () => void): void
  setTimeout(ms: number): void
  destroy(): void
}

export interface SocketLayer {
  connect(host: string, port: number): Connection
  connectTls(host: string, port: number): Connection
  startTls(connection: Connection, host: string): Connection
}
