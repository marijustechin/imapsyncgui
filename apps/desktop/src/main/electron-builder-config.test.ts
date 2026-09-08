import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

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

interface BuilderConfig {
  appId: string
  productName: string
  files: string[]
  extraResources: { from: string; to: string }[]
  asar: boolean
  mac: BuilderMacConfig
  dmg: BuilderDmgConfig
}

const require = createRequire(import.meta.url)
const config = require('../../electron-builder.config.cjs') as BuilderConfig

describe('electron-builder configuration', () => {
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
