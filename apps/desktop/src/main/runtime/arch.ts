export type RuntimePlatform = 'darwin' | 'win32'

export type RuntimeArch = 'darwin-x64' | 'darwin-arm64' | 'win32-x64'

export function runtimeArchFor(platform: NodeJS.Platform, arch: NodeJS.Architecture): RuntimeArch | null {
  if (platform === 'darwin') {
    switch (arch) {
      case 'x64':
        return 'darwin-x64'
      case 'arm64':
        return 'darwin-arm64'
      default:
        return null
    }
  }

  if (platform === 'win32') {
    switch (arch) {
      case 'x64':
        return 'win32-x64'
      default:
        return null
    }
  }

  return null
}

export function platformForRuntimeArch(runtimeArch: RuntimeArch): RuntimePlatform {
  if (runtimeArch === 'win32-x64') {
    return 'win32'
  }
  return 'darwin'
}

export function runtimeExecutableName(runtimeArch: RuntimeArch): string {
  return platformForRuntimeArch(runtimeArch) === 'win32' ? 'imapsync.exe' : 'imapsync'
}
