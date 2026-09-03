import { useEffect, useRef } from 'react'

export type MigrationViewPhase = 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled'

interface MigrationViewProps {
  phase: MigrationViewPhase
  source: string
  destination: string
  output: string
  failureMessage: string | null
  cancelError: string | null
  onCancel: () => void
  onStartAnother: () => void
}

const STATUS_TEXT: Record<MigrationViewPhase, string> = {
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
  cancelError,
  onCancel,
  onStartAnother,
}: MigrationViewProps) {
  const outputRef = useRef<HTMLPreElement>(null)
  const stickToBottomRef = useRef(true)

  const terminal = phase === 'succeeded' || phase === 'failed' || phase === 'cancelled'

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

  return (
    <section className="migration" aria-label="Migration">
      <header className="migration-header">
        <h2 className={`migration-status status-${phase}`} role="status">
          {STATUS_TEXT[phase]}
        </h2>
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
        <button type="button" onClick={onStartAnother}>
          Start another migration
        </button>
      ) : (
        <button type="button" onClick={onCancel} disabled={phase === 'cancelling'}>
          {phase === 'cancelling' ? 'Cancelling…' : 'Cancel migration'}
        </button>
      )}

      {cancelError ? (
        <p className="status status-failure" role="alert">
          {cancelError}
        </p>
      ) : null}

      <pre
        ref={outputRef}
        className="output"
        role="log"
        aria-label="Migration output"
        onScroll={handleScroll}
      >
        {output}
      </pre>
    </section>
  )
}
