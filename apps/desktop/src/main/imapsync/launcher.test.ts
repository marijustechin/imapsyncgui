import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('node:child_process', () => {
  const mockedSpawn = (...args: unknown[]) => spawnMock(...args)
  return { default: { spawn: mockedSpawn }, spawn: mockedSpawn }
})

import { createNodeProcessLauncher } from './launcher'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
}

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn().mockReturnValue(true)
  return child
}

describe('createNodeProcessLauncher', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('spawns the executable with an argument array and no shell', () => {
    spawnMock.mockReturnValue(createFakeChild())

    const launcher = createNodeProcessLauncher()
    launcher({ executable: 'imapsync', args: ['--host1', 'example.com'], env: { IMAPSYNC_PASSWORD1: 'secret' } })

    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [executable, args, options] = spawnMock.mock.calls[0]
    expect(executable).toBe('imapsync')
    expect(Array.isArray(args)).toBe(true)
    expect(args).toEqual(['--host1', 'example.com'])
    expect(options.shell).toBeUndefined()
    expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe'])
    expect(options.env.IMAPSYNC_PASSWORD1).toBe('secret')
  })

  it('passes an explicit cwd to spawn', () => {
    spawnMock.mockReturnValue(createFakeChild())

    const launcher = createNodeProcessLauncher()
    launcher({ executable: 'imapsync', args: [], cwd: '/tmp/imapsyncgui' })

    const [, , options] = spawnMock.mock.calls[0]
    expect(options.cwd).toBe('/tmp/imapsyncgui')
  })

  it('routes kill to the underlying child process', () => {
    const child = createFakeChild()
    spawnMock.mockReturnValue(child)

    const process = createNodeProcessLauncher()({ executable: 'imapsync', args: [] })
    process.kill('SIGTERM')

    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('forwards stdout and stderr data events incrementally', () => {
    const child = createFakeChild()
    spawnMock.mockReturnValue(child)

    const process = createNodeProcessLauncher()({ executable: 'imapsync', args: [] })
    const stdout: string[] = []
    const stderr: string[] = []
    process.onData((chunk) => stdout.push(chunk.toString()), 'stdout')
    process.onData((chunk) => stderr.push(chunk.toString()), 'stderr')

    child.stdout.emit('data', Buffer.from('first\n'))
    child.stderr.emit('data', Buffer.from('warn\n'))
    child.stdout.emit('data', Buffer.from('second\n'))

    expect(stdout).toEqual(['first\n', 'second\n'])
    expect(stderr).toEqual(['warn\n'])
  })
})
