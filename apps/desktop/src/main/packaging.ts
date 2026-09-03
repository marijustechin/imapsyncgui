export const SUPPORTED_TARGET_ARCHES = ['x64', 'arm64'] as const

export type TargetArch = (typeof SUPPORTED_TARGET_ARCHES)[number]

export const APP_ID = 'com.imapsyncgui.desktop'
export const PRODUCT_NAME = 'imapSyncGUI'

export function artifactBaseName(name: string, version: string, arch: TargetArch): string {
  return `${name}-${version}-mac-${arch}`
}
