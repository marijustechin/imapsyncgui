export function redactSecrets(text: string, secrets: readonly string[]): string {
  let result = text
  for (const secret of secrets) {
    if (secret.length > 0) {
      result = result.split(secret).join('[REDACTED]')
    }
  }
  return result
}
