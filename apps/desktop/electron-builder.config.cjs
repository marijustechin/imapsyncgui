const targetArch = process.env.TARGET_ARCH || 'x64'
const runtimeArch = targetArch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'

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
}
