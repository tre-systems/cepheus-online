import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asBoardId,
  asCharacterId,
  asGameId,
  asPieceId,
  asUserId
} from '../shared/ids'
import type { GameState } from '../shared/state'
import {
  applyServerMessage,
  buildBootstrapCommands,
  buildCreatePieceCommand,
  buildDefaultCharacterSheetUpdateCommand,
  buildMovePieceCommand,
  buildSequencedCommand,
  resolveClientIdentity
} from './game-commands'

const identity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('user-1')
}

const boardId = asBoardId('main-board')
const characterId = asCharacterId('scout')

const state = {
  id: identity.gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: identity.actorId,
  players: {
    [identity.actorId]: {
      userId: identity.actorId,
      role: 'REFEREE'
    }
  },
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 7
} satisfies GameState

const stateWithBoard = {
  ...state,
  boards: {
    [boardId]: {
      id: boardId,
      name: 'Downport Skirmish',
      imageAssetId: null,
      url: null,
      width: 1200,
      height: 800,
      scale: 50
    }
  },
  selectedBoardId: boardId
} satisfies GameState

const stateWithCharacter = {
  ...stateWithBoard,
  characters: {
    [characterId]: {
      id: characterId,
      ownerId: identity.actorId,
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot 1', 'Gun Combat 0', 'Vacc Suit 0'],
      equipment: [
        {
          name: 'Vacc suit',
          quantity: 1,
          notes: 'Standard shipboard emergency suit'
        }
      ],
      credits: 1000
    }
  }
} satisfies GameState

describe('client command helpers', () => {
  it('resolves deterministic demo identity from query params', () => {
    const result = resolveClientIdentity(
      new URLSearchParams('?game=spinward&user=traveller')
    )

    assert.equal(result.gameId, 'spinward')
    assert.equal(result.actorId, 'traveller')
  })

  it('builds move commands with expected sequence from authoritative state', () => {
    const command = buildMovePieceCommand({
      identity,
      state,
      pieceId: asPieceId('piece-1'),
      x: 50,
      y: 60
    })

    assert.equal(command.type, 'MovePiece')
    if (command.type !== 'MovePiece') return
    assert.equal(command.expectedSeq, 7)
  })

  it('adds the current authoritative sequence before dispatching commands', () => {
    const command = buildSequencedCommand(
      {
        type: 'RollDice',
        gameId: identity.gameId,
        actorId: identity.actorId,
        expression: '2d6',
        reason: 'Table roll'
      },
      state
    )

    assert.equal(command.type, 'RollDice')
    if (command.type !== 'RollDice') return
    assert.equal(command.expectedSeq, 7)
  })

  it('does not sequence initial game creation without a projection', () => {
    const command = buildSequencedCommand(
      {
        type: 'CreateGame',
        gameId: identity.gameId,
        actorId: identity.actorId,
        slug: 'game-1',
        name: 'Spinward Test'
      },
      null
    )

    assert.equal(command.type, 'CreateGame')
    assert.equal(command.expectedSeq, undefined)
  })

  it('bootstraps only the next missing room primitive', () => {
    const commands = buildBootstrapCommands(identity, null)

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreateGame')
  })

  it('bootstraps a default character and sheet before the default piece', () => {
    const commands = buildBootstrapCommands(identity, stateWithBoard)

    assert.equal(commands.length, 2)
    assert.equal(commands[0]?.type, 'CreateCharacter')
    assert.equal(commands[1]?.type, 'UpdateCharacterSheet')

    const sheetCommand = buildDefaultCharacterSheetUpdateCommand({
      requestId: 'test-sheet',
      identity
    })

    assert.equal(sheetCommand?.type, 'UpdateCharacterSheet')
    assert.equal(sheetCommand?.characterId, characterId)
    assert.deepEqual(sheetCommand?.characteristics, {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    })
  })

  it('binds the default piece to the default character', () => {
    const commands = buildBootstrapCommands(identity, stateWithCharacter)

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreatePiece')
    if (commands[0]?.type !== 'CreatePiece') return
    assert.equal(commands[0].boardId, boardId)
    assert.equal(commands[0].characterId, characterId)
    const commandWithDimensions = commands[0] as (typeof commands)[0] & {
      width?: number
      height?: number
      scale?: number
    }
    assert.equal(commandWithDimensions.width, 50)
    assert.equal(commandWithDimensions.height, 50)
    assert.equal(commandWithDimensions.scale, 1)
  })

  it('builds create piece commands with custom dimensions', () => {
    const command = buildCreatePieceCommand({
      requestId: 'piece-1',
      identity,
      boardId,
      characterId,
      width: 80,
      height: 60,
      scale: 1.5
    })

    assert.equal(command.type, 'CreatePiece')
    assert.equal(command.boardId, boardId)
    assert.equal(command.characterId, characterId)
    assert.equal(command.width, 80)
    assert.equal(command.height, 60)
    assert.equal(command.scale, 1.5)
  })

  it('replaces authoritative state on accepted messages', () => {
    const result = applyServerMessage(null, {
      type: 'commandAccepted',
      requestId: 'req-1',
      state,
      eventSeq: state.eventSeq
    })

    assert.equal(result.state, state)
    assert.equal(result.shouldReload, false)
    assert.equal(result.error, null)
  })

  it('marks stale command rejections for reload', () => {
    const result = applyServerMessage(state, {
      type: 'commandRejected',
      requestId: 'req-1',
      eventSeq: 8,
      error: {
        code: 'stale_command',
        message: 'Expected sequence 7, current sequence is 8'
      }
    })

    assert.equal(result.state, state)
    assert.equal(result.shouldReload, true)
    assert.equal(result.error, 'Expected sequence 7, current sequence is 8')
  })
})
