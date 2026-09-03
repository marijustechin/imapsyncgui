import type { ConnectionTestResult, ImapEndpoint } from '../shared/contracts'
import { formatIssues, validateEndpoint } from './validation'

export type ConnectionTester = (endpoint: ImapEndpoint) => Promise<ConnectionTestResult>

export async function testConnectionHandler(
  request: unknown,
  tester: ConnectionTester,
): Promise<ConnectionTestResult> {
  const result = validateEndpoint(request)
  if (!result.ok) {
    return { ok: false, code: 'invalid-input', message: formatIssues(result.issues) }
  }
  return tester(result.value)
}
