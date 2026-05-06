import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Command } from '../../shared/commands'
import { asBoardId, asGameId, asPieceId, asUserId } from '../../shared/ids'
import {
  createAppCommandRouter,
  sequenceCommand,
  type AppCommandSubmitInput
} from './app-command-router'

const identity = {
  gameId: asGameId('demo-room'),
  actorId: asUserId('local-user')
}

type MovePieceCommand = Extract<Command, { type: 'MovePiece' }>

const moveCommand = (overrides: Partial<MovePieceCommand> = {}): Command => ({
  type: 'MovePiece',
  gameId: identity.gameId,
  actorId: identity.actorId,
  pieceId: asPieceId('scout'),
  x: 10,
  y: 20,
  ...overrides
})

const createBoardCommand = (): Command => ({
  type: 'CreateBoard',
  gameId: identity.gameId,
  actorId: identity.actorId,
  boardId: asBoardId('main'),
  name: 'Main',
  width: 1200,
  height: 800,
  scale: 50
})

describe('app command router sequencing', () => {
  it('adds the current authoritative event sequence to stale-sensitive commands', () => {
    const command = sequenceCommand(moveCommand(), 12)

    assert.equal(command.type, 'MovePiece')
    assert.equal(command.expectedSeq, 12)
  })

  it('preserves explicit expectedSeq and unsequenced create-game commands', () => {
    assert.equal(
      sequenceCommand(moveCommand({ expectedSeq: 7 }), 12).expectedSeq,
      7
    )

    const createGame: Command = {
      type: 'CreateGame',
      gameId: identity.gameId,
      actorId: identity.actorId,
      slug: 'demo-room',
      name: 'Demo Room'
    }
    assert.equal(sequenceCommand(createGame, 12).expectedSeq, undefined)
  })

  it('leaves commands unchanged when there is no authoritative sequence', () => {
    assert.equal(sequenceCommand(moveCommand(), null).expectedSeq, undefined)
  })
})

describe('app command router dispatch', () => {
  it('submits a sequenced command with an injected request id', async () => {
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => 21,
      createRequestId: (command) => `${command.type}-request`,
      submit: async (input) => {
        submissions.push(input)
        return { ok: true }
      }
    })

    const result = await router.dispatch(moveCommand())

    assert.deepEqual(result, { ok: true })
    assert.equal(submissions.length, 1)
    assert.equal(submissions[0]?.requestId, 'MovePiece-request')
    assert.equal(submissions[0]?.command.expectedSeq, 21)
  })

  it('submits command batches in order with incremented expectedSeq values', async () => {
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => 30,
      submit: async (input) => {
        submissions.push(input)
        return input.requestId
      }
    })

    const results = await router.dispatchAll(
      [createBoardCommand(), moveCommand({ expectedSeq: 99 }), moveCommand()],
      { requestIds: ['board-1', 'move-explicit', 'move-2'] }
    )

    assert.deepEqual(results, ['board-1', 'move-explicit', 'move-2'])
    assert.deepEqual(
      submissions.map((submission) => submission.requestId),
      ['board-1', 'move-explicit', 'move-2']
    )
    assert.deepEqual(
      submissions.map((submission) => submission.command.expectedSeq),
      [30, 99, 32]
    )
  })

  it('submits sequential commands against the latest authoritative event sequence', async () => {
    let eventSeq = 30
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => eventSeq,
      submit: async (input) => {
        submissions.push(input)
        eventSeq += 1
        return input.requestId
      }
    })

    const results = await router.dispatchSequential(
      [createBoardCommand(), moveCommand({ expectedSeq: 99 }), moveCommand()],
      { requestIds: ['board-1', 'move-explicit', 'move-2'] }
    )

    assert.deepEqual(results, ['board-1', 'move-explicit', 'move-2'])
    assert.deepEqual(
      submissions.map((submission) => submission.command.expectedSeq),
      [30, 99, 32]
    )
  })
})
