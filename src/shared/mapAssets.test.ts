import { describe, it } from 'node:test'
import { expect } from '../test/expect'

import {
  deriveGeomorphTileKind,
  filterBlockingMapOccluders,
  validateLocalMapAssetMetadata,
  validateMapLosSidecar
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

describe('validateMapLosSidecar', () => {
  it('accepts a reviewed vector LOS sidecar', () => {
    const result = validateMapLosSidecar({
      assetRef: 'asset://geomorphs/standard/tile-001',
      width: 1000,
      height: 1000,
      gridScale: 50,
      occluders: [
        {
          type: 'wall',
          id: 'wall-1',
          x1: 0,
          y1: 50,
          x2: 1000,
          y2: 50
        },
        {
          type: 'door',
          id: 'door-1',
          x1: 500,
          y1: 50,
          x2: 550,
          y2: 50,
          open: false
        }
      ]
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.occluders.length).toBe(2)
    }
  })

  it('rejects duplicate occluder ids', () => {
    const result = validateMapLosSidecar({
      assetRef: 'asset://geomorphs/standard/tile-001',
      width: 1000,
      height: 1000,
      gridScale: 50,
      occluders: [
        {
          type: 'wall',
          id: 'wall-1',
          x1: 0,
          y1: 50,
          x2: 1000,
          y2: 50
        },
        {
          type: 'wall',
          id: 'wall-1',
          x1: 0,
          y1: 100,
          x2: 1000,
          y2: 100
        }
      ]
    })

    expect(result.ok).toBe(false)
  })

  it('rejects segments outside the sidecar bounds', () => {
    const result = validateMapLosSidecar({
      assetRef: 'asset://geomorphs/standard/tile-001',
      width: 1000,
      height: 1000,
      gridScale: 50,
      occluders: [
        {
          type: 'wall',
          id: 'wall-1',
          x1: 0,
          y1: 50,
          x2: 1001,
          y2: 50
        }
      ]
    })

    expect(result.ok).toBe(false)
  })

  it('rejects zero-length segments and malformed doors', () => {
    const result = validateMapLosSidecar({
      assetRef: 'asset://geomorphs/standard/tile-001',
      width: 1000,
      height: 1000,
      gridScale: 50,
      occluders: [
        {
          type: 'door',
          id: 'door-1',
          x1: 50,
          y1: 50,
          x2: 50,
          y2: 50
        }
      ]
    })

    expect(result.ok).toBe(false)
  })
})

describe('filterBlockingMapOccluders', () => {
  it('keeps walls and closed doors while dropping open doors', () => {
    const blocking = filterBlockingMapOccluders([
      {
        type: 'wall',
        id: 'wall-1',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0
      },
      {
        type: 'door',
        id: 'door-open',
        x1: 10,
        y1: 0,
        x2: 20,
        y2: 0,
        open: true
      },
      {
        type: 'door',
        id: 'door-closed',
        x1: 30,
        y1: 0,
        x2: 40,
        y2: 0,
        open: false
      }
    ])

    expect(blocking.length).toBe(2)
    expect(blocking[0]?.id).toBe('wall-1')
    expect(blocking[1]?.id).toBe('door-closed')
  })
})
