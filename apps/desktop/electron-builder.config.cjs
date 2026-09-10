// Packaging bundles the runtime that matches the *target* platform, never the
// build host. Native packaging is required (ADR-016/017): a Windows build must
// run on Windows, and a macOS build must run on macOS. The target is derived
// from the electron-builder CLI flags (e.g. `--win`) and validated against the
// host; an implicit cross-host build fails fast instead of silently bundling
// the host runtime. TARGET_PLATFORM remains an explicit override (used by tests
// and deliberate cross-packaging). See electron-builder-runtime.cjs.
const { resolvePackagingTarget } = require('./electron-builder-runtime.cjs')

const resolvedTarget = resolvePackagingTarget({
  env: process.env,
  argv: process.argv,
  hostPlatform: process.platform,
})

if (!resolvedTarget.ok) {
  throw new Error(resolvedTarget.error)
}

const { runtimeArch } = resolvedTarget

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
