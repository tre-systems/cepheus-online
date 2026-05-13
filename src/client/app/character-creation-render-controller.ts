import type { GameId, UserId } from '../../shared/ids.js'
import {
  applyCharacterCreationBackgroundSkillSelection,
  completeCharacterCreationCareerTerm,
  removeCharacterCreationBackgroundSkillSelection,
  resolveCharacterCreationCascadeSkill,
  resolveCharacterCreationTermCascadeSkill,
  type CharacterCreationFlow
} from './character-creation-flow.js'
import type { RequiredAppElements } from './app-elements.js'
import type { CharacterCreationCommand } from './app-command-router.js'
import type { CharacterCreationCommandController } from './character-creation-command-controller.js'
import { renderCharacterCreationCharacteristicGrid as renderCharacterCreationCharacteristicGridView } from './character-creation-characteristics-view.js'
import {
  renderCharacterCreationAgingChoices as renderCharacterCreationAgingChoicesView,
  renderCharacterCreationAgingRollButton as renderCharacterCreationAgingRollButtonView,
  renderCharacterCreationAnagathicsDecision as renderCharacterCreationAnagathicsDecisionView,
  renderCharacterCreationReenlistmentRollButton as renderCharacterCreationReenlistmentRollButtonView,
  renderCharacterCreationTermSkillTables as renderCharacterCreationTermSkillTablesView
} from './character-creation-career-support-view.js'
import {
  renderCharacterCreationCareerPicker as renderCharacterCreationCareerPickerView,
  renderCharacterCreationCareerRollButton as renderCharacterCreationCareerRollButtonView
} from './character-creation-career-selection-view.js'
import type { CharacterCreationController } from './character-creation-controller.js'
import {
  renderCharacterCreationHomeworld as renderCharacterCreationHomeworldView,
  renderCharacterCreationTermCascadeChoices as renderCharacterCreationTermCascadeChoicesView
} from './character-creation-homeworld-view.js'
import type { CharacterCreationHomeworldPublisher } from './character-creation-homeworld-publisher.js'
import { renderCharacterCreationMusteringOut as renderCharacterCreationMusteringOutView } from './character-creation-mustering-view.js'
import type { CharacterCreationPanelController } from './character-creation-panel.js'
import {
  renderCharacterCreationBasicTrainingButton as renderCharacterCreationBasicTrainingButtonView,
  renderCharacterCreationCharacteristicRollButton as renderCharacterCreationCharacteristicRollButtonView,
  renderCharacterCreationDeath as renderCharacterCreationDeathView,
  renderCharacterCreationDraftFields as renderCharacterCreationDraftFieldsView,
  renderCharacterCreationNextStep as renderCharacterCreationNextStepView,
  type CharacterCreationRendererDocument
} from './character-creation-renderer.js'
import {
  renderCharacterCreationReview as renderCharacterCreationReviewView,
  renderCharacterCreationTermHistory as renderCharacterCreationTermHistoryView
} from './character-creation-review-view.js'
import { renderCharacterCreationTermResolution as renderCharacterCreationTermResolutionView } from './character-creation-term-resolution-view.js'
import { deriveCharacterCreationViewModel } from './character-creation-view-model.js'

export type CharacterCreationRenderControllerElements = Pick<
  RequiredAppElements,
  | 'backCharacterWizard'
  | 'nextCharacterWizard'
  | 'creatorActions'
  | 'characterCreationStatus'
  | 'characterCreationSteps'
  | 'characterCreationFields'
  | 'characterCreationWizard'
>

export interface CharacterCreationRenderController {
  renderWizardControls: () => void
  renderWizard: () => void
}

export interface CharacterCreationRenderControllerDeps {
  document: CharacterCreationRendererDocument
  elements: CharacterCreationRenderControllerElements
  controller: Pick<
    CharacterCreationController,
    | 'currentProjection'
    | 'flow'
    | 'readOnly'
    | 'reconcileEditableWithProjection'
    | 'setFlow'
  >
  panel: Pick<CharacterCreationPanelController, 'render' | 'scrollToTop'>
  wizard: Pick<
    CharacterCreationRenderWizard,
    'advance' | 'autoAdvanceSetup' | 'startNew' | 'syncFields'
  >
  homeworldPublisher: Pick<
    CharacterCreationHomeworldPublisher,
    | 'publishBackgroundCascadeSelection'
    | 'publishProgress'
    | 'publishCascadeResolution'
  >
  getCommandController: () => CharacterCreationCommandController
  ensurePublished: () => Promise<void>
  postCharacterCreationCommand: (
    command: CharacterCreationCommand,
    requestId?: string
  ) => Promise<unknown>
  commandIdentity: () => { gameId: GameId; actorId: UserId }
  reportError: (message: string) => void
}

interface CharacterCreationRenderWizard {
  advance: () => Promise<void>
  autoAdvanceSetup: () => boolean
  startNew: () => Promise<void>
  syncFields: () => void
}

export const createCharacterCreationRenderController = ({
  document,
  elements,
  controller,
  panel,
  wizard,
  homeworldPublisher,
  getCommandController,
  ensurePublished,
  postCharacterCreationCommand,
  commandIdentity,
  reportError
}: CharacterCreationRenderControllerDeps): CharacterCreationRenderController => {
  const renderWizardControls = () => {
    elements.backCharacterWizard.disabled = true
    elements.nextCharacterWizard.disabled = true
    elements.backCharacterWizard.hidden = true
    elements.nextCharacterWizard.hidden = true
    if (elements.creatorActions) elements.creatorActions.hidden = true

    elements.characterCreationStatus.replaceChildren()
  }

  const renderWizard = () => {
    controller.reconcileEditableWithProjection(controller.currentProjection())
    while (wizard.autoAdvanceSetup()) {
      // Keep setup steps linear even when reopening a flow that is already valid.
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: controller.flow(),
      projection: controller.currentProjection(),
      readOnly: controller.readOnly()
    })
    if (!panel.render(viewModel.flow) || !viewModel.flow) return
    const flow = viewModel.flow
    elements.characterCreationSteps.replaceChildren()
    elements.characterCreationFields.replaceChildren(
      renderCharacterCreationNextStep(flow),
      flow.step === 'review'
        ? renderCharacterCreationReview(flow)
        : renderCharacterCreationFields(flow)
    )
    elements.characterCreationWizard.hidden = false
    elements.characterCreationWizard.classList.toggle(
      'read-only',
      viewModel.readOnly
    )
    if (viewModel.controlsDisabled) {
      for (const control of Array.from(
        elements.characterCreationFields.querySelectorAll<
          | HTMLButtonElement
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
        >('button, input, select, textarea')
      )) {
        control.disabled = true
      }
    }
    renderWizardControls()
  }

  const renderCharacterCreationNextStep = (
    flow: CharacterCreationFlow
  ): HTMLElement => {
    return renderCharacterCreationNextStepView(document, flow, {
      advanceStep: wizard.advance,
      reportError,
      resolveBackgroundCascadeSkill: ({ scope, cascadeSkill, selection }) => {
        resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
      }
    })
  }

  const renderCharacterCreationFields = (
    flow: CharacterCreationFlow
  ): DocumentFragment => {
    const fragment = document.createDocumentFragment()
    if (flow.step === 'characteristics') {
      fragment.append(renderCharacterCreationCharacteristicGrid(flow))
      return fragment
    }
    if (flow.step === 'career') {
      const death = renderCharacterCreationDeath(flow)
      if (death) {
        fragment.append(death)
        return fragment
      }
      const careerRollButton = renderCharacterCreationCareerRollButton(flow)
      if (careerRollButton) fragment.append(careerRollButton)
      fragment.append(renderCharacterCreationAnagathicsDecision(flow))
      const agingRollButton = renderCharacterCreationAgingRollButton(flow)
      if (agingRollButton) fragment.append(agingRollButton)
      fragment.append(renderCharacterCreationAgingChoices(flow))
      const reenlistmentRollButton =
        renderCharacterCreationReenlistmentRollButton(flow)
      if (reenlistmentRollButton) fragment.append(reenlistmentRollButton)
      fragment.append(renderCharacterCreationTermSkillTables(flow))
      fragment.append(renderCharacterCreationTermCascadeChoices(flow))
      fragment.append(renderCharacterCreationCareerPicker(flow))
      fragment.append(renderCharacterCreationTermResolution(flow))
      fragment.append(renderCharacterCreationTermHistory(flow))
      return fragment
    }
    if (flow.step === 'homeworld') {
      fragment.append(renderCharacterCreationHomeworld(flow))
      return fragment
    }
    fragment.append(
      renderCharacterCreationDraftFieldsView(document, flow, {
        renderCharacteristicRollButton:
          renderCharacterCreationCharacteristicRollButton,
        renderCareerRollButton: renderCharacterCreationCareerRollButton,
        renderBasicTrainingButton: renderCharacterCreationBasicTrainingButton,
        renderMusteringOut: renderCharacterCreationMusteringOut
      })
    )
    return fragment
  }

  const renderCharacterCreationDeath = (
    flow: CharacterCreationFlow
  ): HTMLElement | null => {
    return renderCharacterCreationDeathView(document, flow, {
      readOnly: controller.readOnly,
      startNewCharacter: wizard.startNew,
      reportError
    })
  }

  const renderCharacterCreationHomeworld = (
    flow: CharacterCreationFlow
  ): HTMLElement => {
    return renderCharacterCreationHomeworldView(document, flow, {
      toggleBackgroundSkill: ({ label, selected, cascade }) => {
        const flow = controller.flow()
        if (!flow) return
        wizard.syncFields()
        const syncedFlow = controller.flow()
        if (!syncedFlow) return
        const nextFlow = {
          ...syncedFlow,
          draft: selected
            ? removeCharacterCreationBackgroundSkillSelection(
                syncedFlow.draft,
                label
              )
            : applyCharacterCreationBackgroundSkillSelection(
                syncedFlow.draft,
                label
              )
        }
        controller.setFlow(nextFlow)
        reportError('')
        renderWizard()
        if (!selected) {
          if (cascade) {
            homeworldPublisher.publishBackgroundCascadeSelection(
              nextFlow,
              label
            )
          } else {
            homeworldPublisher.publishProgress(nextFlow)
          }
        }
      },
      resolveCascadeSkill: ({ scope, cascadeSkill, selection }) => {
        resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
      }
    })
  }

  const renderCharacterCreationTermSkillTables = (
    flow: CharacterCreationFlow
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationTermSkillTablesView(document, flow, {
      rollTermSkill: (table) => getCommandController().rollTermSkill(table),
      reportError
    })
  }

  const renderCharacterCreationReenlistmentRollButton = (
    flow: CharacterCreationFlow
  ): HTMLElement | null => {
    return renderCharacterCreationReenlistmentRollButtonView(document, flow, {
      rollReenlistment: () => getCommandController().rollReenlistment(),
      reportError
    })
  }

  const renderCharacterCreationAgingRollButton = (
    flow: CharacterCreationFlow
  ): HTMLElement | null => {
    return renderCharacterCreationAgingRollButtonView(document, flow, {
      rollAging: () => getCommandController().rollAging(),
      reportError
    })
  }

  const renderCharacterCreationAgingChoices = (
    flow: CharacterCreationFlow
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationAgingChoicesView(document, flow, {
      applyAgingChange: (index, characteristic) =>
        getCommandController().resolveAgingLoss(index, characteristic)
    })
  }

  const renderCharacterCreationAnagathicsDecision = (
    flow: CharacterCreationFlow
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationAnagathicsDecisionView(document, flow, {
      decideAnagathics: (useAnagathics) =>
        getCommandController().decideAnagathics(useAnagathics),
      reportError
    })
  }

  const renderCharacterCreationTermCascadeChoices = (
    flow: CharacterCreationFlow
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationTermCascadeChoicesView(document, flow, {
      resolveCascadeSkill: ({ scope, cascadeSkill, selection }) => {
        resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
      }
    })
  }

  const resolveCharacterCreationCascadeChoice = (
    scope: 'background' | 'term',
    cascadeSkill: string,
    selection: string
  ) => {
    const flow = controller.flow()
    if (!flow) return
    wizard.syncFields()
    const syncedFlow = controller.flow()
    if (!syncedFlow) return
    const nextFlow =
      scope === 'term'
        ? resolveCharacterCreationTermCascadeSkill({
            flow: syncedFlow,
            cascadeSkill,
            selection
          }).flow
        : {
            ...syncedFlow,
            draft: resolveCharacterCreationCascadeSkill({
              draft: syncedFlow.draft,
              cascadeSkill,
              selection
            })
          }
    controller.setFlow(nextFlow)
    reportError('')
    renderWizard()
    if (scope === 'term') {
      getCommandController()
        .publishTermCascadeResolution(
          nextFlow,
          cascadeSkill,
          selection,
          nextFlow
        )
        .catch((error) => reportError(error.message))
    } else {
      homeworldPublisher.publishCascadeResolution(
        nextFlow,
        cascadeSkill,
        selection
      )
    }
  }

  const renderCharacterCreationCharacteristicGrid = (
    flow: CharacterCreationFlow
  ): HTMLElement => {
    return renderCharacterCreationCharacteristicGridView(document, flow, {
      rollCharacteristic: (characteristicKey) =>
        getCommandController().rollCharacteristic(characteristicKey),
      reportError
    })
  }

  const renderCharacterCreationCareerPicker = (
    flow: CharacterCreationFlow
  ): HTMLElement => {
    return renderCharacterCreationCareerPickerView(document, flow, {
      resolveCareerQualification: (career) =>
        getCommandController().resolveCareerQualification(career),
      resolveFailedQualificationOption: (option) =>
        getCommandController().resolveFailedQualificationOption(option),
      reportError
    })
  }

  const renderCharacterCreationTermResolution = (
    flow: CharacterCreationFlow
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationTermResolutionView(document, flow, {
      completeTerm: async (continueCareer) => {
        const flow = controller.flow()
        if (!flow) return
        const result = completeCharacterCreationCareerTerm({
          flow,
          continueCareer
        })
        if (!result.moved) return

        await ensurePublished()
        await postCharacterCreationCommand({
          type: continueCareer
            ? 'ReenlistCharacterCreationCareer'
            : 'LeaveCharacterCreationCareer',
          ...commandIdentity(),
          characterId: flow.draft.characterId
        })
        controller.setFlow(result.flow)
        reportError('')
        renderWizard()
        panel.scrollToTop()
      }
    })
  }

  const renderCharacterCreationTermHistory = (
    flow: CharacterCreationFlow
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationTermHistoryView(document, flow)
  }

  const renderCharacterCreationCharacteristicRollButton = (
    flow: CharacterCreationFlow
  ): HTMLElement | null => {
    return renderCharacterCreationCharacteristicRollButtonView(document, flow, {
      rollCharacteristic: () => getCommandController().rollCharacteristic(),
      reportError
    })
  }

  const renderCharacterCreationCareerRollButton = (
    flow: CharacterCreationFlow
  ): HTMLElement | null => {
    return renderCharacterCreationCareerRollButtonView(document, flow, {
      rollCareerCheck: () => getCommandController().rollCareerCheck(),
      reportError
    })
  }

  const renderCharacterCreationBasicTrainingButton = (
    flow: CharacterCreationFlow
  ): HTMLElement | null => {
    return renderCharacterCreationBasicTrainingButtonView(document, flow, {
      hasFlow: () => Boolean(controller.flow()),
      syncFields: wizard.syncFields,
      completeBasicTraining: () =>
        getCommandController().completeBasicTraining(),
      reportError
    })
  }

  const renderCharacterCreationMusteringOut = (
    flow: CharacterCreationFlow
  ): HTMLElement => {
    return renderCharacterCreationMusteringOutView(document, flow, {
      rollMusteringBenefit: (kind) =>
        getCommandController().rollMusteringBenefit(kind),
      reportError
    })
  }

  const renderCharacterCreationReview = (
    flow: CharacterCreationFlow
  ): HTMLElement => {
    return renderCharacterCreationReviewView(document, flow)
  }

  return {
    renderWizardControls,
    renderWizard
  }
}
