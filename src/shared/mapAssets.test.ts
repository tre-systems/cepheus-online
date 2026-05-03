import { describe, it } from 'node:test'
import { expect } from '../test/expect'

import {
  deriveGeomorphTileKind,
  validateLocalMapAssetMetadata
} from './mapAssets'

describe('deriveGeomorphTileKind', () => {
  it('classifies known geomorph dimensions', () => {
    expect(deriveGeomorphTileKind(1000, 1000)).toBe('standard')
    expect(deriveGeomorphTileKind(1000, 530)).toBe('edge')
    expect(deriveGeomorphTileKind(530, 530)).toBe('corner')
  })

  it('leaves unknown dimensions as custom', () => {
    expect(deriveGeomorphTileKind(1200, 800)).toBe('custom')
  })
})

describe('validateLocalMapAssetMetadata', () => {
  it('accepts metadata for a local geomorph reference', () => {
    const result = validateLocalMapAssetMetadata({
      root: 'Geomorphs',
      relativePath: 'standard/tile-001.jpg',
      kind: 'geomorph',
      width: 1000,
      height: 1000,
      gridScale: 50
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.tileKind).toBe('standard')
    }
  })

  it('accepts metadata for a local counter reference', () => {
    const result = validateLocalMapAssetMetadata({
      root: 'Counters',
      relativePath: 'crew/sheet.png',
      kind: 'counter',
      width: 600,
      height: 600,
      gridScale: 50
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.tileKind).toBe(null)
    }
  })

  it('rejects paths outside the local asset root', () => {
    const result = validateLocalMapAssetMetadata({
      root: 'Geomorphs',
      relativePath: '../Counters/sheet.png',
      kind: 'geomorph',
      width: 1000,
      height: 1000,
      gridScale: 50
    })

    expect(result.ok).toBe(false)
  })

  it('rejects mismatched roots and asset kinds', () => {
    const result = validateLocalMapAssetMetadata({
      root: 'Counters',
      relativePath: 'standard/tile-001.jpg',
      kind: 'geomorph',
      width: 1000,
      height: 1000,
      gridScale: 50
    })

    expect(result.ok).toBe(false)
  })
})
