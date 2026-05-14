import type { CharacterId } from '../../../../shared/ids'
import {
  deriveCharacterCreationProjectionReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type { CharacterCreationProjection } from '../../../../shared/state'
import type { CharacterCreationActionPlan } from './actions.js'
import type { CharacterCreationFlow, CharacterCreationStep } from './flow.js'
import {
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationCharacteristicGridViewModel,
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationMusteringOutViewModel,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReenlistmentRollViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationTermCascadeChoicesViewModel,
  deriveCharacterCreationTermHistoryViewModel,
  deriveCharacterCreationTermResolutionViewModel,
  deriveCharacterCreationTermSkillTrainingViewModel,
  deriveCharacterCreationValidationSummary,
  type CharacterCreationAgingChoicesViewModel,
  type CharacterCreationAgingRollViewModel,
  type CharacterCreationAnagathicsDecisionViewModel,
  type CharacterCreationButtonStates,
  type CharacterCreationCareerRollButton,
  type CharacterCreationCareerSelectionViewModel,
  type CharacterCreationCharacteristicGridViewModel,
  type CharacterCreationDeathViewModel,
  type CharacterCreationHomeworldViewModel,
  type CharacterCreationMusteringOutViewModel,
  type CharacterCreationNextStepViewModel,
  type CharacterCreationReenlistmentRollViewModel,
  type CharacterCreationReviewSummary,
  type CharacterCreationStepProgressItem,
  type CharacterCreationTermCascadeChoicesViewModel,
  type CharacterCreationTermHistoryViewModel,
  type CharacterCreationTermResolutionViewModel,
  type CharacterCreationTermSkillTrainingViewModel,
  type CharacterCreationValidationSummary
} from './view.js'

export type CharacterCreationViewModelMode = 'empty' | 'editable' | 'read-only'

export interface CharacterCreationProjectionViewModel {
  present: boolean
  status: CharacterCreationProjection['state']['status'] | null
  step: CharacterCreationStep | null
  creationComplete: boolean
  completedTermCount: number
  historyCount: number
}

export interface CharacterCreationPendingViewModel {
  backgroundCascadeSkills: string[]
  termCascadeSkills: string[]
  projectionCascadeSkills: string[]
  agingChangeCount: number
  hasCascadeChoices: boolean
  hasAgingChoices: boolean
  hasPendingResolution: boolean
  summary: string
}

export interface CharacterCreationWizardViewModel {
  step: CharacterCreationStep
  projectedStep: CharacterCreationStep | null
  projectedStepCurrent: boolean
  controlsDisabled: boolean
  progress: CharacterCreationStepProgressItem[]
  buttons: CharacterCreationButtonStates
  validation: CharacterCreationValidationSummary
  nextStep: CharacterCreationNextStepViewModel
  careerSelection: CharacterCreationCareerSelectionViewModel | null
  careerRoll: CharacterCreationCareerRollButton | null
  reenlistmentRoll: CharacterCreationReenlistmentRollViewModel | null
  agingRoll: CharacterCreationAgingRollViewModel | null
  agingChoices: CharacterCreationAgingChoicesViewModel | null
  anagathicsDecision: CharacterCreationAnagathicsDecisionViewModel | null
  termCascadeChoices: CharacterCreationTermCascadeChoicesViewModel | null
  termResolution: CharacterCreationTermResolutionViewModel | null
  termSkills: CharacterCreationTermSkillTrainingViewModel | null
  musteringOut: CharacterCreationMusteringOutViewModel | null
  death: CharacterCreationDeathViewModel | null
  termHistory: CharacterCreationTermHistoryViewModel | null
  review: CharacterCreationReviewSummary | null
  characteristics: CharacterCreationCharacteristicGridViewModel | null
  homeworld: CharacterCreationHomeworldViewModel | null
}

export interface CharacterCreationViewModel {
  mode: CharacterCreationViewModelMode
  title: string
  characterId: CharacterId | null
  flow: CharacterCreationFlow | null
  readOnly: boolean
  controlsDisabled: boolean
  projection: CharacterCreationProjectionViewModel
  projectionReadModel: CharacterCreationProjectionReadModel | null
  pending: CharacterCreationPendingViewModel
  wizard: CharacterCreationWizardViewModel | null
  actionPlan: CharacterCreationActionPlan | null
}

export interface DeriveCharacterCreationViewModelOptions {
  flow: CharacterCreationFlow | null
  projection: CharacterCreationProjection | null
  readOnly: boolean
  actionPlan?: CharacterCreationActionPlan | null
}

const projectionViewModel = (
  projection: CharacterCreationProjection | null
): {
  summary: CharacterCreationProjectionViewModel
  readModel: CharacterCreationProjectionReadModel | null
} => {
  if (!projection) {
    return {
      summary: {
        present: false,
        status: null,
        step: null,
        creationComplete: false,
        completedTermCount: 0,
        historyCount: 0
      },
      readModel: null
    }
  }

  const readModel = deriveCharacterCreationProjectionReadModel(projection)

  return {
    summary: {
      present: true,
      status: readModel.status,
      step: readModel.step,
      creationComplete: readModel.creationComplete,
      completedTermCount: readModel.completedTermCount,
      historyCount: readModel.historyCount
    },
    readModel
  }
}

const pendingSummary = ({
  backgroundCascadeSkills,
  termCascadeSkills,
  projectionCascadeSkills,
  agingChangeCount
}: Pick<
  CharacterCreationPendingViewModel,
  | 'backgroundCascadeSkills'
  | 'termCascadeSkills'
  | 'projectionCascadeSkills'
  | 'agingChangeCount'
>): string => {
  if (backgroundCascadeSkills.length > 0) {
    return `${backgroundCascadeSkills.length} background cascade ${
      backgroundCascadeSkills.length === 1 ? 'choice' : 'choices'
    } pending`
  }
  if (termCascadeSkills.length > 0) {
    return `${termCascadeSkills.length} term cascade ${
      termCascadeSkills.length === 1 ? 'choice' : 'choices'
    } pending`
  }
  if (agingChangeCount > 0) {
    return `${agingChangeCount} aging ${
      agingChangeCount === 1 ? 'change' : 'changes'
    } pending`
  }
  if (projectionCascadeSkills.length > 0) {
    return `${projectionCascadeSkills.length} projected cascade ${
      projectionCascadeSkills.length === 1 ? 'choice' : 'choices'
    } pending`
  }
  return 'No pending character creation choices'
}

const pendingViewModel = (
  flow: CharacterCreationFlow | null,
  projection: CharacterCreationProjection | null
): CharacterCreationPendingViewModel => {
  const backgroundCascadeSkills = [...(flow?.draft.pendingCascadeSkills ?? [])]
  const termCascadeSkills = [...(flow?.draft.pendingTermCascadeSkills ?? [])]
  const projectionCascadeSkills = [...(projection?.pendingCascadeSkills ?? [])]
  const agingChangeCount = flow?.draft.pendingAgingChanges.length ?? 0
  const hasCascadeChoices =
    backgroundCascadeSkills.length > 0 ||
    termCascadeSkills.length > 0 ||
    projectionCascadeSkills.length > 0
  const hasAgingChoices = agingChangeCount > 0

  return {
    backgroundCascadeSkills,
    termCascadeSkills,
    projectionCascadeSkills,
    agingChangeCount,
    hasCascadeChoices,
    hasAgingChoices,
    hasPendingResolution: hasCascadeChoices || hasAgingChoices,
    summary: pendingSummary({
      backgroundCascadeSkills,
      termCascadeSkills,
      projectionCascadeSkills,
      agingChangeCount
    })
  }
}

const wizardViewModel = ({
  flow,
  projection,
  readOnly
}: {
  flow: CharacterCreationFlow | null
  projection: CharacterCreationProjectionViewModel
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (!flow) return null

  return {
    step: flow.step,
    projectedStep: projection.step,
    projectedStepCurrent: projection.step === flow.step,
    controlsDisabled: readOnly,
    progress: deriveCharacterCreationStepProgressItems(flow),
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow),
    careerSelection: deriveCharacterCreationCareerSelectionViewModel(flow),
    careerRoll: deriveCharacterCreationCareerRollButton(flow),
    reenlistmentRoll: deriveCharacterCreationReenlistmentRollViewModel(flow),
    agingRoll: deriveCharacterCreationAgingRollViewModel(flow),
    agingChoices: deriveCharacterCreationAgingChoicesViewModel(flow),
    anagathicsDecision:
      deriveCharacterCreationAnagathicsDecisionViewModel(flow),
    termCascadeChoices:
      deriveCharacterCreationTermCascadeChoicesViewModel(flow),
    termResolution: deriveCharacterCreationTermResolutionViewModel(flow),
    termSkills: deriveCharacterCreationTermSkillTrainingViewModel(flow),
    musteringOut:
      flow.step === 'equipment'
        ? deriveCharacterCreationMusteringOutViewModel(flow)
        : null,
    death: deriveCharacterCreationDeathViewModel(flow),
    termHistory: deriveCharacterCreationTermHistoryViewModel(flow),
    review:
      flow.step === 'review'
        ? deriveCharacterCreationReviewSummary(flow)
        : null,
    characteristics: deriveCharacterCreationCharacteristicGridViewModel(flow),
    homeworld:
      flow.step === 'homeworld'
        ? deriveCharacterCreationHomeworldViewModel(flow)
        : null
  }
}

export const deriveCharacterCreationViewModel = ({
  flow,
  projection,
  readOnly,
  actionPlan = null
}: DeriveCharacterCreationViewModelOptions): CharacterCreationViewModel => {
  const projected = projectionViewModel(projection)
  const wizard = wizardViewModel({
    flow,
    projection: projected.summary,
    readOnly
  })

  return {
    mode: !flow ? 'empty' : readOnly ? 'read-only' : 'editable',
    title: flow?.draft.name.trim() || 'Create traveller',
    characterId: flow?.draft.characterId ?? null,
    flow,
    readOnly,
    controlsDisabled: readOnly,
    projection: projected.summary,
    projectionReadModel: projected.readModel,
    pending: pendingViewModel(flow, projection),
    wizard,
    actionPlan
  }
}
