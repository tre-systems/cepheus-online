import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {asBoardId, asGameId, asPieceId, asUserId} from './ids'
import type {GameState} from './state'
import {filterGameStateForViewer} from './viewer'

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
})
