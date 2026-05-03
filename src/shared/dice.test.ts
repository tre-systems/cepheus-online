import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {parseDiceExpression, rollDiceExpression} from './dice'
import type {EventEnvelope} from './events'
import {asEventId, asGameId, asUserId} from './ids'
import {projectGameState} from './projector'

describe('dice expressions', () => {
  it('parses count, sides, and signed modifier', () => {
    const result = parseDiceExpression('2d6+3')

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, {
      count: 2,
      sides: 6,
      modifier: 3
    })
  })

  it('rolls with injected rng and persists the total', () => {
    const result = rollDiceExpression('2d6-1', () => 0)

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value.rolls, [1, 1])
    assert.equal(result.value.total, 1)
  })

  it('rejects unsupported notation', () => {
    const result = parseDiceExpression('d6')

    assert.equal(result.ok, false)
  })

  it('projects rolled dice into recent game state', () => {
    const events: EventEnvelope[] = [
      {
        id: asEventId('game-1:1'),
        gameId: asGameId('game-1'),
        seq: 1,
        actorId: asUserId('user-1'),
        createdAt: '2026-05-03T00:00:00.000Z',
        event: {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: asUserId('user-1')
        }
      },
      {
        id: asEventId('game-1:2'),
        gameId: asGameId('game-1'),
        seq: 2,
        actorId: asUserId('user-1'),
        createdAt: '2026-05-03T00:00:01.000Z',
        event: {
          type: 'DiceRolled',
          expression: '2d6',
          reason: 'skill check',
          rolls: [3, 4],
          total: 7
        }
      }
    ]

    const state = projectGameState(events)

    assert.equal(state?.diceLog.length, 1)
    assert.equal(state?.diceLog[0]?.total, 7)
    assert.equal(state?.diceLog[0]?.revealAt, '2026-05-03T00:00:03.500Z')
  })
})
