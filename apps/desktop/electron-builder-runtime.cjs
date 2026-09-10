// Pure runtime-selection helpers for electron-builder packaging.
//
// These live in a separate CommonJS module (rather than inline in
// electron-builder.config.cjs) so the selection/rejection logic can be unit
// tested without loading the full electron-builder config schema.
//
// Packaging must bundle the runtime that matches the *target* platform, never
// the build host. Native packaging is required (ADR-016/017): a Windows build
// must run on Windows. An implicit cross-host build (e.g. `--win` on macOS
// without an explicit override) is rejected instead of silently bundling the
// host runtime.

const TARGET_FLAGS = {
  '--win': 'win32',
  '--win32': 'win32',
  '--windows': 'win32',
  '-w': 'win32',
  '--mac': 'darwin',
  '--macos': 'darwin',
  '--darwin': 'darwin',
  '-m': 'darwin',
  '--linux': 'linux',
  '-l': 'linux',
}

const ARCH_FLAGS = {
  '--x64': 'x64',
  '--arm64': 'arm64',
  '--ia32': 'ia32',
  '--armv7l': 'armv7l',
}

/**
 * Returns the platform requested by the electron-builder CLI flags, or null
 * when no platform flag is present.
 */
function requestedPlatformFromArgv(argv) {
  return requestedFlagValue(argv, TARGET_FLAGS)
}

/**
 * Returns the architecture requested by the electron-builder CLI flags, or null
 * when no architecture flag is present.
 */
function requestedArchFromArgv(argv) {
  return requestedFlagValue(argv, ARCH_FLAGS)
}

function requestedFlagValue(argv, table) {
  for (const arg of argv || []) {
    const flag = String(arg).split('=')[0]
    if (Object.prototype.hasOwnProperty.call(table, flag)) {
      return table[flag]
    }
  }
  return null
}

/**
 * Maps a target platform + architecture to the bundled runtime directory, or
 * null when the combination is unsupported (e.g. win32/arm64, linux/x64).
 */
function runtimeArchFor(platform, arch) {
  if (platform === 'darwin') {
    if (arch === 'arm64') return 'darwin-arm64'
    if (arch === 'x64') return 'darwin-x64'
    return null
  }
  if (platform === 'win32') {
    if (arch === 'x64') return 'win32-x64'
    return null
  }
  return null
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Resolves the packaging target and bundled runtime.
 *
 * @param {{ env: NodeJS.ProcessEnv, argv: string[], hostPlatform: string }} options
 * @returns {{ ok: true, targetPlatform: string, targetArch: string, runtimeArch: string }
 *   | { ok: false, error: string }}
 */
function resolvePackagingTarget(options) {
  const env = options.env || {}
  const argv = options.argv || []
  const hostPlatform = options.hostPlatform

  const explicitPlatform = nonEmpty(env.TARGET_PLATFORM)
  const requestedPlatform = requestedPlatformFromArgv(argv)
  const explicitArch = nonEmpty(env.TARGET_ARCH)
  const requestedArch = requestedArchFromArgv(argv)

  if (explicitPlatform && requestedPlatform && explicitPlatform !== requestedPlatform) {
    return {
      ok: false,
      error:
        `conflicting packaging targets: the CLI requests "${requestedPlatform}" ` +
        `but TARGET_PLATFORM="${explicitPlatform}"`,
    }
  }

  if (explicitArch && requestedArch && explicitArch !== requestedArch) {
    return {
      ok: false,
      error:
        `conflicting packaging architectures: the CLI requests "${requestedArch}" ` +
        `but TARGET_ARCH="${explicitArch}"`,
    }
  }

  // The CLI target is authoritative; an explicit TARGET_PLATFORM/TARGET_ARCH is
  // the supported override for tests and deliberate cross-packaging.
  const targetPlatform = requestedPlatform || explicitPlatform || hostPlatform
  const targetArch = requestedArch || explicitArch || 'x64'

  const runtimeArch = runtimeArchFor(targetPlatform, targetArch)
  if (runtimeArch === null) {
    return { ok: false, error: `unsupported target platform/arch: ${targetPlatform}/${targetArch}` }
  }

  const crossHost = targetPlatform !== hostPlatform
  if (crossHost && !explicitPlatform) {
    const hostRuntime = runtimeArchFor(hostPlatform, targetArch) || `${hostPlatform}/${targetArch}`
    return {
      ok: false,
      error:
        `refusing cross-host packaging: requested target "${targetPlatform}" on host ` +
        `"${hostPlatform}" would otherwise bundle the host runtime (${hostRuntime}) ` +
        `instead of ${runtimeArch}. Run packaging on a native ${targetPlatform} host, or ` +
        `set TARGET_PLATFORM=${targetPlatform} to override explicitly.`,
    }
  }

  return { ok: true, targetPlatform, targetArch, runtimeArch }
}

module.exports = {
  requestedPlatformFromArgv,
  requestedArchFromArgv,
  runtimeArchFor,
  resolvePackagingTarget,
}
