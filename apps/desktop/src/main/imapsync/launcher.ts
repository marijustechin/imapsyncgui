import { spawn } from 'node:child_process'
import type { LaunchSpec, MigrationProcess, ProcessLauncher } from './types'

export function createNodeProcessLauncher(): ProcessLauncher {
  return (spec: LaunchSpec): MigrationProcess => {
    const child = spawn(spec.executable, spec.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spec.env,
      cwd: spec.cwd,
    })

    const stdout = child.stdout
    const stderr = child.stderr

    if (!stdout || !stderr) {
      child.kill()
      throw new Error('failed to open imapsync process streams')
    }

    return {
      onSpawn(listener) {
        child.once('spawn', listener)
      },
      onError(listener) {
        child.once('error', listener)
      },
      onExit(listener) {
        child.once('close', (code, signal) => listener(code, signal))
      },
      onData(listener, stream) {
        const source = stream === 'stdout' ? stdout : stderr
        source.on('data', listener)
      },
      kill(signal) {
        return child.kill(signal)
      },
    }
  }
}
