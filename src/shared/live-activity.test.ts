import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { EventEnvelope } from './events'
import { asCharacterId, asEventId, asGameId, asUserId } from './ids'
import {
  deriveLiveActivities,
  deriveLiveActivity,
  LIVE_DICE_RESULT_REVEAL_DELAY_MS
} from './live-activity'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')
const characterId = asCharacterId('char-1')

const envelope = (
  seq: number,
  event: EventEnvelope['event']
): EventEnvelope => ({
  version: 1,
  id: asEventId(`${gameId}:${seq}`),
  gameId,
  seq,
  actorId,
  createdAt: `2026-05-03T00:00:0${seq}.000Z`,
  event
})

describe('live activity derivation', () => {
  it('derives viewer-safe dice roll activity with delayed reveal metadata', () => {
    const activity = deriveLiveActivity(
      envelope(2, {
        type: 'DiceRolled',
        expression: '2d6+1',
        reason: 'Vacc Suit check',
        rolls: [3, 5],
        total: 9
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:2'),
      eventId: asEventId('game-1:2'),
      gameId,
      seq: 2,
      actorId,
      createdAt: '2026-05-03T00:00:02.000Z',
      type: 'diceRoll',
      expression: '2d6+1',
      reason: 'Vacc Suit check',
      rolls: [3, 5],
      total: 9,
      reveal: {
        revealAt: '2026-05-03T00:00:04.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      }
    })
  })

  it('derives compact character creation transition activity', () => {
    const activity = deriveLiveActivity(
      envelope(3, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          drafted: false
        },
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:3'),
      eventId: asEventId('game-1:3'),
      gameId,
      seq: 3,
      actorId,
      createdAt: '2026-05-03T00:00:03.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SELECT_CAREER',
      status: 'BASIC_TRAINING',
      creationComplete: false
    })
  })

  it('filters unrelated events from derived live activities', () => {
    const activities = deriveLiveActivities([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      })
    ])

    assert.equal(activities.length, 1)
    assert.equal(activities[0]?.type, 'characterCreation')
    assert.equal(activities[0]?.seq, 2)
  })
})
