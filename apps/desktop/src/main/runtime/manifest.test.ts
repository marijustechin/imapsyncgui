import { describe, expect, it } from 'vitest'
import { manifestMatchesArch, parseRuntimeManifest, RUNTIME_MANIFEST_FORMAT_VERSION } from './manifest'

function manifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    formatVersion: RUNTIME_MANIFEST_FORMAT_VERSION,
    architecture: 'darwin-x64',
    imapsyncVersion: '2.314',
    perlVersion: '5.34.1',
    builtAt: '2026-09-02T00:00:00.000Z',
    components: [
      { name: 'imapsync', version: '2.314', license: 'NLPL', source: 'https://imapsync.lamiral.info/' },
    ],
    ...overrides,
  })
}

describe('parseRuntimeManifest', () => {
  it('parses a valid manifest', () => {
    const result = parseRuntimeManifest(manifest())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.imapsyncVersion).toBe('2.314')
      expect(result.manifest.architecture).toBe('darwin-x64')
      expect(result.manifest.components).toHaveLength(1)
    }
  })

  it('rejects invalid JSON', () => {
    expect(parseRuntimeManifest('{ not json').ok).toBe(false)
  })

  it('rejects an unsupported format version', () => {
    expect(parseRuntimeManifest(manifest({ formatVersion: 999 })).ok).toBe(false)
  })

  it('rejects an invalid architecture', () => {
    expect(parseRuntimeManifest(manifest({ architecture: 'linux-x64' })).ok).toBe(false)
  })

  it('rejects a missing imapsync version', () => {
    expect(parseRuntimeManifest(manifest({ imapsyncVersion: '' })).ok).toBe(false)
  })

  it('rejects a non-array components field', () => {
    expect(parseRuntimeManifest(manifest({ components: 'nope' })).ok).toBe(false)
  })

  it('rejects a malformed component entry', () => {
    expect(parseRuntimeManifest(manifest({ components: [{ name: 'imapsync' }] })).ok).toBe(false)
  })
})

describe('manifestMatchesArch', () => {
  it('is true for a matching architecture', () => {
    const result = parseRuntimeManifest(manifest({ architecture: 'darwin-arm64' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(manifestMatchesArch(result.manifest, 'darwin-arm64')).toBe(true)
      expect(manifestMatchesArch(result.manifest, 'darwin-x64')).toBe(false)
    }
  })
})
