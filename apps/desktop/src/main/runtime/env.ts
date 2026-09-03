const DEVELOPER_ENV_VARS = [
  'PERL5LIB',
  'PERL_LOCAL_LIB_ROOT',
  'PERL_MB_OPT',
  'PERL_MM_OPT',
  'PERL5OPT',
  'PERL6LIB',
]

export interface RuntimeEnvOptions {
  password1: string
  password2: string
  perl5lib?: string
}

export function buildRuntimeEnvironment(base: NodeJS.ProcessEnv, options: RuntimeEnvOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base }

  for (const key of DEVELOPER_ENV_VARS) {
    delete env[key]
  }

  if (options.perl5lib) {
    env.PERL5LIB = options.perl5lib
  }

  env.IMAPSYNC_PASSWORD1 = options.password1
  env.IMAPSYNC_PASSWORD2 = options.password2

  return env
}
