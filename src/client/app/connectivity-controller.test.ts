import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createConnectivityController,
  type ConnectivityEventTarget
} from './connectivity-controller'
import type { ConnectivityState } from './connectivity'

class FakeEventTarget implements ConnectivityEventTarget {
  readonly listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: 'online' | 'offline', listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(
    type: 'online' | 'offline',
    listener: EventListener
  ): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: 'online' | 'offline'): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type))
    }
  }

  listenerCount(type: 'online' | 'offline'): number {
    return this.listeners.get(type)?.size ?? 0
  }
}

describe('connectivity controller', () => {
  it('derives its initial state from navigator.onLine', () => {
    const target = new FakeEventTarget()

    const controller = createConnectivityController({
      eventTarget: target,
      navigatorLike: { onLine: false }
    })

    assert.deepEqual(controller.snapshot(), {
      status: 'offline',
      isReconnecting: false,
      lastError: null,
      updateAvailable: false
    })
  })

  it('updates the model from browser online and offline events', () => {
    const target = new FakeEventTarget()
    const changes: Array<{
      state: ConnectivityState
      previousState: ConnectivityState
    }> = []

    const controller = createConnectivityController({
      eventTarget: target,
      navigatorLike: { onLine: true },
      onChange: (state, previousState) => {
        changes.push({ state, previousState })
      }
    })

    target.dispatch('offline')
    assert.deepEqual(controller.snapshot(), {
      status: 'offline',
      isReconnecting: false,
      lastError: 'Browser is offline',
      updateAvailable: false
    })

    target.dispatch('online')
    assert.deepEqual(controller.snapshot(), {
      status: 'online',
      isReconnecting: false,
      lastError: null,
      updateAvailable: false
    })

    assert.equal(changes.length, 2)
    assert.equal(changes[0].previousState.status, 'online')
    assert.equal(changes[0].state.status, 'offline')
    assert.equal(changes[1].previousState.status, 'offline')
    assert.equal(changes[1].state.status, 'online')
  })

  it('removes event listeners when disposed', () => {
    const target = new FakeEventTarget()
    let changeCount = 0

    const controller = createConnectivityController({
      eventTarget: target,
      navigatorLike: { onLine: true },
      onChange: () => {
        changeCount += 1
      }
    })

    assert.equal(target.listenerCount('online'), 1)
    assert.equal(target.listenerCount('offline'), 1)

    controller.dispose()
    controller.dispose()
    target.dispatch('offline')

    assert.equal(target.listenerCount('online'), 0)
    assert.equal(target.listenerCount('offline'), 0)
    assert.equal(changeCount, 0)
    assert.equal(controller.snapshot().status, 'online')
  })

  it('keeps snapshots immutable for callback consumers', () => {
    const target = new FakeEventTarget()
    const callbackStates: ConnectivityState[] = []

    const controller = createConnectivityController({
      eventTarget: target,
      navigatorLike: { onLine: true },
      onChange: (state) => {
        callbackStates.push(state)
      }
    })

    target.dispatch('offline')

    const state = callbackStates[0]
    if (!state) throw new Error('expected connectivity callback')
    state.status = 'online'
    assert.equal(controller.snapshot().status, 'offline')
  })
})
