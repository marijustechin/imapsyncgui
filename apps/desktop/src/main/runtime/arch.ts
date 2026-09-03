export type RuntimeArch = 'darwin-x64' | 'darwin-arm64'

export function archToRuntimeArch(arch: NodeJS.Architecture): RuntimeArch | null {
  switch (arch) {
    case 'x64':
      return 'darwin-x64'
    case 'arm64':
      return 'darwin-arm64'
    default:
      return null
  }
}
