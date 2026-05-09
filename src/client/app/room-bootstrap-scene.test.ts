import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameCommand } from '../../shared/commands'
import type { GameId, UserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import { createRoomBootstrapScene } from './room-bootstrap-scene'

const roomId = 'demo-room' as GameId
const actorId = 'local-user' as UserId

const createGameCommand = (): GameCommand => ({
  type: 'CreateGame',
  gameId: roomId,
  actorId,
  slug: roomId,
  name: 'Cepheus Room demo-room'
})

const gameState = (eventSeq: number): GameState =>
  ({
    id: roomId,
    slug: roomId,
    name: 'Cepheus Room demo-room',
    ownerId: actorId,
    players: {},
    characters: {},
    boards: {},
    pieces: {},
    diceLog: [],
    selectedBoardId: null,
    eventSeq
  }) as GameState

describe('room bootstrap scene', () => {
  it('clears errors, posts planned commands, and refreshes state', async () => {
    let state: GameState | null = null
    const calls: string[] = []

    const scene = createRoomBootstrapScene({
      getIdentity: () => ({ roomId, actorId }),
      getState: () => state,
      clearError: () => {
        calls.push('clearError')
      },
      planNextCommand: ({ state: currentState }) =>
        currentState?.eventSeq === 1 ? null : createGameCommand(),
      postCommand: async (command, requestId) => {
        calls.push(`${requestId}:${command.type}`)
        state = gameState(1)
      },
      fetchState: async () => {
        calls.push('fetchState')
      }
    })

    await scene.run()

    assert.deepEqual(calls, [
      'clearError',
      'bootstrap-0:CreateGame',
      'fetchState'
    ])
  })

  it('refreshes state when no bootstrap command is needed', async () => {
    const calls: string[] = []

    const scene = createRoomBootstrapScene({
      getIdentity: () => ({ roomId, actorId }),
      getState: () => gameState(1),
      clearError: () => {
        calls.push('clearError')
      },
      planNextCommand: () => null,
      postCommand: async () => {
        calls.push('postCommand')
      },
      fetchState: async () => {
        calls.push('fetchState')
      }
    })

    await scene.run()

    assert.deepEqual(calls, ['clearError', 'fetchState'])
  })

  it('stops at the configured maximum number of commands', async () => {
    const requestIds: string[] = []

    const scene = createRoomBootstrapScene({
      getIdentity: () => ({ roomId, actorId }),
      getState: () => null,
      clearError: () => {},
      maxSteps: 2,
      planNextCommand: () => createGameCommand(),
      postCommand: async (_command, requestId) => {
        if (requestId) requestIds.push(requestId)
      },
      fetchState: async () => {}
    })

    await scene.run()

    assert.deepEqual(requestIds, ['bootstrap-0', 'bootstrap-1'])
  })
})
