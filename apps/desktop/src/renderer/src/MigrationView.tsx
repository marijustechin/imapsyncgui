import { useEffect, useRef } from 'react'

export type MigrationViewPhase = 'starting' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled'

interface MigrationViewProps {
  phase: MigrationViewPhase
  source: string
  destination: string
  output: string
  failureMessage: string | null
  failureExitCode: number | null
  cancelError: string | null
  onCancel: () => void
  onStartAnother: () => void
}

const STATUS_TEXT: Record<MigrationViewPhase, string> = {
  starting: 'Starting migration…',
  running: 'Migration running',
  cancelling: 'Cancelling…',
  succeeded: 'Migration completed successfully.',
  failed: 'Migration failed.',
  cancelled: 'Migration cancelled.',
}

export function MigrationView({
  phase,
  source,
  destination,
  output,
  failureMessage,
  failureExitCode,
  cancelError,
  onCancel,
  onStartAnother,
}: MigrationViewProps) {
  const outputRef = useRef<HTMLPreElement>(null)
  const stickToBottomRef = useRef(true)

  const terminal = phase === 'succeeded' || phase === 'failed' || phase === 'cancelled'
  const active = !terminal

  useEffect(() => {
    const element = outputRef.current
    if (element && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [output])

  function handleScroll(): void {
    const element = outputRef.current
    if (!element) {
      return
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    stickToBottomRef.current = distanceFromBottom < 30
  }

  const outputPanel = (
    <pre
      ref={outputRef}
      className="output"
      role="log"
      aria-label="Migration output"
      onScroll={handleScroll}
    >
      {output}
    </pre>
  )

  return (
    <section className="migration" aria-label="Migration">
      <header className="migration-header">
        <div className="migration-status-row">
          {active ? <span className="spinner" aria-hidden="true" /> : null}
          <h2 className={`migration-status status-${phase}`} role="status">
            {STATUS_TEXT[phase]}
          </h2>
        </div>
        {phase === 'failed' && failureMessage ? (
          <p className="status status-failure" role="alert">
            {failureMessage}
          </p>
        ) : null}
        <dl className="mailboxes">
          <div>
            <dt>Source</dt>
            <dd>{source}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>{destination}</dd>
          </div>
        </dl>
      </header>

      {terminal ? (
        <>
          <button type="button" onClick={onStartAnother}>
            Start another migration
          </button>

          <details className="technical-details">
            <summary>Technical details</summary>
            {phase === 'failed' && failureExitCode !== null ? (
              <p className="technical-exit-code">imapsync exit code: {failureExitCode}</p>
            ) : null}
            {output.length > 0 ? (
              <div className="output-container">{outputPanel}</div>
            ) : (
              <p className="technical-empty">No output was captured.</p>
            )}
          </details>
        </>
      ) : (
        <>
          <button type="button" onClick={onCancel} disabled={phase === 'cancelling'}>
            {phase === 'cancelling' ? 'Cancelling…' : 'Cancel migration'}
          </button>

          <div className="output-container">
            {outputPanel}
            {output.length === 0 ? <p className="output-placeholder">Waiting for imapsync output…</p> : null}
          </div>
        </>
      )}

      {cancelError ? (
        <p className="status status-failure" role="alert">
          {cancelError}
        </p>
      ) : null}
    </section>
  )
}
