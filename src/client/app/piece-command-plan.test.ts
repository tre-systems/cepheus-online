import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BoardId, GameId, PieceId, UserId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import { planCreatePieceCommands } from './piece-command-plan'

const identity = {
  gameId: 'demo-room' as GameId,
  actorId: 'local-user' as UserId
}

const board: BoardState = {
  id: 'main-board' as BoardId,
  name: 'Main Board',
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {}
}

const piece = (id: string): PieceState => ({
  id: id as PieceId,
  boardId: board.id,
  characterId: null,
  imageAssetId: null,
  name: id,
  x: 0,
  y: 0,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const gameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: identity.gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: identity.actorId,
  players: {},
  characters: {},
  boards: {
    [board.id]: board
  },
  pieces: {},
  diceLog: [],
  selectedBoardId: board.id,
  eventSeq: 12,
  ...overrides
})

describe('piece command planner', () => {
  it('builds one sequenced piece command without a linked character', () => {
    const result = planCreatePieceCommands({
      identity,
      state: gameState(),
      board,
      name: '  Security Drone  ',
      imageAssetId: 'local/counters/drone.webp',
      width: 60,
      height: 50,
      scale: 1.5,
      existingPieceCount: 2,
      withCharacterSheet: false
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.characterId, null)
    assert.equal(result.commands.length, 1)
    assert.equal(result.commands[0]?.type, 'CreatePiece')
    if (result.commands[0]?.type !== 'CreatePiece') return
    assert.equal(result.commands[0].name, 'Security Drone')
    assert.equal(result.commands[0].pieceId, 'security-drone-1')
    assert.equal(result.commands[0].characterId, null)
    assert.equal(result.commands[0].imageAssetId, 'local/counters/drone.webp')
    assert.equal(result.commands[0].expectedSeq, 12)
    assert.equal(result.commands[0].x, 276)
    assert.equal(result.commands[0].y, 140)
    assert.equal(result.commands[0].width, 60)
    assert.equal(result.commands[0].height, 50)
    assert.equal(result.commands[0].scale, 1.5)
  })

  it('builds event-backed character creation before the linked piece', () => {
    const result = planCreatePieceCommands({
      identity,
      state: gameState({
        pieces: {
          ['scout-1' as PieceId]: piece('scout-1')
        }
      }),
      board,
      name: 'Mae',
      imageAssetId: null,
      width: 50,
      height: 50,
      scale: 1,
      existingPieceCount: 1,
      withCharacterSheet: true
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.pieceId, 'mae-2')
    assert.equal(result.characterId, 'mae-1')
    assert.deepEqual(
      result.commands.map((command) => command.type),
      [
        'CreateCharacter',
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'SetCharacterCreationHomeworld',
        'SelectCharacterCreationBackgroundSkill',
        'ResolveCharacterCreationCascadeSkill',
        'AdvanceCharacterCreation',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation',
        'UpdateCharacterSheet',
        'CreatePiece'
      ]
    )
    assert.deepEqual(
      result.commands.map((command) => command.expectedSeq),
      Array.from({ length: result.commands.length }, (_, index) => 12 + index)
    )
    assert.equal(result.commands.at(-1)?.type, 'CreatePiece')
    const createPieceCommand = result.commands.at(-1)
    if (createPieceCommand?.type !== 'CreatePiece') return
    assert.equal(createPieceCommand.characterId, 'mae-1')
    assert.equal(createPieceCommand.x, 218)
    assert.equal(createPieceCommand.y, 140)
  })

  it('rejects missing room state or board context', () => {
    const result = planCreatePieceCommands({
      identity,
      state: null,
      board: null,
      name: 'Scout',
      imageAssetId: null,
      width: 50,
      height: 50,
      scale: 1,
      existingPieceCount: 0,
      withCharacterSheet: false
    })

    assert.deepEqual(result, {
      ok: false,
      error: 'Bootstrap a board before creating a piece',
      focus: null
    })
  })

  it('rejects blank piece names with a focus hint', () => {
    const result = planCreatePieceCommands({
      identity,
      state: gameState(),
      board,
      name: '   ',
      imageAssetId: null,
      width: 50,
      height: 50,
      scale: 1,
      existingPieceCount: 0,
      withCharacterSheet: false
    })

    assert.deepEqual(result, {
      ok: false,
      error: 'Piece name is required',
      focus: 'name'
    })
  })
})
