import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import type { EventEnvelope } from './events'
import { asCharacterId, asEventId, asGameId, asUserId } from './ids'
import {
  deriveLiveActivities,
  deriveLiveActivity,
  LIVE_DICE_RESULT_REVEAL_DELAY_MS,
  MAX_LIVE_ACTIVITY_ROLLS,
  MAX_LIVE_ACTIVITY_TEXT_LENGTH,
  type LiveActivityDescriptor
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

type LiveActivityDescriptorFixture = {
  readonly name: string
  readonly event: EventEnvelope['event']
  readonly activity: LiveActivityDescriptor
  readonly maxSerializedBytes: number
}

const loadFixture = <T>(name: string): T => {
  const file = path.join('src', 'shared', '__fixtures__', 'protocol', name)

  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

const serializedBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length

const liveActivityDescriptorFixtures = loadFixture<
  LiveActivityDescriptorFixture[]
>('live-activity-descriptors.json')

describe('live activity derivation', () => {
  for (const fixture of liveActivityDescriptorFixtures) {
    it(`matches protocol fixture: ${fixture.name}`, () => {
      const activity = deriveLiveActivity(
        envelope(fixture.activity.seq, fixture.event)
      )

      assert.deepEqual(activity, fixture.activity)
      assert.equal(
        serializedBytes(activity) <= fixture.maxSerializedBytes,
        true
      )
    })
  }

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

  it('bounds oversized dice roll activity payloads', () => {
    const longExpression = '2d6+'.repeat(40)
    const longReason = 'A very long dice roll reason. '.repeat(20)
    const rolls = Array.from(
      { length: MAX_LIVE_ACTIVITY_ROLLS + 5 },
      (_, i) => (i % 6) + 1
    )

    const activity = deriveLiveActivity(
      envelope(4, {
        type: 'DiceRolled',
        expression: longExpression,
        reason: longReason,
        rolls,
        total: rolls.reduce((sum, roll) => sum + roll, 0)
      })
    )

    assert.equal(activity?.type, 'diceRoll')
    if (activity?.type !== 'diceRoll') return
    assert.equal(activity.expression.length, MAX_LIVE_ACTIVITY_TEXT_LENGTH)
    assert.equal(activity.reason.length, MAX_LIVE_ACTIVITY_TEXT_LENGTH)
    assert.equal(activity.rolls.length, MAX_LIVE_ACTIVITY_ROLLS)
    assert.equal(activity.rollsOmitted, 5)
    assert.equal(serializedBytes(activity) < 700, true)
  })

  it('does not leak full creation event state into character activity', () => {
    const activity = deriveLiveActivity(
      envelope(5, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SURVIVAL_PASSED',
          canCommission: true,
          canAdvance: false
        },
        state: {
          status: 'ADVANCEMENT',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.equal(activity?.type, 'characterCreation')
    assert.deepEqual(Object.keys(activity ?? {}).sort(), [
      'actorId',
      'characterId',
      'createdAt',
      'creationComplete',
      'eventId',
      'gameId',
      'id',
      'seq',
      'status',
      'transition',
      'type'
    ])
  })
})
