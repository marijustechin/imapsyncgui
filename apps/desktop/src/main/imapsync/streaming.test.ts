import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import type { MigrationInput } from '../../shared/contracts'
import { MigrationAdapter } from './adapter'
import { createNodeProcessLauncher } from './launcher'

const input: MigrationInput = {
  source: { host: 's.example.com', port: 993, security: 'tls', username: 'user1', password: 'secret1' },
  destination: { host: 'd.example.com', port: 993, security: 'tls', username: 'user2', password: 'secret2' },
}

// A tiny Node program that writes one line, waits, writes a second line, then
// exits. It stands in for imapsync so the real spawn/pipe path can be exercised
// without an imapsync installation.
const childScript =
  "process.stdout.write('first\\n'); setTimeout(() => { process.stdout.write('second\\n'); process.exit(0) }, 150)"

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!predicate() && Date.now() - start < timeoutMs) {
    await delay(20)
  }
}

describe('MigrationAdapter real process streaming', () => {
  it('delivers output before the child process exits', async () => {
    const outputs: string[] = []
    let phaseAtFirstOutput: string | null = null

    const adapter = new MigrationAdapter({
      launcher: createNodeProcessLauncher(),
      executable: process.execPath,
      buildArgs: () => ['-e', childScript],
      onOutput: (output) => {
        outputs.push(output.text)
        if (phaseAtFirstOutput === null) {
          phaseAtFirstOutput = adapter.getPhase()
        }
      },
    })

    const result = await adapter.start(input)
    expect(result.ok).toBe(true)

    await waitFor(() => outputs.length >= 2)
    expect(outputs.join('')).toBe('first\nsecond\n')
    // The first chunk must have arrived while the process was still running,
    // not buffered until exit.
    expect(phaseAtFirstOutput).toBe('running')

    await waitFor(() => adapter.getPhase() === 'succeeded')
    expect(adapter.getPhase()).toBe('succeeded')
  })
})
