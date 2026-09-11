import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MigrationView } from './MigrationView'

function renderView(overrides: Partial<ComponentProps<typeof MigrationView>> = {}) {
  const onCancel = vi.fn()
  const onStartAnother = vi.fn()
  const props: ComponentProps<typeof MigrationView> = {
    phase: 'running',
    source: 'user1@src.example.com',
    destination: 'user2@dst.example.com',
    output: '',
    failureMessage: null,
    failureExitCode: null,
    cancelError: null,
    onCancel,
    onStartAnother,
    ...overrides,
  }
  const view = render(<MigrationView {...props} />)
  return { ...view, onCancel, onStartAnother }
}

function logText(): string {
  return screen.getByRole('log', { hidden: true }).textContent ?? ''
}

describe('MigrationView', () => {
  it('shows the running status, a live indicator, and the log immediately', () => {
    const { container } = renderView({ phase: 'running' })

    expect(screen.getByRole('status').textContent).toBe('Migration running')
    expect(container.querySelector('.spinner')).not.toBeNull()
    expect(screen.getByRole('log')).toBeDefined()
    expect(screen.getByText('Waiting for imapsync output…')).toBeDefined()
  })

  it('shows the starting status and keeps the cancel action available', () => {
    const { container, onCancel } = renderView({ phase: 'starting' })

    expect(screen.getByRole('status').textContent).toBe('Starting migration…')
    expect(container.querySelector('.spinner')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel migration' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables the cancel action while cancelling', () => {
    const { container } = renderView({ phase: 'cancelling' })

    const button = screen.getByRole('button', { name: 'Cancelling…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(container.querySelector('.spinner')).not.toBeNull()
  })

  it('hides the placeholder once output is available', () => {
    renderView({ phase: 'running', output: 'transferring messages\n' })

    expect(screen.getByRole('log').textContent).toBe('transferring messages\n')
    expect(screen.queryByText('Waiting for imapsync output…')).toBeNull()
  })

  it('shows the success state with the preserved output and no live indicator', () => {
    const { container } = renderView({ phase: 'succeeded', output: 'done\n' })

    expect(screen.getByRole('status').textContent).toBe('Migration completed successfully.')
    expect(logText()).toBe('done\n')
    expect(container.querySelector('.spinner')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start another migration' })).toBeDefined()
  })

  it('shows the concise failure message as primary and keeps diagnostics secondary', () => {
    const { container } = renderView({
      phase: 'failed',
      failureMessage: 'Migration could not start correctly because the bundled migration runtime failed to load a required component.',
      failureExitCode: 2,
      output: 'Can\'t load .../SSLeay.bundle: Library not loaded: /opt/homebrew/opt/openssl@3/lib/libssl.3.dylib\n',
    })

    expect(screen.getByRole('status').textContent).toBe('Migration failed.')
    expect(screen.getByRole('alert').textContent).toBe(
      'Migration could not start correctly because the bundled migration runtime failed to load a required component.',
    )

    // Raw diagnostics live in a collapsed secondary section, not the primary UI.
    const details = container.querySelector('details.technical-details') as HTMLDetailsElement | null
    expect(details).not.toBeNull()
    expect(details?.open).toBe(false)
    expect(details?.querySelector('summary')?.textContent).toBe('Technical details')
    expect(details?.querySelector('.technical-exit-code')?.textContent).toContain('2')
    expect(logText()).toContain('Library not loaded')
  })

  it('does not render a technical details section while the migration is active', () => {
    const { container } = renderView({ phase: 'running', output: 'working\n' })

    expect(container.querySelector('details.technical-details')).toBeNull()
    expect(screen.getByRole('log').textContent).toBe('working\n')
  })

  it('shows cancellation distinctly from failure', () => {
    renderView({ phase: 'cancelled', output: 'stopped\n' })

    expect(screen.getByRole('status').textContent).toBe('Migration cancelled.')
    expect(screen.queryByText('Migration failed.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start another migration' })).toBeDefined()
  })

  it('surfaces a cancel error without leaving the running state', () => {
    renderView({ phase: 'running', cancelError: 'Could not cancel the migration. Please try again.' })

    expect(screen.getByRole('alert').textContent).toBe('Could not cancel the migration. Please try again.')
    expect(screen.getByRole('status').textContent).toBe('Migration running')
  })

  it('invokes the start-another action from a terminal state', () => {
    const { onStartAnother } = renderView({ phase: 'succeeded' })

    fireEvent.click(screen.getByRole('button', { name: 'Start another migration' }))
    expect(onStartAnother).toHaveBeenCalledTimes(1)
  })
})
