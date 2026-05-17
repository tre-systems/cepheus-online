import type { RequiredAppElements } from '../../core/elements'
import type { CharacterCreationController } from './controller'
import type { CharacterCreationFlow } from './flow'
import type { CharacterCreationHomeworldPublisher } from './homeworld-publisher'
import type { CharacterCreationPanelController } from './panel'
import type { CharacterCreationWizardController } from './wizard'

export type CharacterCreationDomControllerElements = Pick<
  RequiredAppElements,
  | 'createCharacterRail'
  | 'characterCreatorClose'
  | 'startCharacterWizard'
  | 'backCharacterWizard'
  | 'nextCharacterWizard'
  | 'characterCreationFields'
>

export interface CharacterCreationDomController {
  dispose: () => void
}

export interface CharacterCreationDomControllerDeps {
  elements: CharacterCreationDomControllerElements
  controller: Pick<CharacterCreationController, 'flow' | 'clearReadOnlyFollow'>
  wizard: Pick<
    CharacterCreationWizardController,
    'startNew' | 'back' | 'advance' | 'syncFields' | 'autoAdvanceSetup'
  >
  panel: Pick<CharacterCreationPanelController, 'close'>
  homeworldPublisher: Pick<
    CharacterCreationHomeworldPublisher,
    'publishProgress'
  >
  renderWizardControls: () => void
  renderWizard: () => void
  renderApp: () => void
  reportError: (message: string) => void
}

const reportAsyncError =
  (reportError: (message: string) => void) =>
  (error: Error): void => {
    reportError(error.message)
  }

const isHomeworldFlow = (
  flow: CharacterCreationFlow | null
): flow is CharacterCreationFlow & { step: 'homeworld' } =>
  flow?.step === 'homeworld'

export const createCharacterCreationDomController = ({
  elements,
  controller,
  wizard,
  panel,
  homeworldPublisher,
  renderWizardControls,
  renderWizard,
  renderApp,
  reportError
}: CharacterCreationDomControllerDeps): CharacterCreationDomController => {
  const handleAsyncError = reportAsyncError(reportError)

  const startNew = (): void => {
    wizard.startNew().catch(handleAsyncError)
  }

  const closePanel = (): void => {
    panel.close()
    controller.clearReadOnlyFollow()
    renderApp()
  }

  const back = (): void => {
    wizard.back()
  }

  const syncInput = (): void => {
    wizard.syncFields()
    renderWizardControls()
  }

  const syncChange = (): void => {
    wizard.syncFields()
    const flow = controller.flow()
    if (isHomeworldFlow(flow)) {
      homeworldPublisher.publishProgress(flow)
    }
    wizard.autoAdvanceSetup()
    renderWizard()
  }

  const advance = (): void => {
    wizard.advance().catch(handleAsyncError)
  }

  elements.createCharacterRail.addEventListener('click', startNew)
  elements.characterCreatorClose.addEventListener('click', closePanel)
  elements.startCharacterWizard.addEventListener('click', startNew)
  elements.backCharacterWizard.addEventListener('click', back)
  elements.characterCreationFields.addEventListener('input', syncInput)
  elements.characterCreationFields.addEventListener('change', syncChange)
  elements.nextCharacterWizard.addEventListener('click', advance)

  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    elements.createCharacterRail.removeEventListener('click', startNew)
    elements.characterCreatorClose.removeEventListener('click', closePanel)
    elements.startCharacterWizard.removeEventListener('click', startNew)
    elements.backCharacterWizard.removeEventListener('click', back)
    elements.characterCreationFields.removeEventListener('input', syncInput)
    elements.characterCreationFields.removeEventListener('change', syncChange)
    elements.nextCharacterWizard.removeEventListener('click', advance)
  }

  return { dispose }
}
