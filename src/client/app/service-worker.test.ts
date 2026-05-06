import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { registerClientServiceWorker } from './service-worker'
import type { PwaUpdateEvent, PwaUpdateState } from './pwa-update-state'

class FakeServiceWorker {
  state: ServiceWorkerState = 'installing'
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
}

class FakeServiceWorkerRegistration {
  installing: ServiceWorker | null = null
  waiting: ServiceWorker | null = null
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
})
