import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {asGameId, asPieceId, asUserId} from '../shared/ids'
import type {GameState} from '../shared/state'
import {
  applyServerMessage,
  buildBootstrapCommands,
  buildMovePieceCommand,
  resolveClientIdentity
} from './game-commands'

const identity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('user-1')
}

const state = {
  id: identity.gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: identity.actorId,
  players: {
    [identity.actorId]: {
      userId: identity.actorId,
      role: 'REFEREE'
    }
  },
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 7
} satisfies GameState

describe('client command helpers', () => {
  it('resolves deterministic demo identity from query params', () => {
    const result = resolveClientIdentity(
      new URLSearchParams('?game=spinward&user=traveller')
    )

    assert.equal(result.gameId, 'spinward')
    assert.equal(result.actorId, 'traveller')
  })

  it('builds move commands with expected sequence from authoritative state', () => {
    const command = buildMovePieceCommand({
      identity,
      state,
      pieceId: asPieceId('piece-1'),
      x: 50,
      y: 60
    })

    assert.equal(command.type, 'MovePiece')
    if (command.type !== 'MovePiece') return
    assert.equal(command.expectedSeq, 7)
  })

  it('bootstraps only the next missing room primitive', () => {
    const commands = buildBootstrapCommands(identity, null)

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreateGame')
  })

  it('replaces authoritative state on accepted messages', () => {
    const result = applyServerMessage(null, {
      type: 'commandAccepted',
      requestId: 'req-1',
      state,
      eventSeq: state.eventSeq
    })

    assert.equal(result.state, state)
    assert.equal(result.shouldReload, false)
    assert.equal(result.error, null)
  })

  it('marks stale command rejections for reload', () => {
    const result = applyServerMessage(state, {
      type: 'commandRejected',
      requestId: 'req-1',
      eventSeq: 8,
      error: {
        code: 'stale_command',
        message: 'Expected sequence 7, current sequence is 8'
      }
    })

    assert.equal(result.state, state)
    assert.equal(result.shouldReload, true)
    assert.equal(result.error, 'Expected sequence 7, current sequence is 8')
  })
})
