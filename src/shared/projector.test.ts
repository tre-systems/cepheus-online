import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {EventEnvelope} from './events'
import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asPieceId,
  asUserId
} from './ids'
import {projectGameState} from './projector'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const envelope = (
  seq: number,
  event: EventEnvelope['event']
): EventEnvelope => ({
  id: asEventId(`${gameId}:${seq}`),
  gameId,
  seq,
  actorId,
  createdAt: `2026-05-03T00:00:0${seq}.000Z`,
  event
})

describe('game state projection', () => {
  it('projects explicit board selection over the first created board', () => {
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'BoardCreated',
        boardId: asBoardId('board-2'),
        name: 'Starport',
        imageAssetId: null,
        url: null,
        width: 1200,
        height: 900,
        scale: 50
      }),
      envelope(4, {
        type: 'BoardSelected',
        boardId: asBoardId('board-2')
      })
    ])

    assert.equal(state?.selectedBoardId, asBoardId('board-2'))
    assert.equal(state?.eventSeq, 4)
  })

  it('projects default and partial manual character sheet fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        age: 34,
        characteristics: {
          str: 7,
          dex: 9
        },
        skills: ['Pilot 1'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: ''
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        characteristics: {
          dex: null,
          edu: 8
        },
        credits: 900
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: 7,
      dex: null,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Pilot 1'])
    assert.deepEqual(character?.equipment, [
      {name: 'Vacc suit', quantity: 1, notes: ''}
    ])
    assert.equal(character?.credits, 900)
  })

  it('projects piece character links', () => {
    const characterId = asCharacterId('char-1')
    const pieceId = asPieceId('piece-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'PieceCreated',
        pieceId,
        boardId: asBoardId('board-1'),
        characterId,
        name: 'Scout',
        imageAssetId: null,
        x: 10,
        y: 20
      })
    ])

    assert.equal(state?.pieces[pieceId]?.characterId, characterId)
  })
})
