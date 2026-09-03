import { describe, expect, it } from 'vitest'
import { RUNTIME_MANIFEST_FORMAT_VERSION } from './manifest'
import { validateRuntime, type RuntimeFs } from './validate'

function makeFs(entries: Record<string, string>): RuntimeFs {
  return {
    exists: (path) => Object.prototype.hasOwnProperty.call(entries, path),
    readFile: (path) => (Object.prototype.hasOwnProperty.call(entries, path) ? entries[path] : null),
  }
}

function makeManifest(architecture: string): string {
  return JSON.stringify({
    formatVersion: RUNTIME_MANIFEST_FORMAT_VERSION,
    architecture,
    imapsyncVersion: '2.314',
    perlVersion: '5.34.1',
    builtAt: null,
    components: [],
  })
}

const runtimeDir = '/resources/runtime/darwin-x64'

function completeFs(architecture = 'darwin-x64'): RuntimeFs {
  return makeFs({
    [runtimeDir]: '',
    [`${runtimeDir}/manifest.json`]: makeManifest(architecture),
    [`${runtimeDir}/bin/imapsync`]: '',
  })
}

describe('validateRuntime', () => {
  it('accepts a complete matching runtime', () => {
    expect(validateRuntime(runtimeDir, 'darwin-x64', completeFs())).toEqual({ ok: true })
  })

  it('reports a missing runtime directory', () => {
    const result = validateRuntime(runtimeDir, 'darwin-x64', makeFs({}))
    expect(result).toEqual({ ok: false, code: 'runtime-missing', message: expect.any(String) })
  })

  it('reports a missing manifest', () => {
    const fs = makeFs({
      [runtimeDir]: '',
      [`${runtimeDir}/bin/imapsync`]: '',
    })
    expect(validateRuntime(runtimeDir, 'darwin-x64', fs)).toEqual({
      ok: false,
      code: 'runtime-invalid',
      message: expect.any(String),
    })
  })

  it('reports a malformed manifest', () => {
    const fs = makeFs({
      [runtimeDir]: '',
      [`${runtimeDir}/manifest.json`]: '{ nope',
      [`${runtimeDir}/bin/imapsync`]: '',
    })
    expect(validateRuntime(runtimeDir, 'darwin-x64', fs)).toEqual({
      ok: false,
      code: 'runtime-invalid',
      message: expect.any(String),
    })
  })

  it('reports an architecture mismatch', () => {
    const result = validateRuntime(runtimeDir, 'darwin-x64', completeFs('darwin-arm64'))
    expect(result).toEqual({ ok: false, code: 'architecture-mismatch', message: expect.any(String) })
  })

  it('reports a missing script', () => {
    const fs = makeFs({
      [runtimeDir]: '',
      [`${runtimeDir}/manifest.json`]: makeManifest('darwin-x64'),
    })
    expect(validateRuntime(runtimeDir, 'darwin-x64', fs)).toEqual({
      ok: false,
      code: 'runtime-invalid',
      message: expect.any(String),
    })
  })
})
