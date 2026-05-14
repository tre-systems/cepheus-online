import type { PieceId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import {
  applyParsedCharacterCreationDraftPatch,
  backCharacterCreationWizardStep,
  createManualCharacterCreationFlow,
  nextCharacterCreationWizardStep,
  type CharacterCreationDraft
} from './flow.js'
import type { CharacterCreationHomeworldPublisher } from './homeworld-publisher.js'
import type { CharacterCreationPanelController } from './panel.js'
import { creationStepFromStatus } from './projection.js'
import { characterCreationStepIndex } from './sync.js'
import type { CharacterCreationController } from './controller.js'
import {
  deriveCharacterCreationValidationSummary,
  parseCharacterCreationDraftPatch
} from './view.js'

export interface CharacterCreationWizardController {
  start: () => void
  startNew: () => Promise<void>
  autoAdvanceSetup: () => boolean
  syncFields: () => void
  advance: () => Promise<void>
  back: () => void
}

export interface CharacterCreationWizardControllerDeps {
  controller: CharacterCreationController
  fieldsRoot: HTMLElement
  panel: Pick<
    CharacterCreationPanelController,
    'isOpen' | 'show' | 'open' | 'scrollToTop'
  >
  getState: () => GameState | null
  getSeed: () => Pick<
    CharacterCreationDraft,
    'name' | 'credits' | 'equipment' | 'notes'
  >
  currentProjection: () => CharacterCreationProjection | null
  homeworldPublisher: Pick<
    CharacterCreationHomeworldPublisher,
    'publishProgress'
  >
  selectPiece: (pieceId: PieceId | null) => void
  closeCharacterSheet: () => void
  ensurePublished: () => Promise<void>
  finish: () => Promise<void>
  renderWizard: () => void
  setError: (message: string) => void
}

export const createCharacterCreationWizardController = ({
  controller,
  fieldsRoot,
  panel,
  getState,
  getSeed,
  currentProjection,
  homeworldPublisher,
  selectPiece,
  closeCharacterSheet,
  ensurePublished,
  finish,
  renderWizard,
  setError
}: CharacterCreationWizardControllerDeps): CharacterCreationWizardController => {
  const start = () => {
    controller.setReadOnly(false)
    if (!panel.isOpen()) panel.show()
    if (controller.flow()) {
      renderWizard()
      panel.scrollToTop()
      return
    }

    const seed = getSeed()
    const flow = createManualCharacterCreationFlow({
      state: getState(),
      name: seed.name || null,
      characterType: 'PLAYER'
    })
    controller.setFlow({
      ...flow,
      draft: {
        ...flow.draft,
        name: seed.name || flow.draft.name,
        credits: seed.credits,
        equipment: seed.equipment,
        notes: seed.notes
      }
    })

    const nextFlow = controller.flow()
    if (nextFlow) {
      controller.setFlow(nextCharacterCreationWizardStep(nextFlow).flow)
    }
    renderWizard()
    panel.scrollToTop()
  }

  const startNew = async () => {
    controller.resetForNewCreation()
    selectPiece(null)
    closeCharacterSheet()
    panel.open()
    start()
    await ensurePublished()
  }

  const autoAdvanceSetup = () => {
    const flow = controller.flow()
    if (controller.readOnly()) return false
    if (!flow) return false
    if (!['basics', 'characteristics', 'homeworld'].includes(flow.step)) {
      return false
    }
    if (
      flow.step === 'homeworld' &&
      characterCreationStepIndex(
        creationStepFromStatus(currentProjection()?.state.status ?? 'HOMEWORLD')
      ) <= characterCreationStepIndex('homeworld')
    ) {
      const validation = deriveCharacterCreationValidationSummary(flow)
      if (validation.ok) {
        homeworldPublisher.publishProgress(flow)
      }
      return false
    }

    const result = nextCharacterCreationWizardStep(flow)
    if (!result.moved) return false
    controller.setFlow(result.flow)
    return true
  }

  const syncFields = () => {
    const flow = controller.flow()
    if (!flow) return

    const values: Record<string, string> = {}
    for (const field of Array.from(
      fieldsRoot.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('[data-character-creation-field]')
    )) {
      const key = field.dataset.characterCreationField
      if (key) values[key] = field.value
    }
    controller.setFlow(
      applyParsedCharacterCreationDraftPatch(
        flow,
        parseCharacterCreationDraftPatch(values)
      ).flow
    )
  }

  const advance = async () => {
    const flow = controller.flow()
    if (!flow) {
      start()
      return
    }

    syncFields()
    const syncedFlow = controller.flow()
    if (!syncedFlow) return
    if (syncedFlow.step === 'review') {
      await finish()
      return
    }

    const result = nextCharacterCreationWizardStep(syncedFlow)
    if (!result.moved) {
      setError(result.validation.errors.join(', '))
      renderWizard()
      return
    }

    setError('')
    controller.setFlow(result.flow)
    renderWizard()
    panel.scrollToTop()
  }

  const back = () => {
    const flow = controller.flow()
    if (!flow) return
    syncFields()
    const syncedFlow = controller.flow()
    if (!syncedFlow) return
    controller.setFlow(backCharacterCreationWizardStep(syncedFlow).flow)
    setError('')
    renderWizard()
    panel.scrollToTop()
  }

  return {
    start,
    startNew,
    autoAdvanceSetup,
    syncFields,
    advance,
    back
  }
}
