import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asCharacterId,
  asEventId,
  asGameId,
  asUserId
} from '../../shared/ids'
import type { LiveActivityDescriptor } from '../../shared/live-activity'
import type { ClientDiceRollActivity } from '../game-commands'
import {
  filterPendingDiceRollActivities,
  hasRedactedCreationActivityDetails,
  prepareLiveActivityApplication
} from './live-activity-client'

const activity = (id: string, total: number = 7): ClientDiceRollActivity => ({
  id,
  revealAt: '2026-05-06T10:00:02.500Z',
  rolls: [3, total - 3],
  total
})

const creationActivity = ({
  details
}: {
  details?: string
}): LiveActivityDescriptor => ({
  id: asEventId('game-1:20'),
  eventId: asEventId('game-1:20'),
  gameId: asGameId('game-1'),
  seq: 20,
  actorId: asUserId('other-user'),
  createdAt: '2026-05-06T10:00:00.000Z',
  type: 'characterCreation',
  characterId: asCharacterId('character-1'),
  transition: 'FINISH_MUSTERING',
  details,
  status: 'MUSTERING_OUT',
  creationComplete: false
})

describe('live activity client helpers', () => {
  it('keeps only dice rolls that have not been animated or revealed', () => {
    const pending = activity('game-1:10')
    const animated = activity('game-1:11')
    const revealed = activity('game-1:12')

    assert.deepEqual(
      filterPendingDiceRollActivities([pending, animated, revealed], {
        animatedDiceRollActivityIds: new Set([animated.id]),
        revealedDiceIds: new Set([revealed.id])
      }),
      [pending]
    )
  })

  it('prepares deferred reveal IDs from pending dice roll activities', () => {
    const pending = activity('game-1:10')
    const revealed = activity('game-1:11')

    const prepared = prepareLiveActivityApplication(
      { diceRollActivities: [pending, revealed] },
      {
        animatedDiceRollActivityIds: new Set(),
        revealedDiceIds: new Set([revealed.id])
      }
    )

    assert.deepEqual(prepared.diceRollActivities, [pending])
    assert.deepEqual([...prepared.deferDiceRevealIds], [pending.id])
    assert.equal(prepared.animateLatestDiceLog, false)
  })

  it('prepares tactical and character creation dice on the same reveal path', () => {
    const tactical = activity('game-1:20', 8)
    const creation = activity('game-1:21', 9)

    const prepared = prepareLiveActivityApplication(
      { diceRollActivities: [tactical, creation] },
      {
        animatedDiceRollActivityIds: new Set(),
        revealedDiceIds: new Set()
      }
    )

    assert.deepEqual(prepared.diceRollActivities, [tactical, creation])
    assert.deepEqual(
      [...prepared.deferDiceRevealIds],
      [tactical.id, creation.id]
    )
    assert.equal(prepared.animateLatestDiceLog, false)
  })

  it('allows latest dice log animation when no live dice roll was supplied', () => {
    const prepared = prepareLiveActivityApplication(
      { diceRollActivities: [] },
      {
        animatedDiceRollActivityIds: new Set(['game-1:10']),
        revealedDiceIds: new Set(['game-1:11'])
      }
    )

    assert.deepEqual(prepared.diceRollActivities, [])
    assert.deepEqual([...prepared.deferDiceRevealIds], [])
    assert.equal(prepared.animateLatestDiceLog, true)
  })

  it('identifies redacted character creation activity details', () => {
    assert.equal(
      hasRedactedCreationActivityDetails({
        liveActivities: [creationActivity({ details: undefined })]
      }),
      true
    )
    assert.equal(
      hasRedactedCreationActivityDetails({
        liveActivities: [creationActivity({ details: 'Mustering benefit' })]
      }),
      false
    )
  })
})
