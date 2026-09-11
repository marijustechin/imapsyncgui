import { describe, expect, it } from 'vitest'

// The runtime scripts are plain ESM modules shared with the native
// build/validate/self-test tooling, so the pure classification logic is loaded
// directly here and covered by `pnpm verify`.
const nativeDeps = await import('../../../scripts/lib/native-deps.mjs')

describe('classifyNativeDependency', () => {
  it('accepts macOS system libraries', () => {
    expect(nativeDeps.classifyNativeDependency('/usr/lib/libssl.46.dylib')).toBe('system')
    expect(nativeDeps.classifyNativeDependency('/usr/lib/libSystem.B.dylib')).toBe('system')
    expect(nativeDeps.classifyNativeDependency('/System/Library/Frameworks/Security.framework/Security')).toBe('system')
  })

  it('accepts dependencies bundled with the PAR archive', () => {
    expect(nativeDeps.classifyNativeDependency('@loader_path/libssl.3.dylib')).toBe('bundled')
    expect(nativeDeps.classifyNativeDependency('@loader_path/libcrypto.3.dylib')).toBe('bundled')
    expect(nativeDeps.classifyNativeDependency('@executable_path/../lib/libssl.3.dylib')).toBe('bundled')
  })

  it('rejects the Homebrew OpenSSL dependency that broke the arm64 runtime', () => {
    expect(nativeDeps.classifyNativeDependency('/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib')).toBe('developer')
    expect(nativeDeps.classifyNativeDependency('/opt/homebrew/Cellar/openssl@3/3.6.4/lib/libcrypto.3.dylib')).toBe('developer')
  })

  it('rejects other developer-machine and CI paths', () => {
    expect(nativeDeps.classifyNativeDependency('/usr/local/Cellar/openssl@3/3.6.4/lib/libssl.3.dylib')).toBe('developer')
    expect(nativeDeps.classifyNativeDependency('/usr/local/opt/openssl@3/lib/libssl.3.dylib')).toBe('developer')
    expect(nativeDeps.classifyNativeDependency('/opt/local/lib/libssl.dylib')).toBe('developer')
    expect(nativeDeps.classifyNativeDependency('/Users/someone/build/lib/libssl.3.dylib')).toBe('developer')
    expect(nativeDeps.classifyNativeDependency('/Users/runner/work/repo/lib/libcrypto.3.dylib')).toBe('developer')
  })

  it('treats unresolved absolute paths and @rpath as unknown', () => {
    expect(nativeDeps.classifyNativeDependency('/tmp/libssl.3.dylib')).toBe('unknown')
    expect(nativeDeps.classifyNativeDependency('@rpath/libssl.3.dylib')).toBe('unknown')
  })
})

describe('parseOtoolDependencies', () => {
  it('parses dependency paths and skips the header line', () => {
    const output = [
      '/tmp/SSLeay.bundle:',
      '\t/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib (compatibility version 3.0.0, current version 3.0.0)',
      '\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1351.0.0)',
      '',
    ].join('\n')

    expect(nativeDeps.parseOtoolDependencies(output)).toEqual([
      '/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib',
      '/usr/lib/libSystem.B.dylib',
    ])
  })
})
