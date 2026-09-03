export type RuntimeFailureCode =
  | 'runtime-missing'
  | 'architecture-mismatch'
  | 'runtime-invalid'
  | 'runtime-startup-failure'

export function messageForRuntimeFailure(code: RuntimeFailureCode): string {
  switch (code) {
    case 'runtime-missing':
      return 'The imapsync runtime is not available.'
    case 'architecture-mismatch':
      return 'The imapsync runtime does not match this computer architecture.'
    case 'runtime-invalid':
      return 'The imapsync runtime is incomplete or corrupted.'
    case 'runtime-startup-failure':
      return 'The imapsync runtime could not be started.'
  }
}
