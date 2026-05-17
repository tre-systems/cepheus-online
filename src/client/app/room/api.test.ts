import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Command } from '../../../shared/commands'
import { asGameId, asUserId } from '../../../shared/ids'
import {
  fetchAppSession,
  fetchRoomState,
  listRoomAssets,
  postRoomCommand,
  type CommandResponse,
  uploadRoomAsset
} from './api'

const createGameCommand = (): Command => ({
  type: 'CreateGame',
  gameId: asGameId('demo-room'),
  actorId: asUserId('local-user'),
  slug: 'demo-room',
  name: 'Demo Room'
})

describe('room API helpers', () => {
  it('loads the app session without exposing identity in query params', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = []
    const fetcher = async (input: string, init?: RequestInit) => {
      requests.push({ input, init })
      return {
        ok: true,
        json: async () => ({
          authenticated: true,
          user: { id: 'discord:1234', username: 'Scout', avatarUrl: null }
        })
      }
    }

    const session = await fetchAppSession(fetcher)

    assert.equal(requests[0]?.input, '/api/session')
    assert.equal(requests[0]?.init, undefined)
    assert.equal(session.user?.id, 'discord:1234')
  })

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
      actorSessionSecret: 'test-session-token-123456',
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
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': 'test-session-token-123456'
      },
      body: JSON.stringify({
        type: 'command',
        requestId: 'CreateGame-1',
        command: createGameCommand()
      })
    })
  })

  it('lists protected room assets through the API room route', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = []
    const fetcher = async (input: string, init?: RequestInit) => {
      requests.push({ input, init })
      return {
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'asset_board',
              kind: 'geomorph',
              url: '/api/assets/asset_board',
              width: 100,
              height: 80,
              gridScale: 50,
              losSidecar: null
            }
          ]
        })
      }
    }

    const assets = await listRoomAssets({
      roomId: 'demo room',
      fetch: fetcher
    })

    assert.equal(requests[0]?.input, '/api/rooms/demo%20room/assets')
    assert.equal(requests[0]?.init, undefined)
    assert.equal(assets[0]?.id, 'asset_board')
  })

  it('uploads room assets as multipart form data', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = []
    const file = new File(['image'], 'board.png', { type: 'image/png' })
    const fetcher = async (input: string, init?: RequestInit) => {
      requests.push({ input, init })
      return {
        ok: true,
        json: async () => ({
          asset: {
            id: 'asset_board',
            kind: 'geomorph',
            url: '/api/assets/asset_board',
            width: 100,
            height: 80,
            gridScale: 50,
            losSidecar: null
          }
        })
      }
    }

    const asset = await uploadRoomAsset({
      roomId: 'demo-room',
      kind: 'geomorph',
      file,
      gridScale: 50,
      losSidecar: '{"occluders":[]}',
      fetch: fetcher
    })

    assert.equal(requests[0]?.input, '/api/rooms/demo-room/assets')
    assert.equal(requests[0]?.init?.method, 'POST')
    assert.equal(requests[0]?.init?.body instanceof FormData, true)
    assert.equal((requests[0]?.init?.body as FormData).get('file'), file)
    assert.equal((requests[0]?.init?.body as FormData).get('kind'), 'geomorph')
    assert.equal((requests[0]?.init?.body as FormData).get('gridScale'), '50')
    assert.equal(asset.id, 'asset_board')
  })
})
