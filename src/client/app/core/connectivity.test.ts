import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createConnectivityModel,
  createConnectivityState,
  isConnectivityReady,
  reduceConnectivity
} from './connectivity'

describe('connectivity model', () => {
  it('creates a ready online state by default', () => {
    const state = createConnectivityState()

    assert.deepEqual(state, {
      status: 'online',
      isReconnecting: false,
      lastError: null,
      updateAvailable: false
    })
    assert.equal(isConnectivityReady(state), true)
  })

  it('tracks offline and reconnecting transitions without mutating input', () => {
    const initial = createConnectivityState()

    const offline = reduceConnectivity(initial, {
      type: 'offline',
      error: 'Network unavailable'
    })
    const reconnecting = reduceConnectivity(offline, {
      type: 'reconnectStarted'
    })
    const restored = reduceConnectivity(reconnecting, {
      type: 'reconnectSucceeded'
    })

    assert.deepEqual(initial, {
      status: 'online',
      isReconnecting: false,
      lastError: null,
      updateAvailable: false
    })
    assert.deepEqual(offline, {
      status: 'offline',
      isReconnecting: false,
      lastError: 'Network unavailable',
      updateAvailable: false
    })
    assert.deepEqual(reconnecting, {
      status: 'offline',
      isReconnecting: true,
      lastError: 'Network unavailable',
      updateAvailable: false
    })
    assert.deepEqual(restored, {
      status: 'online',
      isReconnecting: false,
      lastError: null,
      updateAvailable: false
    })
  })

  it('records reconnect failures and explicit error clearing', () => {
    const failed = reduceConnectivity(
      createConnectivityState({ status: 'offline', isReconnecting: true }),
      { type: 'reconnectFailed', error: 'Room reload failed' }
    )
    const cleared = reduceConnectivity(failed, { type: 'errorCleared' })

    assert.deepEqual(failed, {
      status: 'offline',
      isReconnecting: false,
      lastError: 'Room reload failed',
      updateAvailable: false
    })
    assert.equal(isConnectivityReady(failed), false)
    assert.equal(cleared.lastError, null)
  })

  it('tracks update availability independently of connection state', () => {
    const state = reduceConnectivity(
      createConnectivityState({
        status: 'offline',
        lastError: 'Offline'
      }),
      { type: 'updateAvailable' }
    )

    assert.deepEqual(state, {
      status: 'offline',
      isReconnecting: false,
      lastError: 'Offline',
      updateAvailable: true
    })

    assert.equal(
      reduceConnectivity(state, { type: 'updateConsumed' }).updateAvailable,
      false
    )
  })

  it('provides a tiny factory with immutable snapshots', () => {
    const model = createConnectivityModel()
    const before = model.snapshot()

    model.setOffline('Offline')
    model.startReconnect()
    model.markUpdateAvailable()
    model.finishReconnect()

    assert.deepEqual(before, {
      status: 'online',
      isReconnecting: false,
      lastError: null,
      updateAvailable: false
    })
    assert.deepEqual(model.snapshot(), {
      status: 'online',
      isReconnecting: false,
      lastError: null,
      updateAvailable: true
    })

    model.consumeUpdate()
    assert.equal(model.snapshot().updateAvailable, false)
  })
})
