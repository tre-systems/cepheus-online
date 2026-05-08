import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Command } from '../../shared/commands'
import { asBoardId, asGameId, asPieceId, asUserId } from '../../shared/ids'
import type { ServerMessage } from '../../shared/protocol'
import type { GameState } from '../../shared/state'
import type { CommandResponse, PostRoomCommandOptions } from './room-api'
import {
  createRoomCommandDispatch,
  serverMessageErrorText
} from './room-command-dispatch'

const identity = {
  gameId: asGameId('demo-room'),
  actorId: asUserId('local-user')
}

const gameState = (eventSeq: number): GameState => ({
  id: identity.gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: identity.actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq
})

const acceptedMessage = (eventSeq: number): ServerMessage => ({
  type: 'commandAccepted',
  requestId: `accepted-${eventSeq}`,
  state: gameState(eventSeq),
  eventSeq
})

const moveCommand = (): Extract<Command, { type: 'MovePiece' }> => ({
  type: 'MovePiece',
  gameId: identity.gameId,
  actorId: identity.actorId,
  pieceId: asPieceId('scout'),
  x: 10,
  y: 20
})

const boardCommand = (): Extract<Command, { type: 'CreateBoard' }> => ({
  type: 'CreateBoard',
  gameId: identity.gameId,
  actorId: identity.actorId,
  boardId: asBoardId('main'),
  name: 'Main',
  width: 1200,
  height: 800,
  scale: 50
})

describe('room command dispatch', () => {
  it('posts commands through the room API and handles accepted messages', async () => {
    const posts: PostRoomCommandOptions[] = []
    const handled: ServerMessage[] = []
    const dispatch = createRoomCommandDispatch({
      getEventSeq: () => 8,
      getRoomId: () => 'demo-room',
      getActorSessionSecret: () => 'session-secret',
      createRequestId: (commandType) => `${commandType}-request`,
      handleServerMessage: (message) => handled.push(message),
      postRoomCommand: async (options) => {
        posts.push(options)
        return {
          ok: true,
          message: acceptedMessage(9)
        } satisfies CommandResponse
      }
    })

    const result = await dispatch.postBoardCommand(boardCommand())

    assert.equal(result.type, 'commandAccepted')
    assert.equal(posts.length, 1)
    assert.equal(posts[0]?.roomId, 'demo-room')
    assert.equal(posts[0]?.requestId, 'CreateBoard-request')
    assert.equal(posts[0]?.actorSessionSecret, 'session-secret')
    assert.equal(posts[0]?.command.expectedSeq, 8)
    assert.deepEqual(handled, [acceptedMessage(9)])
  })

  it('throws typed server errors after applying the response message', async () => {
    const handled: ServerMessage[] = []
    const rejected: ServerMessage = {
      type: 'commandRejected',
      requestId: 'move-request',
      eventSeq: 8,
      error: {
        code: 'stale_command',
        message: 'That move is stale'
      }
    }
    const dispatch = createRoomCommandDispatch({
      getEventSeq: () => 8,
      getRoomId: () => 'demo-room',
      getActorSessionSecret: () => 'session-secret',
      createRequestId: (commandType) => `${commandType}-request`,
      handleServerMessage: (message) => handled.push(message),
      postRoomCommand: async () => ({
        ok: false,
        message: rejected
      })
    })

    let error: unknown = null
    try {
      await dispatch.postCommand(moveCommand(), 'move-request')
    } catch (caught) {
      error = caught
    }
    assert.equal(
      error instanceof Error && error.message.includes('That move is stale'),
      true
    )
    assert.deepEqual(handled, [rejected])
  })

  it('formats non-error non-accepted messages as command failures', () => {
    assert.equal(
      serverMessageErrorText({
        type: 'roomState',
        state: null,
        eventSeq: 4
      }),
      'Command failed'
    )
  })
})
