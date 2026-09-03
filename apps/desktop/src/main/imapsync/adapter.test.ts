import { describe, expect, it } from 'vitest'
import type { MigrationInput, MigrationOutput } from '../../shared/contracts'
import { MigrationAdapter } from './adapter'
import type { LaunchSpec, MigrationPhase, MigrationProcess, MigrationResult } from './types'

const input: MigrationInput = {
  source: { host: 's.example.com', port: 993, security: 'tls', username: 'user1', password: 'secret1' },
  destination: { host: 'd.example.com', port: 993, security: 'tls', username: 'user2', password: 'secret2' },
}

function createFakeProcess() {
  const spawnListeners: Array<() => void> = []
  const errorListeners: Array<(error: Error) => void> = []
  const exitListeners: Array<(code: number | null, signal: string | null) => void> = []
  const dataListeners = { stdout: [] as Array<(chunk: Buffer) => void>, stderr: [] as Array<(chunk: Buffer) => void> }
  const killSignals: Array<string | number | undefined> = []

  const process: MigrationProcess = {
    onSpawn(listener) {
      spawnListeners.push(listener)
    },
    onError(listener) {
      errorListeners.push(listener)
    },
    onExit(listener) {
      exitListeners.push(listener)
    },
    onData(listener, stream) {
      dataListeners[stream].push(listener)
    },
    kill(signal) {
      killSignals.push(signal)
      return true
    },
  }

  return {
    process,
    killSignals,
    emitSpawn: () => spawnListeners.forEach((l) => l()),
    emitError: (error: Error) => errorListeners.forEach((l) => l(error)),
    emitExit: (code: number | null, signal: string | null) => exitListeners.forEach((l) => l(code, signal)),
    emitStdout: (chunk: Buffer) => dataListeners.stdout.forEach((l) => l(chunk)),
    emitStderr: (chunk: Buffer) => dataListeners.stderr.forEach((l) => l(chunk)),
  }
}

interface Harness {
  adapter: MigrationAdapter
  fake: ReturnType<typeof createFakeProcess>
  specs: LaunchSpec[]
  outputs: MigrationOutput[]
  phases: MigrationPhase[]
  results: MigrationResult[]
}

function createHarness(): Harness {
  const fake = createFakeProcess()
  const specs: LaunchSpec[] = []
  const outputs: MigrationOutput[] = []
  const phases: MigrationPhase[] = []
  const results: MigrationResult[] = []

  const adapter = new MigrationAdapter({
    launcher: (spec) => {
      specs.push(spec)
      return fake.process
    },
    executable: 'imapsync',
    onOutput: (output) => outputs.push(output),
    onPhase: (phase) => phases.push(phase),
    onResult: (result) => results.push(result),
  })

  return { adapter, fake, specs, outputs, phases, results }
}

describe('MigrationAdapter', () => {
  it('resolves started and emits succeeded on exit code 0', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    const result = await startPromise

    expect(result).toEqual({ ok: true, message: 'Migration started.' })
    expect(h.adapter.getPhase()).toBe('running')

    h.fake.emitExit(0, null)

    expect(h.adapter.getPhase()).toBe('succeeded')
    expect(h.results).toEqual([{ phase: 'succeeded', message: 'Migration completed successfully.' }])
  })

  it('emits failed on a non-zero exit', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    h.fake.emitExit(1, null)

    expect(h.adapter.getPhase()).toBe('failed')
    expect(h.results).toEqual([{ phase: 'failed', message: 'Migration exited with code 1.' }])
  })

  it('resolves a startup failure when the process fails to launch', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitError(Object.assign(new Error('spawn imapsync ENOENT'), { code: 'ENOENT' }))
    const result = await startPromise

    expect(result.ok).toBe(false)
    expect(result.message).toContain('imapsync executable not found')
    expect(h.adapter.getPhase()).toBe('failed')
  })

  it('streams stdout incrementally', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    h.fake.emitStdout(Buffer.from('connecting to source\n'))

    expect(h.outputs).toEqual([{ stream: 'stdout', text: 'connecting to source\n' }])
  })

  it('streams stderr incrementally', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    h.fake.emitStderr(Buffer.from('warning: something\n'))

    expect(h.outputs).toEqual([{ stream: 'stderr', text: 'warning: something\n' }])
  })

  it('cancels the running process and emits a cancelled result', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    const cancelResult = await h.adapter.cancel()

    expect(cancelResult).toEqual({ ok: true, message: 'Migration cancellation requested.' })
    expect(h.fake.killSignals).toEqual(['SIGTERM'])

    h.fake.emitExit(null, 'SIGTERM')

    expect(h.adapter.getPhase()).toBe('cancelled')
    expect(h.results).toEqual([{ phase: 'cancelled', message: 'Migration cancelled.' }])
  })

  it('is idempotent on repeated cancellation', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    await h.adapter.cancel()
    const second = await h.adapter.cancel()

    expect(second).toEqual({ ok: true, message: 'Migration cancellation requested.' })
    expect(h.fake.killSignals).toEqual(['SIGTERM'])
  })

  it('returns a defined error when cancelling with no active migration', async () => {
    const h = createHarness()

    const result = await h.adapter.cancel()

    expect(result).toEqual({ ok: false, message: 'No migration is running.' })
  })

  it('rejects a second migration while one is active', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    const second = await h.adapter.start(input)

    expect(second).toEqual({ ok: false, message: 'A migration is already in progress.' })
    expect(h.specs).toHaveLength(1)
  })

  it('passes credentials via environment and never in arguments', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    expect(h.specs).toHaveLength(1)
    expect(h.specs[0].args).not.toContain('secret1')
    expect(h.specs[0].args).not.toContain('secret2')
    expect(h.specs[0].env?.IMAPSYNC_PASSWORD1).toBe('secret1')
    expect(h.specs[0].env?.IMAPSYNC_PASSWORD2).toBe('secret2')
  })

  it('sanitizes credentials from output before emitting', async () => {
    const h = createHarness()

    const startPromise = h.adapter.start(input)
    h.fake.emitSpawn()
    await startPromise

    h.fake.emitStdout(Buffer.from('password secret1 leaked'))

    expect(h.outputs).toEqual([{ stream: 'stdout', text: 'password [REDACTED] leaked' }])
  })

  it('prepends prefix arguments for a bundled interpreter', async () => {
    const fake = createFakeProcess()
    const specs: LaunchSpec[] = []
    const adapter = new MigrationAdapter({
      launcher: (spec) => {
        specs.push(spec)
        return fake.process
      },
      executable: '/runtime/darwin-x64/bin/perl',
      prefixArgs: ['/runtime/darwin-x64/bin/imapsync'],
    })

    const startPromise = adapter.start(input)
    fake.emitSpawn()
    await startPromise

    expect(specs).toHaveLength(1)
    expect(specs[0].executable).toBe('/runtime/darwin-x64/bin/perl')
    expect(specs[0].args[0]).toBe('/runtime/darwin-x64/bin/imapsync')
    expect(specs[0].args[1]).toBe('--host1')
  })

  it('fails to start when the runtime is unavailable', async () => {
    const adapter = new MigrationAdapter({
      launcher: () => {
        throw new Error('should not launch')
      },
      executable: '',
      unavailableMessage: 'The imapsync runtime is not available.',
    })

    const result = await adapter.start(input)

    expect(result).toEqual({ ok: false, message: 'The imapsync runtime is not available.' })
  })

  it('sets a controlled cwd and tmpdir for the spawned process', async () => {
    const fake = createFakeProcess()
    const specs: LaunchSpec[] = []
    const adapter = new MigrationAdapter({
      launcher: (spec) => {
        specs.push(spec)
        return fake.process
      },
      executable: 'imapsync',
      cwd: '/tmp/imapsyncgui',
    })

    const startPromise = adapter.start(input)
    fake.emitSpawn()
    await startPromise

    expect(specs).toHaveLength(1)
    expect(specs[0].cwd).toBe('/tmp/imapsyncgui')
    expect(specs[0].args).toContain('--tmpdir')
    expect(specs[0].args[specs[0].args.indexOf('--tmpdir') + 1]).toBe('/tmp/imapsyncgui')
    expect(specs[0].args).toContain('--nolog')
  })
})
