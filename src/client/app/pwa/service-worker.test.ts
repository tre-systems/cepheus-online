import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { registerClientServiceWorker } from './service-worker'
import type { PwaUpdateEvent, PwaUpdateState } from './update-state'

class FakeServiceWorker {
  state: ServiceWorkerState = 'installing'
  messages: unknown[] = []
  private readonly listeners: Array<(event: Event) => void> = []

  addEventListener(
    type: 'statechange',
    listener: (event: Event) => void
  ): void {
    if (type === 'statechange') this.listeners.push(listener)
  }

  dispatchStateChange(state: ServiceWorkerState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener(new Event('statechange'))
    }
  }

  postMessage(message: unknown): void {
    this.messages.push(message)
  }
}

class FakeServiceWorkerRegistration {
  installing: ServiceWorker | null = null
  waiting: ServiceWorker | null = null
  updateCalls = 0
  shouldRejectUpdate = false
  private readonly listeners: Array<(event: Event) => void> = []

  addEventListener(
    type: 'updatefound',
    listener: (event: Event) => void
  ): void {
    if (type === 'updatefound') this.listeners.push(listener)
  }

  dispatchUpdateFound(installing: FakeServiceWorker): void {
    this.installing = installing as unknown as ServiceWorker
    for (const listener of this.listeners) {
      listener(new Event('updatefound'))
    }
  }

  async update(): Promise<ServiceWorkerRegistration> {
    this.updateCalls++
    if (this.shouldRejectUpdate) {
      throw new Error('update failed')
    }
    return this as unknown as ServiceWorkerRegistration
  }
}

class FakeServiceWorkerTarget {
  controller: ServiceWorker | null
  registeredUrl: string | null = null
  registration = new FakeServiceWorkerRegistration()
  shouldRejectRegistration = false
  private readonly listeners: Array<(event: Event) => void> = []

  constructor(hasController: boolean) {
    this.controller = hasController ? ({} as ServiceWorker) : null
  }

  async register(scriptURL: string): Promise<ServiceWorkerRegistration> {
    this.registeredUrl = scriptURL
    if (this.shouldRejectRegistration) {
      throw new Error('registration failed')
    }
    return this.registration as unknown as ServiceWorkerRegistration
  }

  addEventListener(
    type: 'controllerchange',
    listener: (event: Event) => void
  ): void {
    if (type === 'controllerchange') this.listeners.push(listener)
  }

  dispatchControllerChange(): void {
    for (const listener of this.listeners) {
      listener(new Event('controllerchange'))
    }
  }
}

class FakeUpdateWindowTarget {
  private readonly listeners = new Map<string, Array<(event: Event) => void>>()
  private readonly intervals = new Map<number, () => void>()
  private nextIntervalId = 1

  addEventListener(
    type: 'focus' | 'online',
    listener: (event: Event) => void
  ): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(
    type: 'focus' | 'online',
    listener: (event: Event) => void
  ): void {
    const listeners = this.listeners.get(type) || []
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener)
    )
  }

  setInterval(handler: () => void, _timeout: number): number {
    const id = this.nextIntervalId++
    this.intervals.set(id, handler)
    return id
  }

  clearInterval(handle: number): void {
    this.intervals.delete(handle)
  }

  dispatch(type: 'focus' | 'online'): void {
    for (const listener of this.listeners.get(type) || []) {
      listener(new Event(type))
    }
  }

  tickIntervals(): void {
    for (const handler of this.intervals.values()) {
      handler()
    }
  }

  listenerCount(type: 'focus' | 'online'): number {
    return this.listeners.get(type)?.length ?? 0
  }

  intervalCount(): number {
    return this.intervals.size
  }
}

class FakeUpdateDocumentTarget {
  visibilityState: DocumentVisibilityState = 'visible'
  private readonly listeners: Array<(event: Event) => void> = []

  addEventListener(
    type: 'visibilitychange',
    listener: (event: Event) => void
  ): void {
    if (type === 'visibilitychange') this.listeners.push(listener)
  }

  removeEventListener(
    _type: 'visibilitychange',
    listener: (event: Event) => void
  ): void {
    const index = this.listeners.indexOf(listener)
    if (index >= 0) this.listeners.splice(index, 1)
  }

  dispatchVisibilityChange(visibilityState: DocumentVisibilityState): void {
    this.visibilityState = visibilityState
    for (const listener of this.listeners) {
      listener(new Event('visibilitychange'))
    }
  }

  listenerCount(): number {
    return this.listeners.length
  }
}

const flushPromises = async (): Promise<void> => {
  await Promise.resolve()
}

describe('client service worker registration', () => {
  it('does nothing when service workers are unavailable', () => {
    let reloads = 0

    const controller = registerClientServiceWorker({
      navigatorLike: {} as Navigator,
      locationLike: {
        reload: () => {
          reloads++
        }
      }
    })

    assert.equal(reloads, 0)
    assert.equal(controller, null)
  })

  it('registers the service worker script', () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)

    registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} }
    })

    assert.equal(serviceWorker.registeredUrl, '/sw.js')
  })

  it('starts with idle update state', () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} }
    })

    assert.deepEqual(controller?.getUpdateState(), { status: 'idle' })
  })

  it('reports a waiting worker that is present after registration', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    const states: PwaUpdateState[] = []
    serviceWorker.registration.waiting = {} as ServiceWorker

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      onUpdateStateChange: (state) => states.push(state)
    })

    await flushPromises()

    assert.deepEqual(controller?.getUpdateState(), {
      status: 'installedWaiting'
    })
    assert.deepEqual(states, [{ status: 'installedWaiting' }])
  })

  it('maps updatefound and waiting lifecycle events into update state', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    const installingWorker = new FakeServiceWorker()
    const events: PwaUpdateEvent[] = []
    const states: PwaUpdateState[] = []

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      onUpdateStateChange: (state, event) => {
        states.push(state)
        events.push(event)
      }
    })

    await flushPromises()
    serviceWorker.registration.dispatchUpdateFound(installingWorker)
    serviceWorker.registration.waiting =
      installingWorker as unknown as ServiceWorker
    installingWorker.dispatchStateChange('installed')

    assert.deepEqual(controller?.getUpdateState(), {
      status: 'installedWaiting'
    })
    assert.deepEqual(events, [
      { type: 'registrationUpdateFound' },
      { type: 'waitingWorkerAvailable' }
    ])
    assert.deepEqual(states, [
      { status: 'installing' },
      { status: 'installedWaiting' }
    ])
  })

  it('does not reload on the first controller for a fresh install', () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)
    let reloads = 0
    const states: PwaUpdateState[] = []

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: {
        reload: () => {
          reloads++
        }
      },
      onUpdateStateChange: (state) => states.push(state)
    })

    serviceWorker.dispatchControllerChange()

    assert.equal(reloads, 0)
    assert.deepEqual(controller?.getUpdateState(), { status: 'idle' })
    assert.deepEqual(states, [])
  })

  it('reloads once when an existing controller changes', () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    let reloads = 0

    registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: {
        reload: () => {
          reloads++
        }
      }
    })

    serviceWorker.dispatchControllerChange()
    serviceWorker.dispatchControllerChange()

    assert.equal(reloads, 1)
  })

  it('clears waiting update state when the controller changes', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    const states: PwaUpdateState[] = []
    serviceWorker.registration.waiting = {} as ServiceWorker

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      onUpdateStateChange: (state) => states.push(state)
    })

    await flushPromises()
    serviceWorker.dispatchControllerChange()

    assert.deepEqual(controller?.getUpdateState(), { status: 'idle' })
    assert.deepEqual(states, [
      { status: 'installedWaiting' },
      { status: 'idle' }
    ])
  })

  it('activates a waiting update only after user acceptance', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    const waitingWorker = new FakeServiceWorker()
    serviceWorker.registration.waiting =
      waitingWorker as unknown as ServiceWorker

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} }
    })

    await flushPromises()

    assert.equal(controller?.acceptUpdate?.(), true)
    assert.deepEqual(controller?.getUpdateState(), { status: 'refreshing' })
    assert.deepEqual(waitingWorker.messages, [{ type: 'SKIP_WAITING' }])
  })

  it('does not accept an update when no waiting worker is available', () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} }
    })

    assert.equal(controller?.acceptUpdate?.(), false)
    assert.deepEqual(controller?.getUpdateState(), { status: 'idle' })
  })

  it('reports registration failures through update state', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)
    serviceWorker.shouldRejectRegistration = true
    const states: PwaUpdateState[] = []

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      onUpdateStateChange: (state) => states.push(state)
    })

    await flushPromises()

    assert.deepEqual(controller?.getUpdateState(), {
      status: 'refreshFailed',
      failedFrom: 'idle',
      message: 'Service worker registration failed'
    })
    assert.deepEqual(states, [
      {
        status: 'refreshFailed',
        failedFrom: 'idle',
        message: 'Service worker registration failed'
      }
    ])
  })

  it('checks for service worker updates after registration on controlled pages', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      updateCheckIntervalMs: null
    })

    await flushPromises()
    controller?.checkForUpdate?.()
    await flushPromises()

    assert.equal(serviceWorker.registration.updateCalls, 2)
  })

  it('does not immediately update-check during a fresh install', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)

    registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      updateCheckIntervalMs: null
    })

    await flushPromises()

    assert.equal(serviceWorker.registration.updateCalls, 0)
  })

  it('rechecks for newer builds on focus, online, visible, and interval ticks', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    const windowTarget = new FakeUpdateWindowTarget()
    const documentTarget = new FakeUpdateDocumentTarget()

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      windowTarget,
      documentTarget,
      updateCheckIntervalMs: 30000
    })

    await flushPromises()
    assert.equal(serviceWorker.registration.updateCalls, 1)

    windowTarget.dispatch('focus')
    windowTarget.dispatch('online')
    documentTarget.dispatchVisibilityChange('hidden')
    documentTarget.dispatchVisibilityChange('visible')
    windowTarget.tickIntervals()

    assert.equal(serviceWorker.registration.updateCalls, 5)

    controller?.dispose?.()
    windowTarget.dispatch('focus')
    documentTarget.dispatchVisibilityChange('visible')
    windowTarget.tickIntervals()

    assert.equal(serviceWorker.registration.updateCalls, 5)
    assert.equal(windowTarget.listenerCount('focus'), 0)
    assert.equal(windowTarget.listenerCount('online'), 0)
    assert.equal(documentTarget.listenerCount(), 0)
    assert.equal(windowTarget.intervalCount(), 0)
  })

  it('ignores transient service worker update-check failures', async () => {
    const serviceWorker = new FakeServiceWorkerTarget(true)
    const states: PwaUpdateState[] = []
    serviceWorker.registration.shouldRejectUpdate = true

    const controller = registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} },
      onUpdateStateChange: (state) => states.push(state),
      updateCheckIntervalMs: null
    })

    await flushPromises()
    await flushPromises()

    assert.deepEqual(controller?.getUpdateState(), { status: 'idle' })
    assert.deepEqual(states, [])
    assert.equal(serviceWorker.registration.updateCalls, 1)
  })
})
