import { describe, expect, it } from 'vitest'
import {
  APP_ID,
  artifactBaseName,
  distributionArtifactNames,
  MAC_SIGN_IDENTITY,
  MAC_TARGETS,
  PRODUCT_NAME,
  SUPPORTED_TARGET_ARCHES,
} from './packaging'

describe('packaging identity', () => {
  it('uses a stable bundle identifier and product name', () => {
    expect(APP_ID).toBe('com.imapsyncgui.desktop')
    expect(PRODUCT_NAME).toBe('imapSyncGUI')
  })

  it('supports only x64 and arm64 (no universal build)', () => {
    expect(SUPPORTED_TARGET_ARCHES).toEqual(['x64', 'arm64'])
    expect(SUPPORTED_TARGET_ARCHES).not.toContain('universal')
  })

  it('targets DMG (primary) and ZIP (secondary)', () => {
    expect(MAC_TARGETS).toEqual(['dmg', 'zip'])
  })

  it('uses ad-hoc signing (no Developer ID)', () => {
    expect(MAC_SIGN_IDENTITY).toBe('-')
  })
})

describe('artifactBaseName', () => {
  it('names artifacts deterministically with the architecture', () => {
    expect(artifactBaseName('imapSyncGUI', '0.1.0', 'x64')).toBe('imapSyncGUI-0.1.0-mac-x64')
    expect(artifactBaseName('imapSyncGUI', '0.1.0', 'arm64')).toBe('imapSyncGUI-0.1.0-mac-arm64')
  })

  it('produces distinct names for the two architectures', () => {
    expect(artifactBaseName('imapSyncGUI', '0.1.0', 'x64')).not.toBe(
      artifactBaseName('imapSyncGUI', '0.1.0', 'arm64'),
    )
  })
})

describe('distributionArtifactNames', () => {
  it('produces DMG and ZIP names for each architecture', () => {
    expect(distributionArtifactNames('imapSyncGUI', '0.1.0', 'x64')).toEqual([
      'imapSyncGUI-0.1.0-mac-x64.dmg',
      'imapSyncGUI-0.1.0-mac-x64.zip',
    ])
    expect(distributionArtifactNames('imapSyncGUI', '0.1.0', 'arm64')).toEqual([
      'imapSyncGUI-0.1.0-mac-arm64.dmg',
      'imapSyncGUI-0.1.0-mac-arm64.zip',
    ])
  })

  it('keeps the architecture unambiguous in every filename', () => {
    for (const arch of SUPPORTED_TARGET_ARCHES) {
      for (const name of distributionArtifactNames('imapSyncGUI', '0.1.0', arch)) {
        expect(name).toContain(`mac-${arch}`)
      }
    }
  })
})
