import { describe, it } from 'node:test'
import { expect } from '../../../test/expect'

import type { MapOccluder } from '../../../shared/mapAssets'
import { asBoardId, asPieceId } from '../../../shared/ids'
import type { BoardState, PieceState } from '../../../shared/state'
import {
  deriveDoorToggleViewModels,
  deriveLosOverlaySegments,
  derivePieceRectTargets,
  deriveVisiblePieceIds
} from './los-view'

const board = (): BoardState => ({
  id: asBoardId('board'),
  name: 'Board',
  imageAssetId: null,
  url: null,
  width: 200,
  height: 100,
  scale: 50,
  doors: {
    'door-open': { id: 'door-open', open: true },
    'door-closed': { id: 'door-closed', open: false }
  }
})

const piece = (
  id: string,
  x: number,
  y: number,
  z = 0,
  scale = 1
): PieceState => ({
  id: asPieceId(id),
  boardId: asBoardId('board'),
  characterId: null,
  imageAssetId: null,
  name: id,
  x,
  y,
  z,
  width: 20,
  height: 20,
  scale,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const blockingDoor = (): MapOccluder => ({
  type: 'door',
  id: 'door-closed',
  x1: 50,
  y1: 0,
  x2: 50,
  y2: 100,
  open: false
})

describe('door LOS view helpers', () => {
  it('derives open and closed door toggle labels from board door state', () => {
    const viewModels = deriveDoorToggleViewModels(board())

    expect(viewModels[0]?.id).toBe('door-open')
    expect(viewModels[0]?.stateLabel).toBe('Open')
    expect(viewModels[0]?.toggleLabel).toBe('Close door-open')
    expect(viewModels[0]?.nextOpen).toBe(false)

    expect(viewModels[1]?.id).toBe('door-closed')
    expect(viewModels[1]?.stateLabel).toBe('Closed')
    expect(viewModels[1]?.toggleLabel).toBe('Open door-closed')
    expect(viewModels[1]?.nextOpen).toBe(true)
  })

  it('returns no visible piece ids when the source piece is missing', () => {
    const visible = deriveVisiblePieceIds(
      asPieceId('missing'),
      [piece('viewer', 0, 40), piece('target', 90, 40)],
      []
    )

    expect(visible).toHaveLength(0)
  })

  it('returns visible piece ids while dropping pieces blocked by closed doors', () => {
    const pieces = [
      piece('viewer', 0, 40),
      piece('nearby', 20, 40),
      piece('behind-door', 90, 40)
    ]

    const visible = deriveVisiblePieceIds(
      asPieceId('viewer'),
      pieces,
      [blockingDoor()],
      board().doors
    )

    expect(visible).toHaveLength(1)
    expect(visible[0]).toBe(asPieceId('nearby'))
  })

  it('uses current open door state to reveal otherwise blocked pieces', () => {
    const pieces = [piece('viewer', 0, 40), piece('behind-door', 90, 40)]
    const currentBoard = board()
    currentBoard.doors['door-closed'] = { id: 'door-closed', open: true }

    const visible = deriveVisiblePieceIds(
      asPieceId('viewer'),
      pieces,
      [blockingDoor()],
      currentBoard.doors
    )

    expect(visible).toHaveLength(1)
    expect(visible[0]).toBe(asPieceId('behind-door'))
  })

  it('preserves piece order and does not mutate source pieces', () => {
    const pieces = [
      piece('viewer', 0, 40),
      piece('alpha', 20, 40, 2, 2),
      piece('bravo', 90, 40)
    ]
    const before = JSON.stringify(pieces)

    const targets = derivePieceRectTargets(pieces)
    const visible = deriveVisiblePieceIds(asPieceId('viewer'), pieces, [], {})

    expect(JSON.stringify(pieces)).toBe(before)
    expect(targets.map((target) => target.id).join(',')).toBe(
      'viewer,alpha,bravo'
    )
    expect(targets[1]?.rect.width).toBe(40)
    expect(targets[1]?.rect.height).toBe(40)
    expect(visible.map((id) => id).join(',')).toBe('alpha,bravo')
  })

  it('derives LOS overlay segments using current door state', () => {
    const overlays = deriveLosOverlaySegments(
      [
        { type: 'wall', id: 'bulkhead', x1: 0, y1: 10, x2: 100, y2: 10 },
        blockingDoor()
      ],
      board().doors
    )

    expect(overlays[0]?.label).toBe('Wall bulkhead')
    expect(overlays[0]?.blocked).toBe(true)
    expect(overlays[1]?.label).toBe('Closed door door-closed')
    expect(overlays[1]?.blocked).toBe(true)

    const openOverlays = deriveLosOverlaySegments([blockingDoor()], {
      'door-closed': { id: 'door-closed', open: true }
    })
    expect(openOverlays[0]?.label).toBe('Open door door-closed')
    expect(openOverlays[0]?.blocked).toBe(false)
  })
})
