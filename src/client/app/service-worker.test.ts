import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { registerClientServiceWorker } from './service-worker'

class FakeServiceWorkerTarget {
  controller: ServiceWorker | null
  registeredUrl: string | null = null
  private readonly listeners: Array<(event: Event) => void> = []

  constructor(hasController: boolean) {
    this.controller = hasController ? ({} as ServiceWorker) : null
  }

  async register(scriptURL: string): Promise<ServiceWorkerRegistration> {
    this.registeredUrl = scriptURL
    return {} as ServiceWorkerRegistration
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

describe('client service worker registration', () => {
  it('does nothing when service workers are unavailable', () => {
    let reloads = 0

    registerClientServiceWorker({
      navigatorLike: {} as Navigator,
      locationLike: {
        reload: () => {
          reloads++
        }
      }
    })

    assert.equal(reloads, 0)
  })

  it('registers the service worker script', () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)

    registerClientServiceWorker({
      navigatorLike: { serviceWorker } as unknown as Navigator,
      locationLike: { reload: () => {} }
    })

    assert.equal(serviceWorker.registeredUrl, '/sw.js')
  })

  it('does not reload on the first controller for a fresh install', () => {
    const serviceWorker = new FakeServiceWorkerTarget(false)
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

    assert.equal(reloads, 0)
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
})
