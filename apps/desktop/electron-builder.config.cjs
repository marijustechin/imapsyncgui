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
    target: ['zip'],
    artifactName: '${productName}-${version}-mac-${arch}.${ext}',
    identity: null,
  },
}
