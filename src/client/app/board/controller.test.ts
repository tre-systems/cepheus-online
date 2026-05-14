import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asPieceId, asUserId } from '../../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../../shared/state'
import {
  buildCompletedPieceDragMoveCommand,
  drawLosOverlaySegments
} from './controller'

const board: BoardState = {
  id: asBoardId('main'),
  name: 'Main',
  imageAssetId: null,
  url: null,
  width: 200,
  height: 100,
  scale: 50,
  doors: {}
}

const piece: PieceState = {
  id: asPieceId('scout'),
  boardId: board.id,
  characterId: null,
  imageAssetId: null,
  name: 'Scout',
  x: 10,
  y: 20,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
}

const state: GameState = {
  id: asGameId('game'),
  slug: 'game',
  name: 'Game',
  ownerId: asUserId('owner'),
  players: {},
  characters: {},
  boards: { [board.id]: board },
  pieces: { [piece.id]: piece },
  diceLog: [],
  selectedBoardId: board.id,
  eventSeq: 12
}

const identity = {
  gameId: state.id,
  actorId: asUserId('actor')
}

const completedDrag = (
  overrides: Partial<
    Parameters<typeof buildCompletedPieceDragMoveCommand>[0]['drag']
  >
) => ({
  kind: 'piece' as const,
  pieceId: piece.id,
  offsetX: 0,
  offsetY: 0,
  startPointerX: 10,
  startPointerY: 10,
  moved: true,
  x: 41.7,
  y: 55.2,
  startX: piece.x,
  startY: piece.y,
  ...overrides
})

describe('board controller pointer commands', () => {
  it('builds a sequenced move command from a completed piece drag', () => {
    const command = buildCompletedPieceDragMoveCommand({
      drag: completedDrag({}),
      identity,
      state
    })

    assert.equal(command?.type, 'MovePiece')
    if (command?.type !== 'MovePiece') return
    assert.equal(command.gameId, identity.gameId)
    assert.equal(command.actorId, identity.actorId)
    assert.equal(command.pieceId, piece.id)
    assert.equal(command.x, 42)
    assert.equal(command.y, 55)
    assert.equal(command.expectedSeq, 12)
  })

  it('does not build a command for clicks or unchanged rounded positions', () => {
    assert.equal(
      buildCompletedPieceDragMoveCommand({
        drag: completedDrag({ moved: false }),
        identity,
        state
      }),
      null
    )
    assert.equal(
      buildCompletedPieceDragMoveCommand({
        drag: completedDrag({ x: 10.2, y: 20.4 }),
        identity,
        state
      }),
      null
    )
  })

  it('does not build a command without current authoritative state', () => {
    assert.equal(
      buildCompletedPieceDragMoveCommand({
        drag: completedDrag({}),
        identity,
        state: null
      }),
      null
    )
  })
})

describe('LOS overlay canvas drawing', () => {
  const drawingContext = () => {
    const calls: string[] = []
    const context = {
      strokeStyle: '',
      lineWidth: 0,
      lineCap: 'butt' as CanvasLineCap,
      beginPath: () => {
        calls.push('beginPath')
      },
      lineTo: (x: number, y: number) => {
        calls.push(`lineTo:${x},${y}`)
      },
      moveTo: (x: number, y: number) => {
        calls.push(`moveTo:${x},${y}`)
      },
      restore: () => {
        calls.push('restore')
      },
      save: () => {
        calls.push('save')
      },
      setLineDash: (dash: number[]) => {
        calls.push(`dash:${dash.join(',')}`)
      },
      stroke: () => {
        calls.push(`stroke:${context.strokeStyle}:${context.lineWidth}`)
      }
    }

    return { context, calls }
  }

  it('draws walls and door overlays with state-specific styles', () => {
    const { context, calls } = drawingContext()

    drawLosOverlaySegments(
      context,
      [
        {
          id: 'bulkhead',
          type: 'wall',
          x1: 0,
          y1: 10,
          x2: 100,
          y2: 10,
          open: false,
          blocked: true,
          label: 'Wall bulkhead'
        },
        {
          id: 'iris',
          type: 'door',
          x1: 40,
          y1: 0,
          x2: 40,
          y2: 40,
          open: false,
          blocked: true,
          label: 'Closed door iris'
        },
        {
          id: 'hatch',
          type: 'door',
          x1: 70,
          y1: 0,
          x2: 70,
          y2: 40,
          open: true,
          blocked: false,
          label: 'Open door hatch'
        }
      ],
      { scale: 2 },
      {
        wallStroke: 'wall',
        closedDoorStroke: 'closed',
        openDoorStroke: 'open',
        wallLineWidth: 4,
        doorLineWidth: 6,
        dashLength: 8,
        gapLength: 4
      }
    )

    assert.deepEqual(calls, [
      'save',
      'dash:',
      'beginPath',
      'moveTo:0,10',
      'lineTo:100,10',
      'stroke:wall:2',
      'dash:',
      'beginPath',
      'moveTo:40,0',
      'lineTo:40,40',
      'stroke:closed:3',
      'dash:4,2',
      'beginPath',
      'moveTo:70,0',
      'lineTo:70,40',
      'stroke:open:3',
      'dash:',
      'restore'
    ])
    assert.equal(context.lineCap, 'round')
  })

  it('does not touch the canvas when there are no overlays', () => {
    const { context, calls } = drawingContext()

    drawLosOverlaySegments(context, [], { scale: 1 })

    assert.deepEqual(calls, [])
  })
})
