import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ConnectionTestFailureCode,
  MigrationLifecycleEvent,
  MigrationOutput,
  SecurityMode,
} from '../../shared/contracts'
import App from './App'
import { CONNECTION_FAILURE_MESSAGES } from './endpoint'

const testConnectionMock = vi.fn()
const startMigrationMock = vi.fn()
const cancelMigrationMock = vi.fn()
const onMigrationOutputMock = vi.fn()
const onMigrationLifecycleMock = vi.fn()

const outputListeners: Array<(output: MigrationOutput) => void> = []
const lifecycleListeners: Array<(event: MigrationLifecycleEvent) => void> = []

function emitOutput(text: string): void {
  act(() => {
    for (const listener of outputListeners) {
      listener({ stream: 'stdout', text })
    }
  })
}

function emitLifecycle(event: MigrationLifecycleEvent): void {
  act(() => {
    for (const listener of lifecycleListeners) {
      listener(event)
    }
  })
}

beforeEach(() => {
  testConnectionMock.mockReset()
  startMigrationMock.mockReset()
  cancelMigrationMock.mockReset()
  onMigrationOutputMock.mockReset()
  onMigrationLifecycleMock.mockReset()
  outputListeners.length = 0
  lifecycleListeners.length = 0

  testConnectionMock.mockResolvedValue({ ok: true, message: 'ok' })
  startMigrationMock.mockResolvedValue({ ok: true, message: 'Migration started.' })
  cancelMigrationMock.mockResolvedValue({ ok: true, message: 'cancelled' })

  onMigrationOutputMock.mockImplementation((listener: (output: MigrationOutput) => void) => {
    outputListeners.push(listener)
    return () => {
      const index = outputListeners.indexOf(listener)
      if (index >= 0) {
        outputListeners.splice(index, 1)
      }
    }
  })
  onMigrationLifecycleMock.mockImplementation((listener: (event: MigrationLifecycleEvent) => void) => {
    lifecycleListeners.push(listener)
    return () => {
      const index = lifecycleListeners.indexOf(listener)
      if (index >= 0) {
        lifecycleListeners.splice(index, 1)
      }
    }
  })

  window.api = {
    testConnection: testConnectionMock,
    startMigration: startMigrationMock,
    cancelMigration: cancelMigrationMock,
    onMigrationOutput: onMigrationOutputMock,
    onMigrationLifecycle: onMigrationLifecycleMock,
  } as unknown as Window['api']
})

function sourceSection(): HTMLElement {
  return screen.getByRole('group', { name: 'Source server' })
}

function destinationSection(): HTMLElement {
  return screen.getByRole('group', { name: 'Destination server' })
}

function fillEndpoint(
  section: HTMLElement,
  values: { host: string; port: string; security: SecurityMode; username: string; password: string },
): void {
  fireEvent.change(within(section).getByLabelText('Host'), { target: { value: values.host } })
  fireEvent.change(within(section).getByLabelText('Port'), { target: { value: values.port } })
  fireEvent.change(within(section).getByLabelText('Security'), { target: { value: values.security } })
  fireEvent.change(within(section).getByLabelText('Username'), { target: { value: values.username } })
  fireEvent.change(within(section).getByLabelText('Password'), { target: { value: values.password } })
}

const sourceValues = { host: 'src.example.com', port: '993', security: 'tls' as SecurityMode, username: 'user1', password: 'secret1' }
const destinationValues = { host: 'dst.example.com', port: '993', security: 'tls' as SecurityMode, username: 'user2', password: 'secret2' }

async function fillAndTestBoth(): Promise<void> {
  fillEndpoint(sourceSection(), sourceValues)
  fillEndpoint(destinationSection(), destinationValues)
  fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))
  await screen.findByText('Connection and authentication succeeded.')
  fireEvent.click(within(destinationSection()).getByRole('button', { name: 'Test connection' }))
  await screen.findAllByText('Connection and authentication succeeded.')
}

async function beginMigration(): Promise<void> {
  await fillAndTestBoth()
  fireEvent.click(screen.getByRole('button', { name: 'Start migration' }))
  await screen.findByText('Migration running')
  await waitFor(() => expect(lifecycleListeners).toHaveLength(1))
}

function outputText(): string {
  return screen.getByRole('log').textContent ?? ''
}

describe('App migration form', () => {
  it('renders source and destination sections', () => {
    render(<App />)
    expect(sourceSection()).toBeDefined()
    expect(destinationSection()).toBeDefined()
  })

  it('defaults both endpoints to TLS on port 993', () => {
    render(<App />)
    for (const section of [sourceSection(), destinationSection()]) {
      expect((within(section).getByLabelText('Port') as HTMLInputElement).value).toBe('993')
      expect((within(section).getByLabelText('Security') as HTMLSelectElement).value).toBe('tls')
    }
  })

  it('updates the port to the new default when security mode changes', () => {
    render(<App />)
    fireEvent.change(within(sourceSection()).getByLabelText('Security'), { target: { value: 'starttls' } })
    expect((within(sourceSection()).getByLabelText('Port') as HTMLInputElement).value).toBe('143')
  })

  it('does not overwrite a custom port when security mode changes', () => {
    render(<App />)
    fireEvent.change(within(sourceSection()).getByLabelText('Port'), { target: { value: '995' } })
    fireEvent.change(within(sourceSection()).getByLabelText('Security'), { target: { value: 'starttls' } })
    expect((within(sourceSection()).getByLabelText('Port') as HTMLInputElement).value).toBe('995')
  })

  it('shows required-field validation on render', () => {
    render(<App />)
    expect(within(sourceSection()).getByText('Host is required.')).toBeDefined()
    expect(within(sourceSection()).getByText('Username is required.')).toBeDefined()
    expect(within(sourceSection()).getByText('Password is required.')).toBeDefined()
  })

  it('validates the port field', () => {
    render(<App />)
    fireEvent.change(within(sourceSection()).getByLabelText('Port'), { target: { value: 'abc' } })
    expect(within(sourceSection()).getByText('Port must be an integer between 1 and 65535.')).toBeDefined()
  })

  it('calls testConnection with the source endpoint', async () => {
    render(<App />)
    fillEndpoint(sourceSection(), sourceValues)
    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))

    await screen.findByText('Connection and authentication succeeded.')

    expect(testConnectionMock).toHaveBeenCalledWith({
      host: 'src.example.com',
      port: 993,
      security: 'tls',
      username: 'user1',
      password: 'secret1',
    })
  })

  it('calls testConnection with the destination endpoint', async () => {
    render(<App />)
    fillEndpoint(destinationSection(), destinationValues)
    fireEvent.click(within(destinationSection()).getByRole('button', { name: 'Test connection' }))

    await screen.findByText('Connection and authentication succeeded.')

    expect(testConnectionMock).toHaveBeenCalledWith({
      host: 'dst.example.com',
      port: 993,
      security: 'tls',
      username: 'user2',
      password: 'secret2',
    })
  })

  it('displays a connection test success', async () => {
    render(<App />)
    fillEndpoint(sourceSection(), sourceValues)
    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))

    expect(await screen.findByText('Connection and authentication succeeded.')).toBeDefined()
  })

  it.each(Object.keys(CONNECTION_FAILURE_MESSAGES) as ConnectionTestFailureCode[])(
    'maps the %s failure code to a user-facing message',
    async (code) => {
      testConnectionMock.mockResolvedValue({ ok: false, code, message: 'raw' })
      render(<App />)
      fillEndpoint(sourceSection(), sourceValues)
      fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))

      expect(await screen.findByText(CONNECTION_FAILURE_MESSAGES[code])).toBeDefined()
    },
  )

  it('disables the active test button while keeping the other endpoint testable', () => {
    testConnectionMock.mockImplementation(() => new Promise(() => {}))
    render(<App />)
    fillEndpoint(sourceSection(), sourceValues)
    fillEndpoint(destinationSection(), destinationValues)

    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))

    const sourceButton = within(sourceSection()).getByRole('button', { name: 'Testing…' }) as HTMLButtonElement
    const destinationButton = within(destinationSection()).getByRole('button', { name: 'Test connection' }) as HTMLButtonElement

    expect(sourceButton.disabled).toBe(true)
    expect(destinationButton.disabled).toBe(false)
  })

  it('keeps migration disabled until both endpoints pass their current test', () => {
    render(<App />)
    fillEndpoint(sourceSection(), sourceValues)
    fillEndpoint(destinationSection(), destinationValues)

    const startButton = screen.getByRole('button', { name: 'Start migration' }) as HTMLButtonElement
    expect(startButton.disabled).toBe(true)
  })

  it('enables migration after both endpoints pass their current test', async () => {
    render(<App />)
    fillEndpoint(sourceSection(), sourceValues)
    fillEndpoint(destinationSection(), destinationValues)

    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))
    await screen.findByText('Connection and authentication succeeded.')
    fireEvent.click(within(destinationSection()).getByRole('button', { name: 'Test connection' }))
    await screen.findAllByText('Connection and authentication succeeded.')

    const startButton = screen.getByRole('button', { name: 'Start migration' }) as HTMLButtonElement
    expect(startButton.disabled).toBe(false)
  })

  it('revokes migration readiness when a tested endpoint changes', async () => {
    render(<App />)
    fillEndpoint(sourceSection(), sourceValues)
    fillEndpoint(destinationSection(), destinationValues)

    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))
    await screen.findByText('Connection and authentication succeeded.')
    fireEvent.click(within(destinationSection()).getByRole('button', { name: 'Test connection' }))
    await screen.findAllByText('Connection and authentication succeeded.')

    fireEvent.change(within(sourceSection()).getByLabelText('Host'), { target: { value: 'changed.example.com' } })

    const startButton = screen.getByRole('button', { name: 'Start migration' }) as HTMLButtonElement
    expect(startButton.disabled).toBe(true)
  })

  it('does not render credentials in status output', async () => {
    testConnectionMock.mockResolvedValue({ ok: false, code: 'authentication', message: 'raw' })
    render(<App />)
    fillEndpoint(sourceSection(), { ...sourceValues, password: 'supersecret123' })
    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))

    await screen.findByText(CONNECTION_FAILURE_MESSAGES.authentication)

    expect(document.body.textContent).not.toContain('supersecret123')
  })
})

describe('App active migration', () => {
  it('transitions to the running migration view on a successful start', async () => {
    render(<App />)
    await beginMigration()

    expect(screen.getByText('Migration running')).toBeDefined()
    expect(screen.getByText('user1@src.example.com')).toBeDefined()
    expect(screen.getByText('user2@dst.example.com')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cancel migration' })).toBeDefined()
  })

  it('passes the current endpoint values to startMigration', async () => {
    render(<App />)
    await beginMigration()

    expect(startMigrationMock).toHaveBeenCalledWith({
      source: { host: 'src.example.com', port: 993, security: 'tls', username: 'user1', password: 'secret1' },
      destination: { host: 'dst.example.com', port: 993, security: 'tls', username: 'user2', password: 'secret2' },
    })
  })

  it('replaces the form while a migration is active', async () => {
    render(<App />)
    await beginMigration()

    expect(screen.queryByRole('button', { name: 'Start migration' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Source server' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel migration' })).toBeDefined()
    expect(startMigrationMock).toHaveBeenCalledTimes(1)
  })

  it('appends migration output incrementally and preserves ordering', async () => {
    render(<App />)
    await beginMigration()

    emitOutput('first line\n')
    await waitFor(() => expect(outputText()).toContain('first line'))

    emitOutput('second line\n')
    await waitFor(() => expect(outputText()).toContain('second line'))

    expect(outputText().indexOf('first line')).toBeLessThan(outputText().indexOf('second line'))
  })

  it('registers the output and lifecycle subscriptions exactly once', async () => {
    render(<App />)
    await beginMigration()

    expect(outputListeners).toHaveLength(1)
    expect(lifecycleListeners).toHaveLength(1)
  })

  it('transitions to a terminal state from the lifecycle event, not from output text', async () => {
    render(<App />)
    await beginMigration()

    emitOutput('Done\n')
    await waitFor(() => expect(outputText()).toContain('Done'))

    expect(screen.getByText('Migration running')).toBeDefined()

    emitLifecycle({ phase: 'succeeded' })

    await screen.findByText('Migration completed successfully.')
    expect(screen.queryByText('Migration running')).toBeNull()
  })

  it('removes subscriptions after the migration reaches a terminal state', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'cancelled' })
    await screen.findByText('Migration cancelled.')

    await waitFor(() => expect(outputListeners).toHaveLength(0))
    expect(lifecycleListeners).toHaveLength(0)
  })

  it('calls cancelMigration from the cancel action', async () => {
    render(<App />)
    await beginMigration()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel migration' }))

    expect(cancelMigrationMock).toHaveBeenCalledTimes(1)
  })

  it('enters a cancelling state and prevents duplicate cancel requests', async () => {
    cancelMigrationMock.mockImplementation(() => new Promise(() => {}))
    render(<App />)
    await beginMigration()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel migration' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Cancelling…'))

    const cancelButton = screen.getByRole('button', { name: 'Cancelling…' }) as HTMLButtonElement
    expect(cancelButton.disabled).toBe(true)

    fireEvent.click(cancelButton)
    expect(cancelMigrationMock).toHaveBeenCalledTimes(1)
  })

  it('keeps existing output visible while cancelling', async () => {
    render(<App />)
    await beginMigration()

    emitOutput('progress so far\n')
    await waitFor(() => expect(outputText()).toContain('progress so far'))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel migration' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Cancelling…'))

    expect(outputText()).toContain('progress so far')
  })

  it('handles immediate cancellation failure and allows retry', async () => {
    cancelMigrationMock.mockResolvedValue({ ok: false, message: 'no' })
    render(<App />)
    await beginMigration()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel migration' }))

    await screen.findByText('Could not cancel the migration. Please try again.')
    expect(screen.getByText('Migration running')).toBeDefined()

    const cancelButton = screen.getByRole('button', { name: 'Cancel migration' }) as HTMLButtonElement
    expect(cancelButton.disabled).toBe(false)
  })

  it('does not render credentials in the active migration view', async () => {
    render(<App />)
    fillEndpoint(sourceSection(), { ...sourceValues, password: 'supersecret123' })
    fillEndpoint(destinationSection(), destinationValues)
    fireEvent.click(within(sourceSection()).getByRole('button', { name: 'Test connection' }))
    await screen.findByText('Connection and authentication succeeded.')
    fireEvent.click(within(destinationSection()).getByRole('button', { name: 'Test connection' }))
    await screen.findAllByText('Connection and authentication succeeded.')
    fireEvent.click(screen.getByRole('button', { name: 'Start migration' }))
    await screen.findByText('Migration running')

    expect(document.body.textContent).not.toContain('supersecret123')
  })
})

describe('App migration result', () => {
  it('renders the success result on a succeeded lifecycle event', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'succeeded' })

    await screen.findByText('Migration completed successfully.')
    expect(screen.getByRole('button', { name: 'Start another migration' })).toBeDefined()
  })

  it('renders the failure result with its message on a failed lifecycle event', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'failed', message: 'Migration exited with code 1.' })

    await screen.findByText('Migration failed.')
    expect(screen.getByText('Migration exited with code 1.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Start another migration' })).toBeDefined()
  })

  it('renders the cancelled result without labelling it a failure', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'cancelled' })

    await screen.findByText('Migration cancelled.')
    expect(screen.queryByText('Migration failed.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start another migration' })).toBeDefined()
  })

  it('shows safe identities and preserves output on the result screen', async () => {
    render(<App />)
    await beginMigration()

    emitOutput('transferred messages\n')
    await waitFor(() => expect(outputText()).toContain('transferred messages'))

    emitLifecycle({ phase: 'succeeded' })
    await screen.findByText('Migration completed successfully.')

    expect(screen.getByText('user1@src.example.com')).toBeDefined()
    expect(screen.getByText('user2@dst.example.com')).toBeDefined()
    expect(outputText()).toContain('transferred messages')
    expect(document.body.textContent).not.toContain('secret1')
  })

  it('does not expose raw errors or stack traces on failure', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'failed', message: 'Migration exited with code 1.' })
    await screen.findByText('Migration failed.')

    expect(document.body.textContent).not.toContain('Error:')
    expect(document.body.textContent).not.toContain('at ')
    expect(document.body.textContent).not.toContain('stack')
  })

  it('returns to the form and clears terminal state', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'succeeded' })
    await screen.findByText('Migration completed successfully.')

    fireEvent.click(screen.getByRole('button', { name: 'Start another migration' }))

    expect(screen.getByRole('group', { name: 'Source server' })).toBeDefined()
    expect(screen.queryByRole('log')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start migration' })).toBeDefined()
  })

  it('preserves field values but invalidates prior connection tests on return', async () => {
    render(<App />)
    await beginMigration()

    emitLifecycle({ phase: 'succeeded' })
    await screen.findByText('Migration completed successfully.')

    fireEvent.click(screen.getByRole('button', { name: 'Start another migration' }))

    expect((within(sourceSection()).getByLabelText('Host') as HTMLInputElement).value).toBe('src.example.com')
    expect((within(destinationSection()).getByLabelText('Host') as HTMLInputElement).value).toBe('dst.example.com')

    const startButton = screen.getByRole('button', { name: 'Start migration' }) as HTMLButtonElement
    expect(startButton.disabled).toBe(true)
  })

  it('clears previous output and requires fresh tests for a new migration', async () => {
    render(<App />)
    await beginMigration()

    emitOutput('old output\n')
    await waitFor(() => expect(outputText()).toContain('old output'))

    emitLifecycle({ phase: 'succeeded' })
    await screen.findByText('Migration completed successfully.')

    fireEvent.click(screen.getByRole('button', { name: 'Start another migration' }))

    await fillAndTestBoth()
    fireEvent.click(screen.getByRole('button', { name: 'Start migration' }))
    await screen.findByText('Migration running')

    expect(outputText()).not.toContain('old output')
    expect(startMigrationMock).toHaveBeenCalledTimes(2)
  })
})

describe('App lifecycle subscription race', () => {
  it('reaches the terminal state when lifecycle fires immediately after start', async () => {
    render(<App />)
    await fillAndTestBoth()

    fireEvent.click(screen.getByRole('button', { name: 'Start migration' }))

    // The lifecycle listener is registered before startMigration resolves, so
    // an immediately-terminating process must still be caught.
    emitLifecycle({ phase: 'succeeded' })

    await screen.findByText('Migration completed successfully.')
    expect(screen.getByRole('button', { name: 'Start another migration' })).toBeDefined()
  })

  it('cleans up listeners when startMigration fails immediately', async () => {
    startMigrationMock.mockResolvedValue({ ok: false, message: 'runtime unavailable' })
    render(<App />)
    await fillAndTestBoth()

    fireEvent.click(screen.getByRole('button', { name: 'Start migration' }))

    await screen.findByText('runtime unavailable')

    expect(lifecycleListeners).toHaveLength(0)
    expect(outputListeners).toHaveLength(0)
  })

  it('does not leak listeners across two migrations', async () => {
    render(<App />)
    await beginMigration()
    emitLifecycle({ phase: 'succeeded' })
    await screen.findByText('Migration completed successfully.')

    fireEvent.click(screen.getByRole('button', { name: 'Start another migration' }))

    expect(lifecycleListeners).toHaveLength(0)
    expect(outputListeners).toHaveLength(0)

    await fillAndTestBoth()
    fireEvent.click(screen.getByRole('button', { name: 'Start migration' }))
    await screen.findByText('Migration running')

    expect(lifecycleListeners).toHaveLength(1)
    expect(outputListeners).toHaveLength(1)
  })
})
