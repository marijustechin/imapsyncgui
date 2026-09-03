import { join } from 'node:path'
import type { RuntimeArch } from './arch'
import { messageForRuntimeFailure, type RuntimeFailureCode } from './errors'
import { manifestMatchesArch, parseRuntimeManifest } from './manifest'

export interface RuntimeFs {
  exists(path: string): boolean
  readFile(path: string): string | null
}

export type RuntimeValidationResult =
  | { ok: true }
  | { ok: false; code: RuntimeFailureCode; message: string }

export function validateRuntime(runtimeDir: string, arch: RuntimeArch, fs: RuntimeFs): RuntimeValidationResult {
  if (!fs.exists(runtimeDir)) {
    return { ok: false, code: 'runtime-missing', message: messageForRuntimeFailure('runtime-missing') }
  }

  const manifestJson = fs.readFile(join(runtimeDir, 'manifest.json'))
  if (manifestJson === null) {
    return { ok: false, code: 'runtime-invalid', message: messageForRuntimeFailure('runtime-invalid') }
  }

  const parsed = parseRuntimeManifest(manifestJson)
  if (!parsed.ok) {
    return { ok: false, code: 'runtime-invalid', message: messageForRuntimeFailure('runtime-invalid') }
  }

  if (!manifestMatchesArch(parsed.manifest, arch)) {
    return { ok: false, code: 'architecture-mismatch', message: messageForRuntimeFailure('architecture-mismatch') }
  }

  const scriptPath = join(runtimeDir, 'bin', 'imapsync')
  if (!fs.exists(scriptPath)) {
    return { ok: false, code: 'runtime-invalid', message: messageForRuntimeFailure('runtime-invalid') }
  }

  return { ok: true }
}
