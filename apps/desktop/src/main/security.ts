import type { WebPreferences } from 'electron'

export const secureWebPreferences: WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
