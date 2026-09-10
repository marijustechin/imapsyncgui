// TARGET_PLATFORM defaults to the build host platform so packaging is native
// (no cross-compilation shortcut): a Windows build must run on Windows, and a
// macOS build must run on macOS. It is overridable (e.g. in tests).
const targetPlatform = process.env.TARGET_PLATFORM || process.platform
const targetArch = process.env.TARGET_ARCH || 'x64'

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

const runtimeArch = runtimeArchFor(targetPlatform, targetArch)

if (runtimeArch === null) {
  throw new Error(`unsupported target platform/arch: ${targetPlatform}/${targetArch}`)
}

module.exports = {
  appId: 'com.imapsyncgui.desktop',
  productName: 'imapSyncGUI',
  directories: {
    output: 'release',
  },
  files: ['out/**/*', 'package.json'],
  extraResources: [{ from: `runtime/${runtimeArch}`, to: `runtime/${runtimeArch}` }],
  asar: true,
  mac: {
    category: 'public.app-category.utilities',
    target: ['dmg', 'zip'],
    artifactName: '${productName}-${version}-mac-${arch}.${ext}',
    // Ad-hoc signing (no Developer ID). macOS requires every arm64 executable
    // to carry a valid code signature; ad-hoc signing produces a consistent,
    // valid signature so Gatekeeper presents the normal "unidentified
    // developer" flow instead of misreporting the app as "damaged". This is
    // NOT Apple Developer Program signing and NOT notarization (both remain
    // out of scope). See docs/security.md and ADR-015.
    identity: '-',
    hardenedRuntime: false,
    // The bundled PAR::Packer `imapsync` binary (extraResources) cannot be
    // re-signed by `codesign` ("main executable failed strict validation") and
    // must not be included in the app's code-signature seal. On x86_64 it is
    // legitimately unsigned; on arm64 it is already linker-signed (ad-hoc) at
    // build time, which is sufficient to execute. See ADR-015.
    signIgnore: ['/bin/imapsync$'],
  },
  dmg: {
    title: '${productName} ${version}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },
  win: {
    // Windows x64 only (Windows ARM64 and 32-bit are out of scope). No
    // signing identity is configured: the installer/application is unsigned
    // (see ADR-017 and docs/security.md), so SmartScreen may warn on first
    // run. See ADR-016 for the Windows runtime strategy.
    target: ['nsis'],
    artifactName: '${productName}-${version}-windows-${arch}-setup.${ext}',
  },
  nsis: {
    // Conventional assisted installer with a directory-selection page,
    // Start Menu integration, and normal uninstall support. Per-user install
    // (no administrator privileges required). See ADR-016 / ADR-017.
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
}
