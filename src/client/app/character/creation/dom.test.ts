import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createCharacterCreationDomController,
  type CharacterCreationDomControllerElements
} from './dom'
import type { CharacterCreationFlow } from './flow'

class FakeElement {
  private readonly listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type))
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0
  }
}

const asButton = (element: FakeElement): HTMLButtonElement =>
  element as unknown as HTMLButtonElement

const asElement = (element: FakeElement): HTMLElement =>
  element as unknown as HTMLElement

const homeworldFlow = (): CharacterCreationFlow =>
  ({ step: 'homeworld' }) as CharacterCreationFlow

const careerFlow = (): CharacterCreationFlow =>
  ({ step: 'career' }) as CharacterCreationFlow

const createElements = () => {
  const createCharacterRail = new FakeElement()
  const characterCreatorClose = new FakeElement()
  const startCharacterWizard = new FakeElement()
  const backCharacterWizard = new FakeElement()
  const nextCharacterWizard = new FakeElement()
  const characterCreationFields = new FakeElement()

  return {
    fakes: {
      createCharacterRail,
      characterCreatorClose,
      startCharacterWizard,
      backCharacterWizard,
      nextCharacterWizard,
      characterCreationFields
    },
    elements: {
      createCharacterRail: asButton(createCharacterRail),
      characterCreatorClose: asButton(characterCreatorClose),
      startCharacterWizard: asButton(startCharacterWizard),
      backCharacterWizard: asButton(backCharacterWizard),
      nextCharacterWizard: asButton(nextCharacterWizard),
      characterCreationFields: asElement(characterCreationFields)
    } satisfies CharacterCreationDomControllerElements
  }
}

const createHarness = ({
  flow = null,
  rejectStart = false,
  rejectAdvance = false
}: {
  flow?: CharacterCreationFlow | null
  rejectStart?: boolean
  rejectAdvance?: boolean
} = {}) => {
  const { elements, fakes } = createElements()
  let currentFlow = flow
  const calls = {
    startNew: 0,
    back: 0,
    advance: 0,
    syncFields: 0,
    autoAdvanceSetup: 0,
    publishProgress: 0,
    close: 0,
    clearReadOnlyFollow: 0,
    renderWizardControls: 0,
    renderWizard: 0,
    renderApp: 0,
    errors: [] as string[]
  }

  const controller = createCharacterCreationDomController({
    elements,
    controller: {
      flow: () => currentFlow,
      clearReadOnlyFollow: () => {
        currentFlow = null
        calls.clearReadOnlyFollow += 1
      }
    },
    wizard: {
      startNew: async () => {
        calls.startNew += 1
        if (rejectStart) throw new Error('start failed')
      },
      back: () => {
        calls.back += 1
      },
      advance: async () => {
        calls.advance += 1
        if (rejectAdvance) throw new Error('advance failed')
      },
      syncFields: () => {
        calls.syncFields += 1
      },
      autoAdvanceSetup: () => {
        calls.autoAdvanceSetup += 1
        return false
      }
    },
    panel: {
      close: () => {
        calls.close += 1
      }
    },
    homeworldPublisher: {
      publishProgress: async () => {
        calls.publishProgress += 1
      }
    },
    renderWizardControls: () => {
      calls.renderWizardControls += 1
    },
    renderWizard: () => {
      calls.renderWizard += 1
    },
    renderApp: () => {
      calls.renderApp += 1
    },
    reportError: (message) => {
      calls.errors.push(message)
    }
  })

  return { controller, elements, fakes, calls }
}

describe('character creation DOM controller', () => {
  it('starts creation from both entry buttons and reports async errors', async () => {
    const { fakes, calls } = createHarness({ rejectStart: true })

    fakes.createCharacterRail.dispatch('click')
    fakes.startCharacterWizard.dispatch('click')
    await Promise.resolve()

    assert.equal(calls.startNew, 2)
    assert.deepEqual(calls.errors, ['start failed', 'start failed'])
  })

  it('closes the panel, clears read-only follow state, and renders the app', () => {
    const { fakes, calls } = createHarness({ flow: careerFlow() })

    fakes.characterCreatorClose.dispatch('click')

    assert.equal(calls.close, 1)
    assert.equal(calls.clearReadOnlyFollow, 1)
    assert.equal(calls.renderApp, 1)
  })

  it('syncs wizard field input and publishes homeworld changes', () => {
    const { fakes, calls } = createHarness({ flow: homeworldFlow() })

    fakes.characterCreationFields.dispatch('input')
    fakes.characterCreationFields.dispatch('change')

    assert.equal(calls.syncFields, 2)
    assert.equal(calls.renderWizardControls, 1)
    assert.equal(calls.publishProgress, 1)
    assert.equal(calls.autoAdvanceSetup, 1)
    assert.equal(calls.renderWizard, 1)
  })

  it('does not publish non-homeworld field changes', () => {
    const { fakes, calls } = createHarness({ flow: careerFlow() })

    fakes.characterCreationFields.dispatch('change')

    assert.equal(calls.publishProgress, 0)
    assert.equal(calls.autoAdvanceSetup, 1)
    assert.equal(calls.renderWizard, 1)
  })

  it('delegates back and next buttons and removes listeners on dispose', async () => {
    const { controller, fakes, calls } = createHarness({ rejectAdvance: true })

    fakes.backCharacterWizard.dispatch('click')
    fakes.nextCharacterWizard.dispatch('click')
    await Promise.resolve()

    assert.equal(calls.back, 1)
    assert.equal(calls.advance, 1)
    assert.deepEqual(calls.errors, ['advance failed'])

    assert.equal(fakes.nextCharacterWizard.listenerCount('click'), 1)
    controller.dispose()
    controller.dispose()
    assert.equal(fakes.nextCharacterWizard.listenerCount('click'), 0)

    fakes.backCharacterWizard.dispatch('click')
    fakes.nextCharacterWizard.dispatch('click')
    await Promise.resolve()

    assert.equal(calls.back, 1)
    assert.equal(calls.advance, 1)
  })
})
