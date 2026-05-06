import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ClientDiceRollActivity } from '../game-commands'
import {
  filterPendingDiceRollActivities,
  prepareLiveActivityApplication
} from './live-activity-client'

const activity = (id: string, total: number = 7): ClientDiceRollActivity => ({
  id,
  revealAt: '2026-05-06T10:00:02.500Z',
  rolls: [3, total - 3],
  total
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
})
