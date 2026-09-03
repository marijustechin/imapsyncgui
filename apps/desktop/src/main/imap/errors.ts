import type { ConnectionTestFailureCode } from '../../shared/contracts'

const DNS_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'EAI_FAIL',
  'EAI_NODATA',
  'EAI_NONAME',
  'ESERVFAIL',
  'ENODATA',
])

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EHOSTDOWN',
  'ENETDOWN',
])

const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

export class ConnectionTestError extends Error {
  constructor(readonly kind: ConnectionTestFailureCode) {
    super(kind)
    this.name = 'ConnectionTestError'
  }
}

export function classifySocketError(error: unknown): ConnectionTestFailureCode {
  const code = typeof (error as NodeJS.ErrnoException)?.code === 'string'
    ? (error as NodeJS.ErrnoException).code as string
    : ''

  if (DNS_CODES.has(code)) {
    return 'dns'
  }
  if (CONNECTION_CODES.has(code)) {
    return 'connection'
  }
  if (code === 'ETIMEDOUT') {
    return 'timeout'
  }
  if (TLS_CODES.has(code) || code.startsWith('ERR_SSL') || code.startsWith('ERR_TLS')) {
    return 'tls'
  }
  return 'internal'
}

export function messageForCode(code: ConnectionTestFailureCode): string {
  switch (code) {
    case 'invalid-input':
      return 'Invalid input.'
    case 'dns':
      return 'Could not resolve the server host name.'
    case 'connection':
      return 'Could not connect to the server.'
    case 'timeout':
      return 'The connection timed out.'
    case 'tls':
      return 'The TLS connection could not be established.'
    case 'authentication':
      return 'Authentication failed. Check the username and password.'
    case 'protocol':
      return 'The server returned an unexpected response.'
    case 'internal':
      return 'An unexpected error occurred.'
  }
}
