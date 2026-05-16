import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createPwaUpdatePromptController } from './update-prompt'
import type { ServiceWorkerController } from './service-worker'

class TestElement {
  hidden = false
  textContent = ''
  disabled = false
  readonly attributes = new Map<string, string>()
  readonly listeners = new Map<string, Array<() => void>>()
  readonly messageElement: TestElement | null

  constructor({ withMessage = false } = {}) {
    this.messageElement = withMessage ? new TestElement() : null
  }

  querySelector(selector: string): TestElement | null {
    return selector === '[data-pwa-update-message]'
      ? this.messageElement
      : null
  }

  replaceChildren(...children: string[]): void {
    this.textContent = children.join('')
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  toggleAttribute(name: string, force?: boolean): void {
    if (force) {
      this.attributes.set(name, '')
    } else {
      this.attributes.delete(name)
    }
    if (name === 'disabled') this.disabled = Boolean(force)
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  click(): void {
    for (const listener of this.listeners.get('click') || []) {
      listener()
    }
  }
}

describe('PWA update prompt controller', () => {
  it('shows waiting updates and accepts refresh through the service worker', () => {
    let accepted = 0
    const prompt = new TestElement({ withMessage: true })
    const updateButton = new TestElement()
    const controller = createPwaUpdatePromptController({
      elements: {
        prompt: prompt as unknown as HTMLElement,
        updateButton: updateButton as unknown as HTMLElement,
        dismissButton: new TestElement() as unknown as HTMLElement
      },
      serviceWorker: {
        getUpdateState: () => ({ status: 'installedWaiting' }),
        acceptUpdate: () => {
          accepted++
          return true
        }
      } satisfies ServiceWorkerController
    })

    controller.render({ status: 'installedWaiting' })
    updateButton.click()

    assert.equal(prompt.hidden, false)
    assert.equal(prompt.messageElement?.textContent, 'A new version is ready.')
    assert.equal(updateButton.disabled, false)
    assert.equal(accepted, 1)
  })

  it('disables refresh while an update is installing or refreshing', () => {
    const prompt = new TestElement({ withMessage: true })
    const updateButton = new TestElement()
    const controller = createPwaUpdatePromptController({
      elements: {
        prompt: prompt as unknown as HTMLElement,
        updateButton: updateButton as unknown as HTMLElement,
        dismissButton: null
      }
    })

    controller.render({ status: 'installing' })
    assert.equal(prompt.hidden, false)
    assert.equal(updateButton.disabled, true)

    controller.render({ status: 'refreshing' })
    assert.equal(prompt.hidden, false)
    assert.equal(updateButton.disabled, true)
  })

  it('can dismiss a waiting prompt until the update state resets', () => {
    const prompt = new TestElement({ withMessage: true })
    const dismissButton = new TestElement()
    const controller = createPwaUpdatePromptController({
      elements: {
        prompt: prompt as unknown as HTMLElement,
        updateButton: new TestElement() as unknown as HTMLElement,
        dismissButton: dismissButton as unknown as HTMLElement
      }
    })

    controller.render({ status: 'installedWaiting' })
    dismissButton.click()
    controller.render({ status: 'installedWaiting' })

    assert.equal(prompt.hidden, true)

    controller.render({ status: 'idle' })
    controller.render({ status: 'installedWaiting' })

    assert.equal(prompt.hidden, false)
  })

  it('checks for another update after a refresh failure', () => {
    let checks = 0
    const updateButton = new TestElement()
    const controller = createPwaUpdatePromptController({
      elements: {
        prompt: new TestElement({ withMessage: true }) as unknown as HTMLElement,
        updateButton: updateButton as unknown as HTMLElement,
        dismissButton: null
      },
      serviceWorker: {
        getUpdateState: () => ({ status: 'refreshFailed', failedFrom: 'idle' }),
        checkForUpdate: () => {
          checks++
        }
      } satisfies ServiceWorkerController
    })

    controller.render({ status: 'refreshFailed', failedFrom: 'refreshing' })
    updateButton.click()

    assert.equal(updateButton.textContent, 'Retry')
    assert.equal(checks, 1)
  })
})
