import { contextBridge, ipcRenderer } from 'electron'
import { createApi } from './api'

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
  ipcRenderer.invoke(channel, ...args)

const subscribe = (channel: string, listener: (...args: unknown[]) => void): (() => void) => {
  const wrapped = (_event: unknown, ...args: unknown[]): void => listener(...args)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('api', createApi(invoke, subscribe))
