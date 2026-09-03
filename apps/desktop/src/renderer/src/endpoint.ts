import type {
  ConnectionTestFailureCode,
  ImapEndpoint,
  SecurityMode,
} from '../../shared/contracts'

export interface EndpointValues {
  host: string
  port: string
  security: SecurityMode
  username: string
  password: string
}

export const DEFAULT_PORTS: Record<SecurityMode, number> = {
  tls: 993,
  starttls: 143,
  none: 143,
}

export const SECURITY_MODE_OPTIONS: ReadonlyArray<{ value: SecurityMode; label: string }> = [
  { value: 'tls', label: 'TLS/SSL (implicit)' },
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'none', label: 'None (plaintext)' },
]

export interface FieldErrors {
  host?: string
  port?: string
  username?: string
  password?: string
}

export function emptyEndpointValues(): EndpointValues {
  return { host: '', port: '993', security: 'tls', username: '', password: '' }
}

export function validateEndpointValues(values: EndpointValues): FieldErrors {
  const errors: FieldErrors = {}

  if (values.host.trim().length === 0) {
    errors.host = 'Host is required.'
  }

  const port = Number(values.port)
  if (values.port.trim().length === 0) {
    errors.port = 'Port is required.'
  } else if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.port = 'Port must be an integer between 1 and 65535.'
  }

  if (values.username.trim().length === 0) {
    errors.username = 'Username is required.'
  }

  if (values.password.length === 0) {
    errors.password = 'Password is required.'
  }

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

export function toEndpoint(values: EndpointValues): ImapEndpoint {
  return {
    host: values.host.trim(),
    port: Number(values.port),
    security: values.security,
    username: values.username,
    password: values.password,
  }
}

export function endpointsEqual(a: EndpointValues, b: EndpointValues): boolean {
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.security === b.security &&
    a.username === b.username &&
    a.password === b.password
  )
}

export const CONNECTION_FAILURE_MESSAGES: Record<ConnectionTestFailureCode, string> = {
  'invalid-input': 'Please correct the fields and try again.',
  dns: 'Could not resolve the server host name.',
  connection: 'Could not connect to the server.',
  timeout: 'The connection timed out.',
  tls: 'The TLS connection could not be established.',
  authentication: 'Authentication failed. Check the username and password.',
  protocol: 'The server returned an unexpected response.',
  internal: 'An unexpected error occurred.',
}

export const CONNECTION_SUCCESS_MESSAGE = 'Connection and authentication succeeded.'
