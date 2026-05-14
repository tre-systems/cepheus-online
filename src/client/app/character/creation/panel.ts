import type { CharacterCreationViewModel } from './model.js'

export interface CharacterCreationPanelElements {
  panel: HTMLElement
  body: HTMLElement | null
  roomDialog: HTMLDialogElement
  fallbackOverlayHost: HTMLElement | null
  title: HTMLElement
  startSection: HTMLElement
  quickSection: HTMLElement | null
  startWizardButton: HTMLButtonElement
  wizard: HTMLElement
  steps: HTMLElement
  status: HTMLElement
  fields: HTMLElement
  backWizardButton: HTMLButtonElement
  nextWizardButton: HTMLButtonElement
  actions: HTMLElement | null
}

export interface CharacterCreationPanelOptions {
  elements: CharacterCreationPanelElements
  closeCharacterSheet: () => void
  requestRender: () => void
}

export interface CharacterCreationPanelController {
  isOpen: () => boolean
  overlayHost: () => HTMLElement | null
  overlayContext: () => { inCreator: boolean; inDialog: boolean }
  show: () => void
  open: () => void
  close: () => void
  scrollToTop: () => void
  render: (
    viewModel: Pick<CharacterCreationViewModel, 'mode' | 'title'>
  ) => boolean
}

export const createCharacterCreationPanel = ({
  elements,
  closeCharacterSheet,
  requestRender
}: CharacterCreationPanelOptions): CharacterCreationPanelController => {
  const isOpen = () => !elements.panel.hidden

  const overlayContext = () => ({
    inCreator: isOpen(),
    inDialog: elements.roomDialog.open
  })

  const overlayHost = () => {
    const context = overlayContext()
    if (context.inCreator) return elements.panel
    if (context.inDialog) return elements.roomDialog
    return elements.fallbackOverlayHost
  }

  const show = () => {
    elements.panel.hidden = false
  }

  const scrollToTop = () => {
    elements.body?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const open = () => {
    show()
    if (elements.roomDialog.open) elements.roomDialog.close()
    closeCharacterSheet()
    requestRender()
  }

  const close = () => {
    elements.panel.hidden = true
    requestRender()
  }

  const resetInactiveWizard = () => {
    elements.wizard.hidden = true
    elements.steps.replaceChildren()
    elements.status.replaceChildren()
    elements.fields.replaceChildren()
    elements.backWizardButton.disabled = true
    elements.nextWizardButton.disabled = true
    elements.backWizardButton.hidden = false
    elements.nextWizardButton.hidden = false
    if (elements.actions) elements.actions.hidden = false
    elements.nextWizardButton.textContent = 'Next'
    elements.nextWizardButton.title = ''
  }

  const render = (
    viewModel: Pick<CharacterCreationViewModel, 'mode' | 'title'>
  ) => {
    const hasFlow = viewModel.mode !== 'empty'
    elements.title.textContent = viewModel.title
    elements.panel.classList.toggle('flow-active', hasFlow)
    elements.startSection.hidden = hasFlow
    if (elements.quickSection) elements.quickSection.hidden = hasFlow
    elements.startWizardButton.textContent = 'Begin character creation'

    if (!hasFlow) resetInactiveWizard()
    return hasFlow
  }

  return {
    isOpen,
    overlayHost,
    overlayContext,
    show,
    open,
    close,
    scrollToTop,
    render
  }
}
