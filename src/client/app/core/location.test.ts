import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildRoomUrl,
  buildRoomWebSocketUrl,
  isRefereeViewer,
  resolveAppLocationIdentity
} from './location'

describe('app location helpers', () => {
  it('resolves room identity from URL search params', () => {
    assert.deepEqual(
      resolveAppLocationIdentity(
        '?game=spinward%20marches&user=scout%2Fone&viewer=player'
      ),
      {
        roomId: 'spinward marches',
        actorId: 'scout/one',
        viewerRole: 'player'
      }
    )
  })

  it('falls back to defaults for missing or empty query values', () => {
    assert.deepEqual(resolveAppLocationIdentity('?game=&user=&viewer='), {
      roomId: 'demo-room',
      actorId: 'local-user',
      viewerRole: 'referee'
    })
    assert.deepEqual(
      resolveAppLocationIdentity('', {
        roomId: 'custom-room',
        actorId: 'custom-user',
        viewerRole: 'player'
      }),
      {
        roomId: 'custom-room',
        actorId: 'custom-user',
        viewerRole: 'player'
      }
    )
  })

  it('derives referee viewer access case-insensitively', () => {
    assert.equal(isRefereeViewer('referee'), true)
    assert.equal(isRefereeViewer('ReFeReE'), true)
    assert.equal(isRefereeViewer('player'), false)
  })

  it('builds room URLs while preserving unrelated query params', () => {
    assert.equal(
      String(
        buildRoomUrl(
          'https://cepheus.test/?viewer=referee&game=old-room&layout=wide',
          {
            roomId: 'new room',
            actorId: 'scout/user'
          }
        )
      ),
      'https://cepheus.test/?viewer=referee&game=new+room&layout=wide&user=scout%2Fuser'
    )
  })

  it('builds viewer-scoped room WebSocket URLs', () => {
    assert.equal(
      buildRoomWebSocketUrl({
        protocol: 'https:',
        host: 'cepheus.test',
        roomId: 'demo room',
        viewerRole: 'player/referee',
        actorId: 'local user',
        actorSessionSecret: 'test-session-token-123456'
      }),
      'wss://cepheus.test/rooms/demo%20room/ws?viewer=player%2Freferee&user=local%20user&session=test-session-token-123456'
    )
    assert.equal(
      buildRoomWebSocketUrl({
        protocol: 'http:',
        host: 'localhost:8787',
        roomId: 'demo-room',
        viewerRole: 'referee',
        actorId: 'local-user',
        actorSessionSecret: 'test-session-token-123456'
      }),
      'ws://localhost:8787/rooms/demo-room/ws?viewer=referee&user=local-user&session=test-session-token-123456'
    )
  })
})
