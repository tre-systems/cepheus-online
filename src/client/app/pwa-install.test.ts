import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createPwaInstallController,
  INSTALL_ACCEPTED_KEY,
  INSTALL_DISMISSED_KEY,
  type BeforeInstallPromptEvent
} from './pwa-install'

class FakeTarget {
  private readonly listeners = new Map<string, Array<(event: Event) => void>>()

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener as (event: Event) => void)
    this.listeners.set(type, listeners)
  }

  matchMedia(): MediaQueryList {
    return { matches: false } as MediaQueryList
  }

  dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) || []) {
      listener(event)
    }
  }
}

class FakeStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class FakeElement {
  hidden = true
  private readonly listeners = new Map<string, Array<(event: Event) => void>>()

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener as (event: Event) => void)
    this.listeners.set(type, listeners)
  }

  click(): void {
    for (const listener of this.listeners.get('click') || []) {
      listener(new Event('click'))
    }
  }
}

const beforeInstallPromptEvent = (
  outcome: 'accepted' | 'dismissed' = 'accepted'
): BeforeInstallPromptEvent & { prompted: boolean; prevented: boolean } => {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent & {
    prompted: boolean
    prevented: boolean
  }
  event.prompted = false
  event.prevented = false
  event.preventDefault = () => {
    event.prevented = true
  }
  event.prompt = async () => {
    event.prompted = true
  }
  event.userChoice = Promise.resolve({ outcome })
  return event
}

describe('PWA install prompt controller', () => {
  it('shows the install prompt after the browser install event', () => {
    const target = new FakeTarget()
    const storage = new FakeStorage()
    const prompt = new FakeElement()

    createPwaInstallController({
      elements: {
        prompt: prompt as unknown as HTMLElement,
        installButton: new FakeElement() as unknown as HTMLElement,
        dismissButton: null
      },
      windowTarget: target as unknown as Pick<
        Window,
        'addEventListener' | 'matchMedia'
      >,
      localStorage: storage,
      navigatorLike: {} as Navigator
    })

    const event = beforeInstallPromptEvent()
    target.dispatch('beforeinstallprompt', event)

    assert.equal(event.prevented, true)
    assert.equal(prompt.hidden, false)
  })

  it('stores accepted install prompts and hides the banner', async () => {
    const target = new FakeTarget()
    const storage = new FakeStorage()
    const prompt = new FakeElement()
    const installButton = new FakeElement()

    createPwaInstallController({
      elements: {
        prompt: prompt as unknown as HTMLElement,
        installButton: installButton as unknown as HTMLElement,
        dismissButton: null
      },
      windowTarget: target as unknown as Pick<
        Window,
        'addEventListener' | 'matchMedia'
      >,
      localStorage: storage,
      navigatorLike: {} as Navigator
    })

    const event = beforeInstallPromptEvent('accepted')
    target.dispatch('beforeinstallprompt', event)
    installButton.click()
    await event.userChoice
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(event.prompted, true)
    assert.equal(prompt.hidden, true)
    assert.equal(storage.getItem(INSTALL_ACCEPTED_KEY), '1')
  })

  it('stores dismissal and suppresses future display', () => {
    const target = new FakeTarget()
    const storage = new FakeStorage()
    const prompt = new FakeElement()
    const dismissButton = new FakeElement()

    const controller = createPwaInstallController({
      elements: {
        prompt: prompt as unknown as HTMLElement,
        installButton: new FakeElement() as unknown as HTMLElement,
        dismissButton: dismissButton as unknown as HTMLElement
      },
      windowTarget: target as unknown as Pick<
        Window,
        'addEventListener' | 'matchMedia'
      >,
      localStorage: storage,
      navigatorLike: {} as Navigator
    })

    target.dispatch('beforeinstallprompt', beforeInstallPromptEvent())
    dismissButton.click()
    controller.refresh()

    assert.equal(storage.getItem(INSTALL_DISMISSED_KEY), '1')
    assert.equal(prompt.hidden, true)
  })
})
