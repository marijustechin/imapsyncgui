import {
  SECURITY_MODES,
  type ImapEndpoint,
  type MigrationInput,
  type SecurityMode,
} from '../shared/contracts'

export interface ValidationIssue {
  field: string
  message: string
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ')
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

function isSecurityMode(value: unknown): value is SecurityMode {
  return typeof value === 'string' && (SECURITY_MODES as readonly string[]).includes(value)
}

export function validateEndpoint(input: unknown): ValidationResult<ImapEndpoint> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ field: 'endpoint', message: 'endpoint must be an object' }] }
  }

  const issues: ValidationIssue[] = []

  if (!isNonEmptyString(input.host)) {
    issues.push({ field: 'host', message: 'host must be a non-empty string' })
  }
  if (!isValidPort(input.port)) {
    issues.push({ field: 'port', message: 'port must be an integer between 1 and 65535' })
  }
  if (!isSecurityMode(input.security)) {
    issues.push({ field: 'security', message: 'security mode is invalid' })
  }
  if (!isNonEmptyString(input.username)) {
    issues.push({ field: 'username', message: 'username must be a non-empty string' })
  }
  if (!isNonEmptyString(input.password)) {
    issues.push({ field: 'password', message: 'password must be a non-empty string' })
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    value: {
      host: input.host as string,
      port: input.port as number,
      security: input.security as SecurityMode,
      username: input.username as string,
      password: input.password as string,
    },
  }
}

export function validateMigrationInput(input: unknown): ValidationResult<MigrationInput> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ field: 'input', message: 'input must be an object' }] }
  }

  const source = validateEndpoint(input.source)
  const destination = validateEndpoint(input.destination)

  if (!source.ok || !destination.ok) {
    const issues: ValidationIssue[] = [
      ...(source.ok ? [] : source.issues.map((issue) => ({ ...issue, field: `source.${issue.field}` }))),
      ...(destination.ok ? [] : destination.issues.map((issue) => ({ ...issue, field: `destination.${issue.field}` }))),
    ]
    return { ok: false, issues }
  }

  return {
    ok: true,
    value: {
      source: source.value,
      destination: destination.value,
    },
  }
}
