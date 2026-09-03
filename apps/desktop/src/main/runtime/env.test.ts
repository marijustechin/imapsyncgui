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
})
