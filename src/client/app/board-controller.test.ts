import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asPieceId, asUserId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import { buildCompletedPieceDragMoveCommand } from './board-controller'

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
