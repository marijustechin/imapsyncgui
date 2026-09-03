import { app, BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IPC_CHANNELS, type ConnectionTestResult, type ImapEndpoint } from '../shared/contracts'
import { testConnection } from './imap/client'
import { createNodeSocketLayer } from './imap/socketLayer'
import { MigrationAdapter } from './imapsync/adapter'
import { createNodeProcessLauncher } from './imapsync/launcher'
import { toLifecycleEvent } from './imapsync/lifecycle'
import { registerIpcHandlers } from './ipc'
import { resolveAndValidateRuntime, type RuntimeFs } from './runtime'
import { secureWebPreferences } from './security'

const nodeRuntimeFs: RuntimeFs = {
  exists: (path) => existsSync(path),
  readFile: (path) => {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return null
    }
  },
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    title: 'imapSyncGUI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      ...secureWebPreferences,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

function createAdapter(): MigrationAdapter {
  const resolution = resolveAndValidateRuntime(
    {
      isPackaged: app.isPackaged,
      arch: process.arch,
      env: process.env,
      resourcesPath: process.resourcesPath,
    },
    nodeRuntimeFs,
  )

  if (!resolution.ok) {
    return new MigrationAdapter({
      launcher: createNodeProcessLauncher(),
      executable: '',
      unavailableMessage: resolution.message,
      onOutput: (output) => broadcast(IPC_CHANNELS.output, output),
      onResult: (result) => broadcast(IPC_CHANNELS.lifecycle, toLifecycleEvent(result)),
    })
  }

  return new MigrationAdapter({
    launcher: createNodeProcessLauncher(),
    executable: resolution.executable,
    prefixArgs: resolution.prefixArgs,
    cwd: tmpdir(),
    onOutput: (output) => broadcast(IPC_CHANNELS.output, output),
    onResult: (result) => broadcast(IPC_CHANNELS.lifecycle, toLifecycleEvent(result)),
  })
}

function createConnectionTester(): (endpoint: ImapEndpoint) => Promise<ConnectionTestResult> {
  const layer = createNodeSocketLayer()
  return (endpoint) => testConnection(endpoint, layer)
}

app.whenReady().then(() => {
  registerIpcHandlers(createAdapter(), createConnectionTester())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
