import net from 'node:net'
import tls from 'node:tls'
import type { Connection, SocketLayer } from './types'

export function createNodeSocketLayer(): SocketLayer {
  return {
    connect(host, port) {
      return net.connect({ host, port }) as unknown as Connection
    },
    connectTls(host, port) {
      return tls.connect({ host, port }) as unknown as Connection
    },
    startTls(connection, host) {
      return tls.connect({ socket: connection as unknown as net.Socket, servername: host }) as unknown as Connection
    },
  }
}
