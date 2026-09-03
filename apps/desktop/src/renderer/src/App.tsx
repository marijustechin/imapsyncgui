import { useEffect, useRef, useState } from 'react'
import { EndpointForm, type TestState } from './EndpointForm'
import { MigrationView, type MigrationViewPhase } from './MigrationView'
import {
  CONNECTION_FAILURE_MESSAGES,
  CONNECTION_SUCCESS_MESSAGE,
  DEFAULT_PORTS,
  emptyEndpointValues,
  endpointsEqual,
  hasErrors,
  toEndpoint,
  validateEndpointValues,
  type EndpointValues,
} from './endpoint'
import { appendOutput } from './output'

type MigrationState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'startFailed'; message: string }
  | { phase: 'running' }
  | { phase: 'cancelling' }
  | { phase: 'succeeded' }
  | { phase: 'failed'; message: string }
  | { phase: 'cancelled' }

interface SideState {
  values: EndpointValues
  test: TestState
}

interface Identities {
  source: string
  destination: string
}

type Side = 'source' | 'destination'

function isMigrationViewPhase(phase: MigrationState['phase']): phase is MigrationViewPhase {
  return (
    phase === 'running' ||
    phase === 'cancelling' ||
    phase === 'succeeded' ||
    phase === 'failed' ||
    phase === 'cancelled'
  )
}

function App() {
  const [source, setSource] = useState<SideState>({ values: emptyEndpointValues(), test: { phase: 'idle' } })
  const [destination, setDestination] = useState<SideState>({ values: emptyEndpointValues(), test: { phase: 'idle' } })
  const [migration, setMigration] = useState<MigrationState>({ phase: 'idle' })
  const [output, setOutput] = useState('')
  const [identities, setIdentities] = useState<Identities | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const terminalRef = useRef(false)

  const sourceErrors = validateEndpointValues(source.values)
  const destinationErrors = validateEndpointValues(destination.values)

  const bothValid = !hasErrors(sourceErrors) && !hasErrors(destinationErrors)
  const bothTested = source.test.phase === 'success' && destination.test.phase === 'success'
  const canStart = bothValid && bothTested && (migration.phase === 'idle' || migration.phase === 'startFailed')

  function cleanupSubscription(): void {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
  }

  function subscribeMigration(): void {
    cleanupSubscription()
    terminalRef.current = false

    const unsubscribeOutput = window.api.onMigrationOutput((event) => {
      setOutput((prev) => appendOutput(prev, event.text))
    })

    const unsubscribeLifecycle = window.api.onMigrationLifecycle((event) => {
      terminalRef.current = true
      setMigration((prev) => {
        if (prev.phase !== 'starting' && prev.phase !== 'running' && prev.phase !== 'cancelling') {
          return prev
        }
        if (event.phase === 'succeeded') {
          return { phase: 'succeeded' }
        }
        if (event.phase === 'cancelled') {
          return { phase: 'cancelled' }
        }
        return { phase: 'failed', message: event.message }
      })
      cleanupSubscription()
    })

    unsubscribeRef.current = () => {
      unsubscribeOutput()
      unsubscribeLifecycle()
    }
  }

  useEffect(() => {
    return () => {
      cleanupSubscription()
    }
  }, [])

  function updateSide(side: Side, patch: Partial<EndpointValues>): void {
    const setState = side === 'source' ? setSource : setDestination
    setState((prev) => {
      const values = { ...prev.values, ...patch }
      if (patch.security !== undefined && patch.security !== prev.values.security) {
        const oldDefault = String(DEFAULT_PORTS[prev.values.security])
        if (prev.values.port === oldDefault) {
          values.port = String(DEFAULT_PORTS[patch.security])
        }
      }
      return { values, test: { phase: 'idle' } }
    })
  }

  async function handleTest(side: Side): Promise<void> {
    const setState = side === 'source' ? setSource : setDestination
    const current = side === 'source' ? source : destination
    const tested = { ...current.values }

    setState((prev) => ({ ...prev, test: { phase: 'running' } }))

    const result = await window.api.testConnection(toEndpoint(tested))

    setState((prev) => {
      if (!endpointsEqual(tested, prev.values)) {
        return { ...prev, test: { phase: 'idle' } }
      }
      if (result.ok) {
        return { ...prev, test: { phase: 'success', message: CONNECTION_SUCCESS_MESSAGE } }
      }
      return { ...prev, test: { phase: 'failure', message: CONNECTION_FAILURE_MESSAGES[result.code] } }
    })
  }

  async function handleStart(): Promise<void> {
    if (hasErrors(validateEndpointValues(source.values))) {
      return
    }
    if (hasErrors(validateEndpointValues(destination.values))) {
      return
    }
    if (source.test.phase !== 'success' || destination.test.phase !== 'success') {
      return
    }
    if (migration.phase === 'starting') {
      return
    }

    const input = { source: toEndpoint(source.values), destination: toEndpoint(destination.values) }

    setIdentities({
      source: `${input.source.username}@${input.source.host}`,
      destination: `${input.destination.username}@${input.destination.host}`,
    })
    setOutput('')
    setCancelError(null)

    // Subscribe before starting so an immediately-terminating process cannot
    // be missed.
    subscribeMigration()
    setMigration({ phase: 'starting' })

    const result = await window.api.startMigration(input)

    if (result.ok) {
      if (!terminalRef.current) {
        setMigration({ phase: 'running' })
      }
    } else {
      cleanupSubscription()
      setMigration({ phase: 'startFailed', message: result.message })
    }
  }

  async function handleCancel(): Promise<void> {
    if (migration.phase !== 'running') {
      return
    }
    setMigration({ phase: 'cancelling' })
    const result = await window.api.cancelMigration()
    if (!result.ok) {
      setCancelError('Could not cancel the migration. Please try again.')
      setMigration((prev) => (prev.phase === 'cancelling' ? { phase: 'running' } : prev))
    }
  }

  function handleStartAnother(): void {
    cleanupSubscription()
    setMigration({ phase: 'idle' })
    setOutput('')
    setCancelError(null)
    setIdentities(null)
    setSource((prev) => ({ ...prev, test: { phase: 'idle' } }))
    setDestination((prev) => ({ ...prev, test: { phase: 'idle' } }))
  }

  const startLabel = migration.phase === 'starting' ? 'Starting…' : 'Start migration'

  if (isMigrationViewPhase(migration.phase) && identities) {
    return (
      <MigrationView
        phase={migration.phase}
        source={identities.source}
        destination={identities.destination}
        output={output}
        failureMessage={migration.phase === 'failed' ? migration.message : null}
        cancelError={cancelError}
        onCancel={handleCancel}
        onStartAnother={handleStartAnother}
      />
    )
  }

  return (
    <main className="app">
      <header className="header">
        <h1>imapSyncGUI</h1>
        <p className="subtitle">Migrate email between IMAP servers with a simple desktop interface.</p>
      </header>

      <div className="endpoints">
        <EndpointForm
          idPrefix="source"
          title="Source server"
          values={source.values}
          errors={sourceErrors}
          test={source.test}
          onChange={(patch) => updateSide('source', patch)}
          onTest={() => handleTest('source')}
        />
        <EndpointForm
          idPrefix="destination"
          title="Destination server"
          values={destination.values}
          errors={destinationErrors}
          test={destination.test}
          onChange={(patch) => updateSide('destination', patch)}
          onTest={() => handleTest('destination')}
        />
      </div>

      <div className="start">
        <button type="button" onClick={handleStart} disabled={!canStart}>
          {startLabel}
        </button>
        {migration.phase === 'startFailed' ? (
          <p className="status status-failure" role="alert">
            {migration.message}
          </p>
        ) : null}
      </div>
    </main>
  )
}

export default App
