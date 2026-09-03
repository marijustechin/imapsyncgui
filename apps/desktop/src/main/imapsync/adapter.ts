import type { MigrationCancelResult, MigrationInput, MigrationStartResult } from '../../shared/contracts'
import { buildRuntimeEnvironment } from '../runtime/env'
import { buildMigrationArgs } from './arguments'
import { redactSecrets } from './sanitize'
import type {
  MigrationPhase,
  MigrationProcess,
  OutputListener,
  PhaseListener,
  ProcessLauncher,
  ResultListener,
} from './types'

export interface MigrationAdapterOptions {
  launcher: ProcessLauncher
  executable: string
  prefixArgs?: string[]
  unavailableMessage?: string
  buildArgs?: (input: MigrationInput) => string[]
  onOutput?: OutputListener
  onPhase?: PhaseListener
  onResult?: ResultListener
}

function describeLaunchError(error: Error): string {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'ENOENT') {
    return 'imapsync executable not found. Install it (e.g. `brew install imapsync`) or set IMAPSYNC_EXECUTABLE.'
  }
  return error.message
}

export class MigrationAdapter {
  private readonly launcher: ProcessLauncher
  private readonly executable: string
  private readonly prefixArgs: string[]
  private readonly unavailableMessage?: string
  private readonly buildArgs: (input: MigrationInput) => string[]
  private readonly onOutput?: OutputListener
  private readonly onPhase?: PhaseListener
  private readonly onResult?: ResultListener

  private process: MigrationProcess | null = null
  private phase: MigrationPhase = 'idle'
  private cancelRequested = false

  constructor(options: MigrationAdapterOptions) {
    this.launcher = options.launcher
    this.executable = options.executable
    this.prefixArgs = options.prefixArgs ?? []
    this.unavailableMessage = options.unavailableMessage
    this.buildArgs = options.buildArgs ?? buildMigrationArgs
    this.onOutput = options.onOutput
    this.onPhase = options.onPhase
    this.onResult = options.onResult
  }

  start(input: MigrationInput): Promise<MigrationStartResult> {
    if (this.unavailableMessage) {
      return Promise.resolve({ ok: false, message: this.unavailableMessage })
    }

    if (this.process !== null) {
      return Promise.resolve({ ok: false, message: 'A migration is already in progress.' })
    }

    const secrets = [input.source.password, input.destination.password]
    const sanitize = (text: string): string => redactSecrets(text, secrets)

    this.cancelRequested = false
    this.setPhase('starting')

    let process: MigrationProcess
    try {
      process = this.launcher({
        executable: this.executable,
        args: [...this.prefixArgs, ...this.buildArgs(input)],
        env: buildRuntimeEnvironment(globalThis.process.env, {
          password1: input.source.password,
          password2: input.destination.password,
        }),
      })
    } catch (error) {
      this.setPhase('failed')
      const message = error instanceof Error ? describeLaunchError(error) : 'failed to start imapsync'
      return Promise.resolve({ ok: false, message })
    }

    this.process = process

    return new Promise<MigrationStartResult>((resolve) => {
      let settled = false

      process.onError((error) => {
        if (!settled) {
          settled = true
          this.process = null
          this.setPhase('failed')
          resolve({ ok: false, message: describeLaunchError(error) })
          return
        }
        this.setPhase('failed')
        this.onResult?.({ phase: 'failed', message: error.message })
      })

      process.onSpawn(() => {
        if (settled) {
          return
        }
        settled = true
        this.setPhase('running')
        resolve({ ok: true, message: 'Migration started.' })
      })

      process.onData((chunk) => this.handleData('stdout', chunk, sanitize), 'stdout')
      process.onData((chunk) => this.handleData('stderr', chunk, sanitize), 'stderr')
      process.onExit((code, signal) => this.handleExit(code, signal))
    })
  }

  cancel(): Promise<MigrationCancelResult> {
    if (this.phase !== 'starting' && this.phase !== 'running') {
      return Promise.resolve({ ok: false, message: 'No migration is running.' })
    }

    if (this.cancelRequested) {
      return Promise.resolve({ ok: true, message: 'Migration cancellation requested.' })
    }

    this.cancelRequested = true
    this.process?.kill('SIGTERM')
    return Promise.resolve({ ok: true, message: 'Migration cancellation requested.' })
  }

  getPhase(): MigrationPhase {
    return this.phase
  }

  private handleData(stream: 'stdout' | 'stderr', chunk: Buffer, sanitize: (text: string) => string): void {
    const text = sanitize(chunk.toString('utf8'))
    if (text.length > 0) {
      this.onOutput?.({ stream, text })
    }
  }

  private handleExit(code: number | null, signal: string | null): void {
    this.process = null

    if (this.cancelRequested) {
      this.cancelRequested = false
      this.setPhase('cancelled')
      this.onResult?.({ phase: 'cancelled', message: 'Migration cancelled.' })
      return
    }

    if (code === 0) {
      this.setPhase('succeeded')
      this.onResult?.({ phase: 'succeeded', message: 'Migration completed successfully.' })
      return
    }

    const reason = signal ? `terminated by signal ${signal}` : `exited with code ${code ?? 'unknown'}`
    this.setPhase('failed')
    this.onResult?.({ phase: 'failed', message: `Migration ${reason}.` })
  }

  private setPhase(phase: MigrationPhase): void {
    this.phase = phase
    this.onPhase?.(phase)
  }
}
