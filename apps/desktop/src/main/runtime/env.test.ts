import { describe, expect, it } from 'vitest'
import { buildRuntimeEnvironment } from './env'

describe('buildRuntimeEnvironment', () => {
  it('carries the credential environment variables', () => {
    const env = buildRuntimeEnvironment({}, { password1: 'secret1', password2: 'secret2' })
    expect(env.IMAPSYNC_PASSWORD1).toBe('secret1')
    expect(env.IMAPSYNC_PASSWORD2).toBe('secret2')
  })

  it('sanitizes developer Perl environment variables', () => {
    const env = buildRuntimeEnvironment(
      {
        PERL5LIB: '/dev/path',
        PERL_LOCAL_LIB_ROOT: '/dev/path',
        PERL_MB_OPT: '--install_base /dev/path',
        PERL_MM_OPT: 'INSTALL_BASE=/dev/path',
        PERL5OPT: '-Mfoo',
        PATH: '/usr/bin:/bin',
      },
      { password1: 'a', password2: 'b' },
    )
    expect(env.PERL5LIB).toBeUndefined()
    expect(env.PERL_LOCAL_LIB_ROOT).toBeUndefined()
    expect(env.PERL_MB_OPT).toBeUndefined()
    expect(env.PERL_MM_OPT).toBeUndefined()
    expect(env.PERL5OPT).toBeUndefined()
    expect(env.PATH).toBe('/usr/bin:/bin')
  })

  it('sets an application-relative PERL5LIB when requested', () => {
    const env = buildRuntimeEnvironment({}, { password1: 'a', password2: 'b', perl5lib: '/runtime/lib' })
    expect(env.PERL5LIB).toBe('/runtime/lib')
  })

  it('never includes credential values beyond the intended variables', () => {
    const env = buildRuntimeEnvironment({}, { password1: 'supersecret1', password2: 'supersecret2' })
    expect(JSON.stringify(env)).toContain('supersecret1')
    expect(env.PERL5LIB).toBeUndefined()
  })

  it('preserves Windows system variables needed for executable operation', () => {
    const base = {
      SystemRoot: 'C:\\Windows',
      WINDIR: 'C:\\Windows',
      TEMP: 'C:\\Users\\test\\AppData\\Local\\Temp',
      TMP: 'C:\\Users\\test\\AppData\\Local\\Temp',
      PATH: 'C:\\Windows\\system32;C:\\Windows',
      ComSpec: 'C:\\Windows\\system32\\cmd.exe',
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
      PROCESSOR_ARCHITECTURE: 'AMD64',
    }
    const env = buildRuntimeEnvironment(base, { password1: 'a', password2: 'b' })
    expect(env.SystemRoot).toBe('C:\\Windows')
    expect(env.WINDIR).toBe('C:\\Windows')
    expect(env.TEMP).toBe('C:\\Users\\test\\AppData\\Local\\Temp')
    expect(env.TMP).toBe('C:\\Users\\test\\AppData\\Local\\Temp')
    expect(env.PATH).toBe('C:\\Windows\\system32;C:\\Windows')
    expect(env.ComSpec).toBe('C:\\Windows\\system32\\cmd.exe')
    expect(env.PATHEXT).toBe('.COM;.EXE;.BAT;.CMD')
    expect(env.PROCESSOR_ARCHITECTURE).toBe('AMD64')
  })
})
