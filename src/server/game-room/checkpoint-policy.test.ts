import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { EventEnvelope } from '../../shared/events'
import { asCharacterId, asEventId, asGameId, asUserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import { CHECKPOINT_INTERVAL, shouldSaveCheckpoint } from './checkpoint-policy'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')
const characterId = asCharacterId('char-1')

const stateAt = (eventSeq: number): GameState => ({
  id: gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq
})

const envelope = (
  seq: number,
  event: EventEnvelope['event']
): EventEnvelope => ({
  version: 1,
  id: asEventId(`${gameId}:${seq}`),
  gameId,
  seq,
  actorId,
  createdAt: `2026-05-03T00:00:${String(seq).padStart(2, '0')}.000Z`,
  event
})

describe('checkpoint policy', () => {
  it('saves a checkpoint at initial game creation', () => {
    assert.equal(
      shouldSaveCheckpoint(stateAt(1), [
        envelope(1, {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        })
      ]),
      true
    )
  })

  it('saves a checkpoint at the fixed event interval', () => {
    assert.equal(
      shouldSaveCheckpoint(stateAt(CHECKPOINT_INTERVAL), [
        envelope(CHECKPOINT_INTERVAL, {
          type: 'DiceRolled',
          expression: '1d6',
          reason: '',
          rolls: [4],
          total: 4
        })
      ]),
      true
    )
  })

  it('saves a checkpoint when character creation completes', () => {
    assert.equal(
      shouldSaveCheckpoint(stateAt(12), [
        envelope(12, {
          type: 'CharacterCreationCompleted',
          characterId,
          state: {
            status: 'PLAYABLE',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          creationComplete: true
        })
      ]),
      true
    )
  })

  it('does not save a checkpoint outside the named boundaries', () => {
    assert.equal(
      shouldSaveCheckpoint(stateAt(2), [
        envelope(2, {
          type: 'DiceRolled',
          expression: '1d6',
          reason: '',
          rolls: [4],
          total: 4
        })
      ]),
      false
    )
  })
})
