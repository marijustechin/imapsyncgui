export const SUPPORTED_TARGET_ARCHES = ['x64', 'arm64'] as const

export type TargetArch = (typeof SUPPORTED_TARGET_ARCHES)[number]

export const WINDOWS_TARGET_ARCHES = ['x64'] as const

export type WindowsTargetArch = (typeof WINDOWS_TARGET_ARCHES)[number]

export const APP_ID = 'com.imapsyncgui.desktop'
export const PRODUCT_NAME = 'imapSyncGUI'

// Distribution targets: the DMG is the primary TASK-010 test distribution; the
// ZIP is retained as a secondary format. No universal build.
export const MAC_TARGETS = ['dmg', 'zip'] as const

// Windows distribution target: a single NSIS installer (TASK-011). No ZIP or
// portable build is produced as a substitute for the installer.
export const WIN_TARGETS = ['nsis'] as const

// Ad-hoc signing identity (no Developer ID, no notarization). See ADR-015.
export const MAC_SIGN_IDENTITY = '-'

export function artifactBaseName(name: string, version: string, arch: TargetArch): string {
  return `${name}-${version}-mac-${arch}`
}

export function distributionArtifactNames(name: string, version: string, arch: TargetArch): string[] {
  const base = artifactBaseName(name, version, arch)
  return MAC_TARGETS.map((ext) => `${base}.${ext}`)
}

// Windows installer artifact naming is architecture-explicit:
// `<name>-<version>-windows-<arch>-setup.exe`.
export function windowsInstallerArtifactName(name: string, version: string, arch: WindowsTargetArch): string {
  return `${name}-${version}-windows-${arch}-setup.exe`
}
