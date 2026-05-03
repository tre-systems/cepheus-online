import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Command } from '../../shared/commands'
import { asGameId, asUserId } from '../../shared/ids'
import {
  fetchRoomState,
  postRoomCommand,
  type CommandResponse
} from './room-api'

const createGameCommand = (): Command => ({
  type: 'CreateGame',
  gameId: asGameId('demo-room'),
  actorId: asUserId('local-user'),
  slug: 'demo-room',
  name: 'Demo Room'
})

describe('room API helpers', () => {
  it('constructs the viewer-scoped room state request', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = []
    const fetcher = async (input: string, init?: RequestInit) => {
      requests.push({ input, init })
      return {
        ok: true,
        json: async () => ({
          type: 'roomState',
          state: null,
          eventSeq: 0
        })
      }
    }

    const message = await fetchRoomState({
      roomId: 'demo room',
      viewerRole: 'player/referee',
      actorId: 'local user',
      fetch: fetcher
    })

    assert.deepEqual(requests, [
      {
        input:
          '/rooms/demo%20room/state?viewer=player%2Freferee&user=local%20user',
        init: undefined
      }
    ])
    assert.deepEqual(message, {
      type: 'roomState',
      state: null,
      eventSeq: 0
    })
  })

  it('posts a command envelope without throwing for rejected responses', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = []
    const fetcher = async (input: string, init?: RequestInit) => {
      requests.push({ input, init })
      return {
        ok: false,
        json: async () => ({
          type: 'commandRejected',
          requestId: 'CreateGame-1',
          error: {
            code: 'stale_command',
            message: 'Command expected sequence 1, got 2'
          },
          eventSeq: 2
        })
      }
    }

    const result: CommandResponse = await postRoomCommand({
      roomId: 'demo-room',
      requestId: 'CreateGame-1',
      command: createGameCommand(),
      fetch: fetcher
    })

    assert.equal(result.ok, false)
    assert.deepEqual(result.message, {
      type: 'commandRejected',
      requestId: 'CreateGame-1',
      error: {
        code: 'stale_command',
        message: 'Command expected sequence 1, got 2'
      },
      eventSeq: 2
    })
    assert.equal(requests[0]?.input, '/rooms/demo-room/command')
    assert.deepEqual(requests[0]?.init, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'command',
        requestId: 'CreateGame-1',
        command: createGameCommand()
      })
    })
  })
})
