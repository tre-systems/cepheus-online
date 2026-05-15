import type { GameId, UserId } from '../../../../shared/ids.js'
import {
  applyCharacterCreationBackgroundSkillSelection,
  removeCharacterCreationBackgroundSkillSelection,
  resolveCharacterCreationCascadeSkill,
  resolveCharacterCreationTermCascadeSkill,
  type CharacterCreationFlow
} from './flow.js'
import type { RequiredAppElements } from '../../core/elements.js'
import type { CharacterCreationCommand } from '../../core/command-router.js'
import type { CharacterCreationCommandController } from './command-controller.js'
import { renderCharacterCreationCharacteristicGrid as renderCharacterCreationCharacteristicGridView } from './views/characteristics.js'
import {
  renderCharacterCreationAgingChoices as renderCharacterCreationAgingChoicesView,
  renderCharacterCreationAgingRollButton as renderCharacterCreationAgingRollButtonView,
  renderCharacterCreationAnagathicsDecision as renderCharacterCreationAnagathicsDecisionView,
  renderCharacterCreationReenlistmentRollButton as renderCharacterCreationReenlistmentRollButtonView,
  renderCharacterCreationTermSkillTables as renderCharacterCreationTermSkillTablesView
} from './views/career-support.js'
import {
  renderCharacterCreationCareerPicker as renderCharacterCreationCareerPickerView,
  renderCharacterCreationCareerRollButton as renderCharacterCreationCareerRollButtonView
} from './views/career-selection.js'
import type { CharacterCreationController } from './controller.js'
import {
  renderCharacterCreationHomeworld as renderCharacterCreationHomeworldView,
  renderCharacterCreationTermCascadeChoices as renderCharacterCreationTermCascadeChoicesView
} from './views/homeworld.js'
import type { CharacterCreationHomeworldPublisher } from './homeworld-publisher.js'
import { renderCharacterCreationMusteringOut as renderCharacterCreationMusteringOutView } from './views/mustering.js'
import { renderCharacterCreationMishapResolution as renderCharacterCreationMishapResolutionView } from './views/mishap-resolution.js'
import { renderCharacterCreationInjuryResolution as renderCharacterCreationInjuryResolutionView } from './views/injury-resolution.js'
import type { CharacterCreationPanelController } from './panel.js'
import type {
  CharacterCreationAgingChoicesViewModel,
  CharacterCreationAgingRollViewModel,
  CharacterCreationAnagathicsDecisionViewModel,
  CharacterCreationBasicTrainingButton,
  CharacterCreationCareerRollButton,
  CharacterCreationCareerSelectionViewModel,
  CharacterCreationCharacteristicGridViewModel,
  CharacterCreationHomeworldViewModel,
  CharacterCreationInjuryResolutionViewModel,
  CharacterCreationMusteringOutViewModel,
  CharacterCreationMishapResolutionViewModel,
  CharacterCreationReenlistmentRollViewModel,
  CharacterCreationReviewSummary,
  CharacterCreationTermCascadeChoicesViewModel,
  CharacterCreationTermHistoryViewModel,
  CharacterCreationTermResolutionViewModel,
  CharacterCreationTermSkillTrainingViewModel
} from './view.js'
import type { CharacterCreationViewModel } from './model.js'
import {
  renderCharacterCreationBasicTrainingButton as renderCharacterCreationBasicTrainingButtonView,
  renderCharacterCreationCharacteristicRollButton as renderCharacterCreationCharacteristicRollButtonView,
  renderCharacterCreationDeath as renderCharacterCreationDeathView,
  renderCharacterCreationDraftFields as renderCharacterCreationDraftFieldsView,
  renderCharacterCreationNextStep as renderCharacterCreationNextStepView,
  type CharacterCreationRendererDocument
} from './renderer.js'
import {
  renderCharacterCreationReview as renderCharacterCreationReviewView,
  renderCharacterCreationTermHistory as renderCharacterCreationTermHistoryView
} from './views/review.js'
import { renderCharacterCreationTermResolution as renderCharacterCreationTermResolutionView } from './views/term-resolution.js'

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
    | 'viewModel'
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

    const viewModel = controller.viewModel()
    if (!panel.render(viewModel) || !viewModel.flow) return
    if (!viewModel.wizard) return
    const flow = viewModel.flow
    elements.characterCreationSteps.replaceChildren()
    elements.characterCreationFields.replaceChildren(
      renderCharacterCreationNextStep(viewModel.wizard.nextStep),
      flow.step === 'review' && viewModel.wizard.review
        ? renderCharacterCreationReview(viewModel.wizard.review)
        : renderCharacterCreationFields(viewModel)
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
    viewModel: NonNullable<
      ReturnType<CharacterCreationController['viewModel']>['wizard']
    >['nextStep']
  ): HTMLElement => {
    return renderCharacterCreationNextStepView(document, viewModel, {
      advanceStep: wizard.advance,
      reportError,
      resolveBackgroundCascadeSkill: ({ scope, cascadeSkill, selection }) => {
        resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
      }
    })
  }

  const renderCharacterCreationFields = (
    viewModel: CharacterCreationViewModel
  ): DocumentFragment => {
    const fragment = document.createDocumentFragment()
    const flow = viewModel.flow
    if (!flow) return fragment
    if (flow.step === 'characteristics') {
      if (viewModel.wizard?.characteristics) {
        fragment.append(
          renderCharacterCreationCharacteristicGrid(
            viewModel.wizard.characteristics
          )
        )
      }
      return fragment
    }
    if (flow.step === 'career') {
      if (viewModel.wizard?.death) {
        fragment.append(renderCharacterCreationDeath(viewModel.wizard.death))
        return fragment
      }
      const careerRollButton = viewModel.wizard?.careerRoll
        ? renderCharacterCreationCareerRollButton(viewModel.wizard.careerRoll)
        : null
      if (careerRollButton) fragment.append(careerRollButton)
      if (viewModel.wizard?.anagathicsDecision) {
        fragment.append(
          renderCharacterCreationAnagathicsDecision(
            viewModel.wizard.anagathicsDecision
          )
        )
      }
      if (viewModel.wizard?.mishapResolution) {
        fragment.append(
          renderCharacterCreationMishapResolution(
            viewModel.wizard.mishapResolution
          )
        )
      }
      if (viewModel.wizard?.injuryResolution) {
        fragment.append(
          renderCharacterCreationInjuryResolution(
            viewModel.wizard.injuryResolution
          )
        )
      }
      if (viewModel.wizard?.agingRoll) {
        fragment.append(
          renderCharacterCreationAgingRollButton(viewModel.wizard.agingRoll)
        )
      }
      if (viewModel.wizard?.agingChoices) {
        fragment.append(
          renderCharacterCreationAgingChoices(viewModel.wizard.agingChoices)
        )
      }
      if (viewModel.wizard?.reenlistmentRoll) {
        fragment.append(
          renderCharacterCreationReenlistmentRollButton(
            viewModel.wizard.reenlistmentRoll
          )
        )
      }
      if (viewModel.wizard?.termSkills) {
        fragment.append(
          renderCharacterCreationTermSkillTables(viewModel.wizard.termSkills)
        )
      }
      if (viewModel.wizard?.termCascadeChoices) {
        fragment.append(
          renderCharacterCreationTermCascadeChoices(
            viewModel.wizard.termCascadeChoices
          )
        )
      }
      if (viewModel.wizard?.careerSelection) {
        fragment.append(
          renderCharacterCreationCareerPicker(viewModel.wizard.careerSelection)
        )
      }
      if (viewModel.wizard?.termResolution) {
        fragment.append(
          renderCharacterCreationTermResolution(viewModel.wizard.termResolution)
        )
      }
      if (viewModel.wizard?.termHistory) {
        fragment.append(
          renderCharacterCreationTermHistory(viewModel.wizard.termHistory)
        )
      }
      return fragment
    }
    if (flow.step === 'homeworld') {
      if (viewModel.wizard?.homeworld) {
        fragment.append(
          renderCharacterCreationHomeworld(viewModel.wizard.homeworld)
        )
      }
      return fragment
    }
    fragment.append(
      renderCharacterCreationDraftFieldsView(document, flow, {
        renderCharacteristicRollButton:
          renderCharacterCreationCharacteristicRollButton,
        renderCareerRollButton: () =>
          viewModel.wizard?.careerRoll
            ? renderCharacterCreationCareerRollButton(
                viewModel.wizard.careerRoll
              )
            : null,
        renderBasicTrainingButton: () =>
          viewModel.wizard?.basicTraining
            ? renderCharacterCreationBasicTrainingButton(
                viewModel.wizard.basicTraining
              )
            : null,
        musteringOut: viewModel.wizard?.musteringOut ?? null,
        renderMusteringOut: renderCharacterCreationMusteringOut
      })
    )
    return fragment
  }

  const renderCharacterCreationDeath = (
    viewModel: NonNullable<
      NonNullable<CharacterCreationViewModel['wizard']>['death']
    >
  ): HTMLElement => {
    return renderCharacterCreationDeathView(document, viewModel, {
      readOnly: controller.readOnly,
      startNewCharacter: wizard.startNew,
      reportError
    })
  }

  const renderCharacterCreationHomeworld = (
    viewModel: CharacterCreationHomeworldViewModel
  ): HTMLElement => {
    return renderCharacterCreationHomeworldView(document, viewModel, {
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
    viewModel: CharacterCreationTermSkillTrainingViewModel
  ): HTMLElement | DocumentFragment => {
    return renderCharacterCreationTermSkillTablesView(document, viewModel, {
      rollTermSkill: (table) => getCommandController().rollTermSkill(table),
      reportError
    })
  }

  const renderCharacterCreationReenlistmentRollButton = (
    viewModel: CharacterCreationReenlistmentRollViewModel
  ): HTMLElement => {
    return renderCharacterCreationReenlistmentRollButtonView(
      document,
      viewModel,
      {
        rollReenlistment: () => getCommandController().rollReenlistment(),
        reportError
      }
    )
  }

  const renderCharacterCreationAgingRollButton = (
    viewModel: CharacterCreationAgingRollViewModel
  ): HTMLElement => {
    return renderCharacterCreationAgingRollButtonView(document, viewModel, {
      rollAging: () => getCommandController().rollAging(),
      reportError
    })
  }

  const renderCharacterCreationAgingChoices = (
    viewModel: CharacterCreationAgingChoicesViewModel
  ): HTMLElement => {
    return renderCharacterCreationAgingChoicesView(document, viewModel, {
      applyAgingChange: (index, characteristic) =>
        getCommandController().resolveAgingLoss(index, characteristic)
    })
  }

  const renderCharacterCreationAnagathicsDecision = (
    viewModel: CharacterCreationAnagathicsDecisionViewModel
  ): HTMLElement => {
    return renderCharacterCreationAnagathicsDecisionView(document, viewModel, {
      decideAnagathics: (useAnagathics) =>
        getCommandController().decideAnagathics(useAnagathics),
      reportError
    })
  }

  const renderCharacterCreationTermCascadeChoices = (
    viewModel: CharacterCreationTermCascadeChoicesViewModel
  ): HTMLElement => {
    return renderCharacterCreationTermCascadeChoicesView(document, viewModel, {
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
    viewModel: CharacterCreationCharacteristicGridViewModel
  ): HTMLElement => {
    return renderCharacterCreationCharacteristicGridView(document, viewModel, {
      rollCharacteristic: (characteristicKey) =>
        getCommandController().rollCharacteristic(characteristicKey),
      reportError
    })
  }

  const renderCharacterCreationCareerPicker = (
    viewModel: CharacterCreationCareerSelectionViewModel
  ): HTMLElement => {
    return renderCharacterCreationCareerPickerView(document, viewModel, {
      resolveCareerQualification: (career) =>
        getCommandController().resolveCareerQualification(career),
      resolveFailedQualificationOption: (option) =>
        getCommandController().resolveFailedQualificationOption(option),
      reportError
    })
  }

  const renderCharacterCreationTermResolution = (
    viewModel: CharacterCreationTermResolutionViewModel
  ): HTMLElement => {
    return renderCharacterCreationTermResolutionView(document, viewModel, {
      completeTerm: async (continueCareer) => {
        await getCommandController().completeTerm(continueCareer)
      }
    })
  }

  const renderCharacterCreationMishapResolution = (
    viewModel: CharacterCreationMishapResolutionViewModel
  ): HTMLElement =>
    renderCharacterCreationMishapResolutionView(document, viewModel, {
      resolveMishap: () => getCommandController().resolveMishap()
    })

  const renderCharacterCreationInjuryResolution = (
    viewModel: CharacterCreationInjuryResolutionViewModel
  ): HTMLElement =>
    renderCharacterCreationInjuryResolutionView(document, viewModel, {
      readOnly: controller.readOnly(),
      resolveInjury: (primaryCharacteristic, method) =>
        getCommandController().resolveInjury(
          primaryCharacteristic,
          {
            mode: 'both_other_physical'
          },
          method
        )
    })

  const renderCharacterCreationTermHistory = (
    viewModel: CharacterCreationTermHistoryViewModel
  ): HTMLElement => {
    return renderCharacterCreationTermHistoryView(document, viewModel)
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
    viewModel: CharacterCreationCareerRollButton
  ): HTMLElement | null => {
    return renderCharacterCreationCareerRollButtonView(document, viewModel, {
      rollCareerCheck: () => getCommandController().rollCareerCheck(),
      reportError
    })
  }

  const renderCharacterCreationBasicTrainingButton = (
    viewModel: CharacterCreationBasicTrainingButton
  ): HTMLElement | null => {
    return renderCharacterCreationBasicTrainingButtonView(document, viewModel, {
      hasFlow: () => Boolean(controller.flow()),
      syncFields: wizard.syncFields,
      completeBasicTraining: (skill) =>
        getCommandController().completeBasicTraining(skill),
      reportError
    })
  }

  const renderCharacterCreationMusteringOut = (
    viewModel: CharacterCreationMusteringOutViewModel
  ): HTMLElement => {
    return renderCharacterCreationMusteringOutView(document, viewModel, {
      rollMusteringBenefit: (career, kind) =>
        getCommandController().rollMusteringBenefit(kind, career),
      reportError
    })
  }

  const renderCharacterCreationReview = (
    viewModel: CharacterCreationReviewSummary
  ): HTMLElement => {
    return renderCharacterCreationReviewView(document, viewModel)
  }

  return {
    renderWizardControls,
    renderWizard
  }
}
