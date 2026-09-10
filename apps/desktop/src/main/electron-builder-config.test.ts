import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

interface BuilderMacConfig {
  category: string
  target: string[]
  artifactName: string
  identity: string | null
  hardenedRuntime: boolean
}

interface BuilderDmgConfig {
  title: string
  contents: { x: number; y: number; type?: string; path?: string }[]
}

interface BuilderWinConfig {
  target: string[]
  artifactName: string
}

interface BuilderNsisConfig {
  oneClick: boolean
  perMachine: boolean
  allowToChangeInstallationDirectory: boolean
}

interface BuilderConfig {
  appId: string
  productName: string
  files: string[]
  extraResources: { from: string; to: string }[]
  asar: boolean
  mac: BuilderMacConfig
  dmg: BuilderDmgConfig
  win: BuilderWinConfig
  nsis: BuilderNsisConfig
}

const require = createRequire(import.meta.url)

function loadConfig(env: Record<string, string> = {}): BuilderConfig {
  const previous: Record<string, string | undefined> = {}
  for (const key of ['TARGET_PLATFORM', 'TARGET_ARCH']) {
    previous[key] = process.env[key]
    if (env[key] !== undefined) {
      process.env[key] = env[key]
    } else {
      delete process.env[key]
    }
  }
  const configPath = require.resolve('../../electron-builder.config.cjs')
  delete require.cache[configPath]
  const loaded = require('../../electron-builder.config.cjs') as BuilderConfig
  for (const key of ['TARGET_PLATFORM', 'TARGET_ARCH']) {
    if (previous[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previous[key]
    }
  }
  return loaded
}

afterEach(() => {
  delete process.env.TARGET_PLATFORM
  delete process.env.TARGET_ARCH
})

describe('electron-builder configuration (macOS)', () => {
  const config = loadConfig({ TARGET_PLATFORM: 'darwin', TARGET_ARCH: 'x64' })

  it('produces DMG (primary) and ZIP (secondary) targets', () => {
    expect(config.mac.target).toEqual(['dmg', 'zip'])
  })

  it('uses ad-hoc signing, not a Developer ID, and disables hardened runtime', () => {
    expect(config.mac.identity).toBe('-')
    expect(config.mac.hardenedRuntime).toBe(false)
  })

  it('keeps architecture unambiguous in the artifact filename', () => {
    expect(config.mac.artifactName).toContain('${arch}')
    expect(config.mac.artifactName).toContain('mac')
  })

  it('provides a conventional DMG layout with an Applications link', () => {
    expect(config.dmg.title).toContain('${productName}')
    const link = config.dmg.contents.find((entry) => entry.type === 'link')
    expect(link).toBeDefined()
    expect(link?.path).toBe('/Applications')
  })

  it('bundles the matching per-architecture runtime outside ASAR', () => {
    expect(config.asar).toBe(true)
    expect(config.files).toEqual(['out/**/*', 'package.json'])
    expect(config.extraResources).toEqual([
      { from: 'runtime/darwin-x64', to: 'runtime/darwin-x64' },
    ])
  })
})

describe('electron-builder configuration (Windows)', () => {
  const config = loadConfig({ TARGET_PLATFORM: 'win32', TARGET_ARCH: 'x64' })

  it('targets NSIS only', () => {
    expect(config.win.target).toEqual(['nsis'])
  })

  it('names the installer with the Windows platform and architecture', () => {
    expect(config.win.artifactName).toContain('${arch}')
    expect(config.win.artifactName).toContain('windows')
    expect(config.win.artifactName).toContain('setup')
  })

  it('uses a per-user, assisted installer without elevated privileges', () => {
    expect(config.nsis.oneClick).toBe(false)
    expect(config.nsis.perMachine).toBe(false)
    expect(config.nsis.allowToChangeInstallationDirectory).toBe(true)
  })

  it('bundles the win32-x64 runtime outside ASAR', () => {
    expect(config.asar).toBe(true)
    expect(config.files).toEqual(['out/**/*', 'package.json'])
    expect(config.extraResources).toEqual([
      { from: 'runtime/win32-x64', to: 'runtime/win32-x64' },
    ])
  })
})

describe('electron-builder configuration (cross-host safety)', () => {
  it('rejects a CLI target that conflicts with an explicit TARGET_PLATFORM', () => {
    const previousArgv = process.argv
    process.argv = [...previousArgv, '--win', '--x64']
    try {
      expect(() => loadConfig({ TARGET_PLATFORM: 'darwin', TARGET_ARCH: 'x64' })).toThrow(/conflicting/i)
    } finally {
      process.argv = previousArgv
    }
  })
})
