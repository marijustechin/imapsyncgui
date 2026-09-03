import { join } from 'node:path'
import { archToRuntimeArch, type RuntimeArch } from './arch'
import { messageForRuntimeFailure, type RuntimeFailureCode } from './errors'

export type RuntimeMode = 'development-override' | 'development-path' | 'packaged'

export interface ResolvedRuntime {
  mode: RuntimeMode
  executable: string
  prefixArgs: string[]
  runtimeDir: string | null
  runtimeArch: RuntimeArch | null
}

export type RuntimeResolutionResult =
  | { ok: true; runtime: ResolvedRuntime }
  | { ok: false; code: RuntimeFailureCode; message: string }

export interface ResolveOptions {
  isPackaged: boolean
  arch: NodeJS.Architecture
  env: NodeJS.ProcessEnv
  resourcesPath: string
}

export function resolveRuntime(options: ResolveOptions): RuntimeResolutionResult {
  if (options.isPackaged) {
    const arch = archToRuntimeArch(options.arch)
    if (arch === null) {
      return {
        ok: false,
        code: 'architecture-mismatch',
        message: messageForRuntimeFailure('architecture-mismatch'),
      }
    }

    const runtimeDir = join(options.resourcesPath, 'runtime', arch)
    return {
      ok: true,
      runtime: {
        mode: 'packaged',
        executable: join(runtimeDir, 'bin', 'imapsync'),
        prefixArgs: [],
        runtimeDir,
        runtimeArch: arch,
      },
    }
  }

  const override = options.env.IMAPSYNC_EXECUTABLE
  if (override && override.trim().length > 0) {
    return {
      ok: true,
      runtime: {
        mode: 'development-override',
        executable: override,
        prefixArgs: [],
        runtimeDir: null,
        runtimeArch: null,
      },
    }
  }

  return {
    ok: true,
    runtime: {
      mode: 'development-path',
      executable: 'imapsync',
      prefixArgs: [],
      runtimeDir: null,
      runtimeArch: null,
    },
  }
}
