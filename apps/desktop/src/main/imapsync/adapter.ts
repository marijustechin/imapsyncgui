import { StringDecoder } from 'node:string_decoder'
import type {
  MigrationCancelResult,
  MigrationFailureCode,
  MigrationInput,
  MigrationStartResult,
} from '../../shared/contracts'
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

const FAILURE_MESSAGES: Record<MigrationFailureCode, string> = {
  'runtime-unavailable': 'The bundled migration runtime is not available.',
  'runtime-dependency':
    'Migration could not start correctly because the bundled migration runtime failed to load a required component.',
  'spawn-failed': 'The migration process could not be started.',
  'process-failed': 'The migration did not complete successfully.',
  internal: 'An unexpected error occurred during the migration.',
}

// Narrow, documented signatures of a dyld/DynaLoader failure (e.g. a
// non-relocatable OpenSSL dependency in the bundled runtime). These are stable
// loader diagnostics, not arbitrary imapsync log text, so they can reliably
// classify a bundled-runtime dependency failure without inventing categories
// from free-form output.
const RUNTIME_DEPENDENCY_SIGNATURES = [/Can't load .* for module/i, /Library not loaded:/, /Symbol not found:/]

function isRuntimeDependencyFailure(text: string): boolean {
  return RUNTIME_DEPENDENCY_SIGNATURES.some((pattern) => pattern.test(text))
}

export interface MigrationAdapterOptions {
  launcher: ProcessLauncher
  executable: string
  prefixArgs?: string[]
  unavailableMessage?: string
  cwd?: string
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
  private readonly cwd?: string
  private readonly buildArgs: (input: MigrationInput) => string[]
  private readonly onOutput?: OutputListener
  private readonly onPhase?: PhaseListener
  private readonly onResult?: ResultListener

  private process: MigrationProcess | null = null
  private phase: MigrationPhase = 'idle'
  private cancelRequested = false
  private runtimeDependencyFailure = false
  private failureScanTail = ''

  constructor(options: MigrationAdapterOptions) {
    this.launcher = options.launcher
    this.executable = options.executable
    this.prefixArgs = options.prefixArgs ?? []
    this.unavailableMessage = options.unavailableMessage
    this.cwd = options.cwd
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
    this.runtimeDependencyFailure = false
    this.failureScanTail = ''
    this.setPhase('starting')

    const args = [...this.prefixArgs, ...this.buildArgs(input)]
    if (this.cwd) {
      args.push('--tmpdir', this.cwd)
    }

    let process: MigrationProcess
    try {
      process = this.launcher({
        executable: this.executable,
        args,
        env: buildRuntimeEnvironment(globalThis.process.env, {
          password1: input.source.password,
          password2: input.destination.password,
        }),
        cwd: this.cwd,
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
        this.onResult?.({
          phase: 'failed',
          code: 'internal',
          message: FAILURE_MESSAGES.internal,
          exitCode: null,
        })
      })

      process.onSpawn(() => {
        if (settled) {
          return
        }
        settled = true
        this.setPhase('running')
        resolve({ ok: true, message: 'Migration started.' })
      })

      // Decode incrementally, retaining any trailing partial UTF-8 sequence
      // until the next chunk. Output is forwarded to the renderer as soon as
      // each decoded chunk is available, never accumulated until exit.
      const stdoutDecoder = new StringDecoder('utf8')
      const stderrDecoder = new StringDecoder('utf8')

      process.onData((chunk) => this.handleData('stdout', stdoutDecoder.write(chunk), sanitize), 'stdout')
      process.onData((chunk) => this.handleData('stderr', stderrDecoder.write(chunk), sanitize), 'stderr')
      process.onExit((code) => {
        this.handleData('stdout', stdoutDecoder.end(), sanitize)
        this.handleData('stderr', stderrDecoder.end(), sanitize)
        this.handleExit(code)
      })
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

  private handleData(stream: 'stdout' | 'stderr', text: string, sanitize: (text: string) => string): void {
    const sanitized = sanitize(text)
    if (sanitized.length > 0) {
      // Keep a bounded rolling tail purely for failure classification; output
      // itself is still forwarded chunk-by-chunk and never delayed.
      this.failureScanTail = (this.failureScanTail + sanitized).slice(-4096)
      if (!this.runtimeDependencyFailure && isRuntimeDependencyFailure(this.failureScanTail)) {
        this.runtimeDependencyFailure = true
      }
      this.onOutput?.({ stream, text: sanitized })
    }
  }

  private handleExit(code: number | null): void {
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

    const failureCode: MigrationFailureCode = this.runtimeDependencyFailure ? 'runtime-dependency' : 'process-failed'
    this.setPhase('failed')
    this.onResult?.({
      phase: 'failed',
      code: failureCode,
      message: FAILURE_MESSAGES[failureCode],
      exitCode: code,
    })
  }

  private setPhase(phase: MigrationPhase): void {
    this.phase = phase
    this.onPhase?.(phase)
  }
}
