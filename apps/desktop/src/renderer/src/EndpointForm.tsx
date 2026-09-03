import { CONNECTION_SUCCESS_MESSAGE, hasErrors, SECURITY_MODE_OPTIONS, type EndpointValues, type FieldErrors } from './endpoint'

export type TestState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'success'; message: string }
  | { phase: 'failure'; message: string }

interface EndpointFormProps {
  idPrefix: string
  title: string
  values: EndpointValues
  errors: FieldErrors
  test: TestState
  onChange: (patch: Partial<EndpointValues>) => void
  onTest: () => void
}

export function EndpointForm({ idPrefix, title, values, errors, test, onChange, onTest }: EndpointFormProps) {
  const testDisabled = hasErrors(errors) || test.phase === 'running'
  const testLabel = test.phase === 'running' ? 'Testing…' : 'Test connection'

  const status =
    test.phase === 'running'
      ? 'Testing connection…'
      : test.phase === 'success'
        ? CONNECTION_SUCCESS_MESSAGE
        : test.phase === 'failure'
          ? test.message
          : null

  return (
    <fieldset className="endpoint">
      <legend>{title}</legend>

      <div className="field">
        <label htmlFor={`${idPrefix}-host`}>Host</label>
        <input
          id={`${idPrefix}-host`}
          value={values.host}
          onChange={(event) => onChange({ host: event.target.value })}
          aria-invalid={errors.host ? true : undefined}
          aria-describedby={errors.host ? `${idPrefix}-host-error` : undefined}
        />
        {errors.host ? (
          <p className="field-error" id={`${idPrefix}-host-error`}>
            {errors.host}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-port`}>Port</label>
        <input
          id={`${idPrefix}-port`}
          value={values.port}
          inputMode="numeric"
          onChange={(event) => onChange({ port: event.target.value })}
          aria-invalid={errors.port ? true : undefined}
          aria-describedby={errors.port ? `${idPrefix}-port-error` : undefined}
        />
        {errors.port ? (
          <p className="field-error" id={`${idPrefix}-port-error`}>
            {errors.port}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-security`}>Security</label>
        <select
          id={`${idPrefix}-security`}
          value={values.security}
          onChange={(event) => onChange({ security: event.target.value as EndpointValues['security'] })}
        >
          {SECURITY_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-username`}>Username</label>
        <input
          id={`${idPrefix}-username`}
          value={values.username}
          autoComplete="username"
          onChange={(event) => onChange({ username: event.target.value })}
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={errors.username ? `${idPrefix}-username-error` : undefined}
        />
        {errors.username ? (
          <p className="field-error" id={`${idPrefix}-username-error`}>
            {errors.username}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-password`}>Password</label>
        <input
          id={`${idPrefix}-password`}
          type="password"
          value={values.password}
          autoComplete="current-password"
          onChange={(event) => onChange({ password: event.target.value })}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? `${idPrefix}-password-error` : undefined}
        />
        {errors.password ? (
          <p className="field-error" id={`${idPrefix}-password-error`}>
            {errors.password}
          </p>
        ) : null}
      </div>

      <button type="button" onClick={onTest} disabled={testDisabled}>
        {testLabel}
      </button>

      {status ? (
        <p className={`status status-${test.phase}`} role="status">
          {status}
        </p>
      ) : null}
    </fieldset>
  )
}
