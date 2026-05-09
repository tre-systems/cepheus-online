import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId, asUserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import { compareProjectionParity } from './projection-parity'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const stateAt = (eventSeq: number, name = 'Spinward Test'): GameState => ({
  id: gameId,
  slug: 'game-1',
  name,
  ownerId: actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq
})

describe('projection parity', () => {
  it('matches equivalent live and recovered projections', () => {
    assert.deepEqual(compareProjectionParity(stateAt(2), stateAt(2)), {
      matches: true
    })
  })

  it('reports a stable mismatch reason', () => {
    assert.deepEqual(
      compareProjectionParity(stateAt(2), stateAt(2, 'Corrupt')),
      {
        matches: false,
        message: 'Stored event stream does not match live projection'
      }
    )
  })
})
