import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_BOARD_CAMERA,
  clampPiecePosition,
  deriveBoardTransform,
  deriveCameraZoom,
  derivePieceTouchPadding,
  findHitPiece,
  screenToBoard
} from './board-geometry'

describe('board geometry helpers', () => {
  it('derives the board transform from css size and camera', () => {
    assert.deepEqual(
      deriveBoardTransform(
        { width: 1200, height: 800 },
        { zoom: 2, panX: 10, panY: -20 },
        600,
        600
      ),
      {
        scale: 1,
        x: -290,
        y: -120
      }
    )
  })

  it('converts screen coordinates into board coordinates', () => {
    assert.deepEqual(
      screenToBoard({ x: 210, y: 170 }, { scale: 2, x: 10, y: -30 }),
      {
        x: 100,
        y: 100
      }
    )
  })

  it('clamps pieces inside board bounds', () => {
    assert.deepEqual(
      clampPiecePosition(
        { width: 200, height: 100 },
        { width: 40, height: 30, scale: 2 },
        140,
        -5
      ),
      {
        x: 120,
        y: 0
      }
    )
  })

  it('keeps the same board point under the zoom anchor', () => {
    const board = { width: 1000, height: 500 }
    const camera = DEFAULT_BOARD_CAMERA
    const anchor = { x: 300, y: 200 }
    const before = deriveBoardTransform(board, camera, 500, 500)
    const boardAnchor = screenToBoard(anchor, before)
    const next = deriveCameraZoom({
      board,
      camera,
      cssWidth: 500,
      cssHeight: 500,
      nextZoom: 2,
      anchorScreen: anchor
    })
    const after = deriveBoardTransform(board, next, 500, 500)

    assert.deepEqual(
      {
        x: after.x + boardAnchor.x * after.scale,
        y: after.y + boardAnchor.y * after.scale
      },
      anchor
    )
  })

  it('clamps camera zoom to the allowed range', () => {
    assert.equal(
      deriveCameraZoom({
        board: { width: 100, height: 100 },
        camera: DEFAULT_BOARD_CAMERA,
        cssWidth: 100,
        cssHeight: 100,
        nextZoom: 10
      }).zoom,
      5
    )
  })

  it('expands non-mouse hit targets to the minimum touch target size', () => {
    assert.deepEqual(
      derivePieceTouchPadding(
        { width: 10, height: 6, scale: 1 },
        { scale: 2, x: 0, y: 0 },
        'touch'
      ),
      {
        x: 6,
        y: 8
      }
    )
    assert.deepEqual(
      derivePieceTouchPadding(
        { width: 10, height: 6, scale: 1 },
        { scale: 2, x: 0, y: 0 },
        'mouse'
      ),
      {
        x: 0,
        y: 0
      }
    )
  })

  it('returns the topmost hit piece without mutating draw order', () => {
    const pieces = [
      { id: 'back', x: 0, y: 0, z: 1, width: 20, height: 20, scale: 1 },
      { id: 'front', x: 0, y: 0, z: 3, width: 20, height: 20, scale: 1 }
    ]

    assert.equal(findHitPiece({ x: 10, y: 10 }, pieces)?.id, 'front')
    assert.deepEqual(
      pieces.map((piece) => piece.id),
      ['back', 'front']
    )
  })
})
