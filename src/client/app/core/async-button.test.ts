import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { bindAsyncActionButton } from './async-button'

class TestEvent {
  defaultPrevented = false

  preventDefault() {
    this.defaultPrevented = true
  }
}

class TestButton {
  disabled = false
  private listeners = new Map<string, ((event: Event) => void)[]>()

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  dispatch(type: string): TestEvent {
    const event = new TestEvent()
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as unknown as Event)
    }
    return event
  }
}

const asButton = (button: TestButton) => button as unknown as HTMLButtonElement

describe('async action button binding', () => {
  it('prevents duplicate pointer/click submissions while the callback is active', async () => {
    const button = new TestButton()
    let resolveAction: () => void = () => {}
    let count = 0
    bindAsyncActionButton(asButton(button), () => {
      count += 1
      return new Promise<void>((resolve) => {
        resolveAction = resolve
      })
    })

    const pointer = button.dispatch('pointerdown')
    const click = button.dispatch('click')

    assert.equal(pointer.defaultPrevented, true)
    assert.equal(click.defaultPrevented, true)
    assert.equal(count, 1)
    assert.equal(button.disabled, true)

    resolveAction()
    await Promise.resolve()

    assert.equal(button.disabled, false)
    button.dispatch('click')
    assert.equal(count, 2)
  })

  it('restores a button that was already disabled before the action', async () => {
    const button = new TestButton()
    button.disabled = true
    bindAsyncActionButton(asButton(button), () => undefined)

    button.dispatch('click')
    await Promise.resolve()

    assert.equal(button.disabled, true)
  })
})
