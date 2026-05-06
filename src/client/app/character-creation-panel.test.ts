import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CharacterCreationFlow } from './character-creation-flow'
import { createCharacterCreationPanel } from './character-creation-panel'

class TestClassList {
  private classes = new Set<string>()

  toggle(name: string, force?: boolean) {
    const shouldInclude = force ?? !this.classes.has(name)
    if (shouldInclude) this.classes.add(name)
    else this.classes.delete(name)
    return shouldInclude
  }

  contains(name: string) {
    return this.classes.has(name)
  }
}

class TestElement {
  hidden = false
  disabled = false
  open = false
  textContent = ''
  title = ''
  children: TestElement[] = []
  classList = new TestClassList()
  scrolls: ScrollToOptions[] = []
  closed = false

  replaceChildren(...children: TestElement[]) {
    this.children = children
  }

  scrollTo(options: ScrollToOptions) {
    this.scrolls.push(options)
  }

  close() {
    this.closed = true
    this.open = false
  }
}

const asElement = (element: TestElement) => element as unknown as HTMLElement
const asButton = (element: TestElement) =>
  element as unknown as HTMLButtonElement
const asDialog = (element: TestElement) =>
  element as unknown as HTMLDialogElement

const createHarness = () => {
  const panel = new TestElement()
  const body = new TestElement()
  const roomDialog = new TestElement()
  const fallbackOverlayHost = new TestElement()
  const title = new TestElement()
  const startSection = new TestElement()
  const quickSection = new TestElement()
  const startWizardButton = new TestElement()
  const wizard = new TestElement()
  const steps = new TestElement()
  const status = new TestElement()
  const fields = new TestElement()
  const backWizardButton = new TestElement()
  const nextWizardButton = new TestElement()
  const actions = new TestElement()
  let sheetCloseCount = 0
  let renderCount = 0

  const controller = createCharacterCreationPanel({
    elements: {
      panel: asElement(panel),
      body: asElement(body),
      roomDialog: asDialog(roomDialog),
      fallbackOverlayHost: asElement(fallbackOverlayHost),
      title: asElement(title),
      startSection: asElement(startSection),
      quickSection: asElement(quickSection),
      startWizardButton: asButton(startWizardButton),
      wizard: asElement(wizard),
      steps: asElement(steps),
      status: asElement(status),
      fields: asElement(fields),
      backWizardButton: asButton(backWizardButton),
      nextWizardButton: asButton(nextWizardButton),
      actions: asElement(actions)
    },
    closeCharacterSheet: () => {
      sheetCloseCount += 1
    },
    requestRender: () => {
      renderCount += 1
    }
  })

  return {
    controller,
    elements: {
      panel,
      body,
      roomDialog,
      fallbackOverlayHost,
      title,
      startSection,
      quickSection,
      startWizardButton,
      wizard,
      steps,
      status,
      fields,
      backWizardButton,
      nextWizardButton,
      actions
    },
    counts: () => ({ sheetCloseCount, renderCount })
  }
}

describe('character creation panel controller', () => {
  it('opens the panel, closes room dialog, closes sheet, and requests render', () => {
    const { controller, elements, counts } = createHarness()
    elements.panel.hidden = true
    elements.roomDialog.open = true

    controller.open()

    assert.equal(elements.panel.hidden, false)
    assert.equal(elements.roomDialog.closed, true)
    assert.deepEqual(counts(), { sheetCloseCount: 1, renderCount: 1 })
  })

  it('closes the panel and requests render', () => {
    const { controller, elements, counts } = createHarness()

    controller.close()

    assert.equal(elements.panel.hidden, true)
    assert.deepEqual(counts(), { sheetCloseCount: 0, renderCount: 1 })
  })

  it('resets inactive shell chrome when no flow is active', () => {
    const { controller, elements } = createHarness()
    elements.steps.children = [new TestElement()]
    elements.status.children = [new TestElement()]
    elements.fields.children = [new TestElement()]
    elements.backWizardButton.hidden = true
    elements.nextWizardButton.hidden = true
    elements.actions.hidden = true
    elements.nextWizardButton.textContent = 'Create character'
    elements.nextWizardButton.title = 'Blocked'

    assert.equal(controller.render(null), false)

    assert.equal(elements.title.textContent, 'Create traveller')
    assert.equal(elements.panel.classList.contains('flow-active'), false)
    assert.equal(elements.startSection.hidden, false)
    assert.equal(elements.quickSection.hidden, false)
    assert.equal(
      elements.startWizardButton.textContent,
      'Begin character creation'
    )
    assert.equal(elements.wizard.hidden, true)
    assert.deepEqual(elements.steps.children, [])
    assert.deepEqual(elements.status.children, [])
    assert.deepEqual(elements.fields.children, [])
    assert.equal(elements.backWizardButton.disabled, true)
    assert.equal(elements.nextWizardButton.disabled, true)
    assert.equal(elements.backWizardButton.hidden, false)
    assert.equal(elements.nextWizardButton.hidden, false)
    assert.equal(elements.actions.hidden, false)
    assert.equal(elements.nextWizardButton.textContent, 'Next')
    assert.equal(elements.nextWizardButton.title, '')
  })

  it('renders active flow shell state without clearing wizard contents', () => {
    const { controller, elements } = createHarness()
    const existingField = new TestElement()
    elements.fields.children = [existingField]

    assert.equal(
      controller.render({
        draft: { name: ' Iona Vesh ' }
      } as CharacterCreationFlow),
      true
    )

    assert.equal(elements.title.textContent, 'Iona Vesh')
    assert.equal(elements.panel.classList.contains('flow-active'), true)
    assert.equal(elements.startSection.hidden, true)
    assert.equal(elements.quickSection.hidden, true)
    assert.deepEqual(elements.fields.children, [existingField])
  })

  it('can reveal and scroll without requesting a render', () => {
    const { controller, elements, counts } = createHarness()
    elements.panel.hidden = true

    controller.show()
    controller.scrollToTop()

    assert.equal(elements.panel.hidden, false)
    assert.deepEqual(elements.body.scrolls, [{ top: 0, behavior: 'smooth' }])
    assert.deepEqual(counts(), { sheetCloseCount: 0, renderCount: 0 })
  })

  it('chooses the dice overlay host from creator, dialog, then fallback', () => {
    const { controller, elements } = createHarness()

    elements.panel.hidden = true
    elements.roomDialog.open = false
    assert.equal(controller.overlayHost(), asElement(elements.fallbackOverlayHost))
    assert.deepEqual(controller.overlayContext(), {
      inCreator: false,
      inDialog: false
    })

    elements.roomDialog.open = true
    assert.equal(controller.overlayHost(), asDialog(elements.roomDialog))
    assert.deepEqual(controller.overlayContext(), {
      inCreator: false,
      inDialog: true
    })

    elements.panel.hidden = false
    assert.equal(controller.overlayHost(), asElement(elements.panel))
    assert.deepEqual(controller.overlayContext(), {
      inCreator: true,
      inDialog: true
    })
  })
})
