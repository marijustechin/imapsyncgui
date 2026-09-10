import { platformForRuntimeArch, type RuntimeArch, type RuntimePlatform } from './arch'

export const RUNTIME_MANIFEST_FORMAT_VERSION = 1

export interface RuntimeComponent {
  name: string
  version: string
  license: string
  source: string
}

export interface RuntimeManifest {
  formatVersion: number
  platform: RuntimePlatform
  architecture: RuntimeArch
  imapsyncVersion: string
  artifactFilename: string
  artifactSha256: string
  perlVersion: string | null
  builtAt: string | null
  components: RuntimeComponent[]
}

export type ManifestParseResult =
  | { ok: true; manifest: RuntimeManifest }
  | { ok: false; error: string }

function isRuntimePlatform(value: unknown): value is RuntimePlatform {
  return value === 'darwin' || value === 'win32'
}

function isRuntimeArch(value: unknown): value is RuntimeArch {
  return value === 'darwin-x64' || value === 'darwin-arm64' || value === 'win32-x64'
}

function parseComponent(value: unknown): RuntimeComponent | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.name !== 'string' || typeof record.version !== 'string') {
    return null
  }
  if (typeof record.license !== 'string' || typeof record.source !== 'string') {
    return null
  }
  return {
    name: record.name,
    version: record.version,
    license: record.license,
    source: record.source,
  }
}

export function parseRuntimeManifest(json: string): ManifestParseResult {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { ok: false, error: 'manifest is not valid JSON' }
  }

  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'manifest must be an object' }
  }

  const record = value as Record<string, unknown>

  if (record.formatVersion !== RUNTIME_MANIFEST_FORMAT_VERSION) {
    return { ok: false, error: 'unsupported manifest format version' }
  }
  if (!isRuntimePlatform(record.platform)) {
    return { ok: false, error: 'invalid or missing platform' }
  }
  if (!isRuntimeArch(record.architecture)) {
    return { ok: false, error: 'invalid or missing architecture' }
  }
  if (record.platform !== platformForRuntimeArch(record.architecture)) {
    return { ok: false, error: 'platform does not match architecture' }
  }
  if (typeof record.imapsyncVersion !== 'string' || record.imapsyncVersion.length === 0) {
    return { ok: false, error: 'missing imapsync version' }
  }
  if (typeof record.artifactFilename !== 'string' || record.artifactFilename.length === 0) {
    return { ok: false, error: 'missing artifact filename' }
  }
  if (typeof record.artifactSha256 !== 'string' || record.artifactSha256.length === 0) {
    return { ok: false, error: 'missing artifact SHA-256' }
  }
  if (!Array.isArray(record.components)) {
    return { ok: false, error: 'components must be an array' }
  }

  const components: RuntimeComponent[] = []
  for (const component of record.components) {
    const parsed = parseComponent(component)
    if (parsed === null) {
      return { ok: false, error: 'invalid component entry' }
    }
    components.push(parsed)
  }

  return {
    ok: true,
    manifest: {
      formatVersion: RUNTIME_MANIFEST_FORMAT_VERSION,
      platform: record.platform,
      architecture: record.architecture,
      imapsyncVersion: record.imapsyncVersion,
      artifactFilename: record.artifactFilename,
      artifactSha256: record.artifactSha256,
      perlVersion: typeof record.perlVersion === 'string' ? record.perlVersion : null,
      builtAt: typeof record.builtAt === 'string' ? record.builtAt : null,
      components,
    },
  }
}

export function manifestMatchesArch(manifest: RuntimeManifest, arch: RuntimeArch): boolean {
  return manifest.architecture === arch
}
