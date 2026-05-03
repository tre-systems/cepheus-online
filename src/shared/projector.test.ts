import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {EventEnvelope} from './events'
import {asBoardId, asEventId, asGameId, asUserId} from './ids'
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
})
