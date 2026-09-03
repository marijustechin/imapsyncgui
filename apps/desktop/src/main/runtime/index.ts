import type { RuntimeFailureCode } from './errors'
import { resolveRuntime, type ResolveOptions } from './resolve'
import { validateRuntime, type RuntimeFs } from './validate'

export type { RuntimeFs, RuntimeFailureCode }

export type ResolveAndValidateResult =
  | { ok: true; executable: string; prefixArgs: string[] }
  | { ok: false; code: RuntimeFailureCode; message: string }

export function resolveAndValidateRuntime(
  options: ResolveOptions,
  fs: RuntimeFs,
): ResolveAndValidateResult {
  const resolution = resolveRuntime(options)
  if (!resolution.ok) {
    return { ok: false, code: resolution.code, message: resolution.message }
  }

  if (resolution.runtime.mode === 'packaged' && resolution.runtime.runtimeDir !== null && resolution.runtime.runtimeArch !== null) {
    const validation = validateRuntime(resolution.runtime.runtimeDir, resolution.runtime.runtimeArch, fs)
    if (!validation.ok) {
      return { ok: false, code: validation.code, message: validation.message }
    }
  }

  return {
    ok: true,
    executable: resolution.runtime.executable,
    prefixArgs: resolution.runtime.prefixArgs,
  }
}
