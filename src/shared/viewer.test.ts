import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asPieceId, asUserId } from './ids'
import type { GameState } from './state'
import { filterGameStateForViewer, isActorRefereeOrOwner } from './viewer'

const nowMs = Date.parse('2026-05-03T00:00:03.000Z')
const futureRevealAt = '2026-05-03T00:00:04.500Z'
const pastRevealAt = '2026-05-03T00:00:02.500Z'

const buildState = (): GameState => ({
  id: asGameId('game-1'),
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: asUserId('referee'),
  players: {
    [asUserId('referee')]: {
      userId: asUserId('referee'),
      role: 'REFEREE'
    }
  },
  characters: {},
  boards: {},
  pieces: {
    [asPieceId('hidden')]: {
      id: asPieceId('hidden'),
      boardId: asBoardId('board-1'),
      characterId: null,
      imageAssetId: null,
      name: 'Hidden scout',
      x: 0,
      y: 0,
      z: 0,
      width: 50,
      height: 50,
      scale: 1,
      visibility: 'HIDDEN',
      freedom: 'LOCKED'
    },
    [asPieceId('visible')]: {
      id: asPieceId('visible'),
      boardId: asBoardId('board-1'),
      characterId: null,
      imageAssetId: '/assets/counters/TroopsBlackOnGreen.png',
      name: 'Visible scout',
      x: 0,
      y: 0,
      z: 0,
      width: 50,
      height: 50,
      scale: 1,
      visibility: 'VISIBLE',
      freedom: 'LOCKED'
    }
  },
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 2
})

const addDiceRoll = (state: GameState, revealAt: string): void => {
  state.diceLog.push({
    id: 'roll-1',
    actorId: asUserId('player'),
    createdAt: '2026-05-03T00:00:01.000Z',
    revealAt,
    expression: '2d6',
    reason: 'Spot ambush',
    rolls: [3, 4],
    total: 7
  })
}

describe('viewer filtering', () => {
  it('keeps referee state complete', () => {
    const state = buildState()
    const filtered = filterGameStateForViewer(state, {
      userId: asUserId('referee'),
      role: 'PLAYER'
    })

    assert.deepEqual(Object.keys(filtered.pieces).sort(), ['hidden', 'visible'])
  })

  it('removes hidden pieces from player projections', () => {
    const state = buildState()
    const filtered = filterGameStateForViewer(state, {
      userId: asUserId('player'),
      role: 'PLAYER'
    })

    assert.deepEqual(Object.keys(filtered.pieces), ['visible'])
    assert.deepEqual(Object.keys(state.pieces).sort(), ['hidden', 'visible'])
  })

  it('keeps pre-reveal dice rolls and totals visible to referees', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)

    const filtered = filterGameStateForViewer(
      state,
      {
        userId: asUserId('referee'),
        role: 'PLAYER'
      },
      { nowMs }
    )

    assert.deepEqual(filtered.diceLog[0]?.rolls, [3, 4])
    assert.equal(filtered.diceLog[0]?.total, 7)
  })

  it('keeps pre-reveal dice rolls and totals visible to the game owner', () => {
    const state = buildState()
    state.ownerId = asUserId('owner')
    state.players[asUserId('owner')] = {
      userId: asUserId('owner'),
      role: 'PLAYER'
    }
    addDiceRoll(state, futureRevealAt)

    const filtered = filterGameStateForViewer(
      state,
      {
        userId: asUserId('owner'),
        role: 'SPECTATOR'
      },
      { nowMs }
    )

    assert.deepEqual(filtered.diceLog[0]?.rolls, [3, 4])
    assert.equal(filtered.diceLog[0]?.total, 7)
  })

  it('redacts pre-reveal dice rolls and totals from players and spectators', () => {
    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const state = buildState()
      addDiceRoll(state, futureRevealAt)

      const filtered = filterGameStateForViewer(
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      assert.equal('rolls' in filtered.diceLog[0], false)
      assert.equal('total' in filtered.diceLog[0], false)
      assert.deepEqual(state.diceLog[0]?.rolls, [3, 4])
      assert.equal(state.diceLog[0]?.total, 7)
    }
  })

  it('reveals dice rolls and totals to players and spectators after reveal', () => {
    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const state = buildState()
      addDiceRoll(state, pastRevealAt)

      const filtered = filterGameStateForViewer(
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      assert.deepEqual(filtered.diceLog[0]?.rolls, [3, 4])
      assert.equal(filtered.diceLog[0]?.total, 7)
    }
  })

  it('derives actor referee authority from owner or room role', () => {
    const state = buildState()
    state.players[asUserId('assistant-referee')] = {
      userId: asUserId('assistant-referee'),
      role: 'REFEREE'
    }
    state.players[asUserId('player')] = {
      userId: asUserId('player'),
      role: 'PLAYER'
    }

    assert.equal(isActorRefereeOrOwner(state, asUserId('referee')), true)
    assert.equal(
      isActorRefereeOrOwner(state, asUserId('assistant-referee')),
      true
    )
    assert.equal(isActorRefereeOrOwner(state, asUserId('player')), false)
    assert.equal(isActorRefereeOrOwner(state, asUserId('stranger')), false)
    assert.equal(isActorRefereeOrOwner(null, asUserId('referee')), false)
  })
})
