import { describe, it } from 'node:test'
import { expect } from '../test/expect'

import {
  deriveGeomorphTileKind,
  doMapSegmentsIntersect,
  filterBlockingMapOccluders,
  filterVisibleMapTargets,
  findBlockingMapOccluderForSegment,
  hasMapLineOfSight,
  mapRectCenter,
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

  it('uses board door state when supplied', () => {
    const blocking = filterBlockingMapOccluders(
      [
        {
          type: 'door',
          id: 'door-1',
          x1: 50,
          y1: 0,
          x2: 50,
          y2: 100,
          open: false
        }
      ],
      {
        'door-1': { id: 'door-1', open: true }
      }
    )

    expect(blocking.length).toBe(0)
  })
})

describe('doMapSegmentsIntersect', () => {
  it('detects crossing and non-crossing segments deterministically', () => {
    expect(
      doMapSegmentsIntersect(
        { x1: 0, y1: 0, x2: 100, y2: 100 },
        { x1: 0, y1: 100, x2: 100, y2: 0 }
      )
    ).toBe(true)

    expect(
      doMapSegmentsIntersect(
        { x1: 0, y1: 0, x2: 100, y2: 0 },
        { x1: 0, y1: 10, x2: 100, y2: 10 }
      )
    ).toBe(false)
  })
})

describe('hasMapLineOfSight', () => {
  it('blocks visibility when a wall intersects the sight segment', () => {
    const wall = {
      type: 'wall' as const,
      id: 'wall-1',
      x1: 50,
      y1: 0,
      x2: 50,
      y2: 100
    }

    expect(hasMapLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [wall])).toBe(
      false
    )
    expect(
      findBlockingMapOccluderForSegment({ x1: 0, y1: 50, x2: 100, y2: 50 }, [
        wall
      ])?.id
    ).toBe('wall-1')
  })

  it('respects closed and open door state keyed by door id', () => {
    const door = {
      type: 'door' as const,
      id: 'door-1',
      x1: 50,
      y1: 0,
      x2: 50,
      y2: 100,
      open: false
    }

    expect(hasMapLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [door])).toBe(
      false
    )
    expect(
      hasMapLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [door], {
        'door-1': { id: 'door-1', open: true }
      })
    ).toBe(true)
    expect(
      hasMapLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [door], {
        'door-1': false
      })
    ).toBe(false)
  })

  it('ignores open doors and occluders outside the sight segment', () => {
    const openDoor = {
      type: 'door' as const,
      id: 'door-open',
      x1: 50,
      y1: 0,
      x2: 50,
      y2: 100,
      open: true
    }
    const offRayWall = {
      type: 'wall' as const,
      id: 'wall-off-ray',
      x1: 0,
      y1: 90,
      x2: 100,
      y2: 90
    }

    expect(
      hasMapLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [
        openDoor,
        offRayWall
      ])
    ).toBe(true)
  })
})

describe('mapRectCenter', () => {
  it('returns the center point of a map rectangle', () => {
    expect(mapRectCenter({ x: 10, y: 20, width: 30, height: 40 }).x).toBe(25)
    expect(mapRectCenter({ x: 10, y: 20, width: 30, height: 40 }).y).toBe(40)
  })
})

describe('filterVisibleMapTargets', () => {
  const viewer = { x: 0, y: 40, width: 20, height: 20 }

  it('keeps a target with clear center-to-center line of sight', () => {
    const targets = [
      { id: 'nearby', rect: { x: 30, y: 40, width: 20, height: 20 } }
    ]

    const visible = filterVisibleMapTargets(viewer, targets, [])

    expect(visible.length).toBe(1)
    expect(visible[0]?.id).toBe('nearby')
  })

  it('drops a target blocked by an occluder', () => {
    const targets = [
      { id: 'behind-wall', rect: { x: 90, y: 40, width: 20, height: 20 } }
    ]
    const wall = {
      type: 'wall' as const,
      id: 'wall-1',
      x1: 50,
      y1: 0,
      x2: 50,
      y2: 100
    }

    const visible = filterVisibleMapTargets(viewer, targets, [wall])

    expect(visible.length).toBe(0)
  })

  it('uses current door state to reveal targets behind open doors', () => {
    const targets = [
      { id: 'behind-door', rect: { x: 90, y: 40, width: 20, height: 20 } }
    ]
    const door = {
      type: 'door' as const,
      id: 'door-1',
      x1: 50,
      y1: 0,
      x2: 50,
      y2: 100,
      open: false
    }

    expect(filterVisibleMapTargets(viewer, targets, [door]).length).toBe(0)
    expect(
      filterVisibleMapTargets(viewer, targets, [door], {
        'door-1': { id: 'door-1', open: true }
      }).length
    ).toBe(1)
  })

  it('does not mutate target order or target data', () => {
    const targets = [
      {
        id: 'alpha',
        rect: { x: 10, y: 80, width: 20, height: 20 },
        label: 'Alpha'
      },
      {
        id: 'bravo',
        rect: { x: 40, y: 80, width: 20, height: 20 },
        label: 'Bravo'
      }
    ]
    const before = JSON.stringify(targets)

    const visible = filterVisibleMapTargets(viewer, targets, [])

    expect(JSON.stringify(targets)).toBe(before)
    expect(targets.map((target) => target.id).join(',')).toBe('alpha,bravo')
    expect(visible.map((target) => target.id).join(',')).toBe('alpha,bravo')
    expect(visible[0]).toBe(targets[0])
    expect(visible[1]).toBe(targets[1])
  })
})
