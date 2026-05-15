import type { CharacterId } from '../../../../shared/ids'
import {
  deriveCharacterCreationReadModel,
  deriveCharacterCreationProjectionReadModel,
  type CharacterCreationReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import type { CharacterCreationActionPlan } from './actions.js'
import type { CharacterCreationFlow, CharacterCreationStep } from './flow.js'
import {
  characteristicDefinitions,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationCharacteristicGridViewModel,
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationBasicTrainingButton,
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
  formatCharacterCreationCharacteristicModifier,
  type CharacterCreationAgingChoicesViewModel,
  type CharacterCreationAgingRollViewModel,
  type CharacterCreationAnagathicsDecisionViewModel,
  type CharacterCreationBasicTrainingButton,
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
  statusLabel: string
  step: CharacterCreationStep | null
  creationComplete: boolean
  isActive: boolean
  isPlayable: boolean
  isDeceased: boolean
  termCount: number
  completedTermCount: number
  historyCount: number
  timelineCount: number
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
  basicTraining: CharacterCreationBasicTrainingButton | null
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
  characterReadModel: CharacterCreationReadModel | null
  pending: CharacterCreationPendingViewModel
  wizard: CharacterCreationWizardViewModel | null
  actionPlan: CharacterCreationActionPlan | null
}

export interface DeriveCharacterCreationViewModelOptions {
  flow: CharacterCreationFlow | null
  projection: CharacterCreationProjection | null
  character?: CharacterState | null
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
        statusLabel: 'Creation',
        step: null,
        creationComplete: false,
        isActive: false,
        isPlayable: false,
        isDeceased: false,
        termCount: 0,
        completedTermCount: 0,
        historyCount: 0,
        timelineCount: 0
      },
      readModel: null
    }
  }

  const readModel = deriveCharacterCreationProjectionReadModel(projection)

  return {
    summary: {
      present: true,
      status: readModel.status,
      statusLabel: readModel.statusLabel,
      step: readModel.step,
      creationComplete: readModel.creationComplete,
      isActive: readModel.isActive,
      isPlayable: readModel.isPlayable,
      isDeceased: readModel.isDeceased,
      termCount: readModel.termCount,
      completedTermCount: readModel.completedTermCount,
      historyCount: readModel.historyCount,
      timelineCount: readModel.timelineCount
    },
    readModel
  }
}

const projectedCharacteristicGridViewModel = (
  readModel: CharacterCreationReadModel | null
): CharacterCreationCharacteristicGridViewModel | null => {
  if (!readModel || readModel.status !== 'CHARACTERISTICS') return null

  return {
    open: true,
    stats: characteristicDefinitions.map(({ key, label }) => {
      const value = readModel.sheet.characteristics[key]
      const valueText = value === null ? '' : String(value)
      const missing = value === null

      return {
        key,
        label,
        value: valueText,
        modifier: missing
          ? ''
          : formatCharacterCreationCharacteristicModifier(value),
        missing,
        errors: [],
        rollLabel: `Roll ${label}`
      }
    })
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
  projectedCreation,
  projection,
  characterReadModel,
  readOnly
}: {
  flow: CharacterCreationFlow | null
  projectedCreation: CharacterCreationProjection | null
  projection: CharacterCreationProjectionViewModel
  characterReadModel: CharacterCreationReadModel | null
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (!flow) return null

  const projectedCascadeChoices =
    projectedCreation?.actionPlan?.cascadeSkillChoices ?? []
  const backgroundCascadeChoices =
    projectedCreation?.state.status === 'HOMEWORLD'
      ? projectedCascadeChoices
      : []
  const termCascadeChoices =
    projectedCreation?.state.status === 'SKILLS_TRAINING'
      ? projectedCascadeChoices
      : []
  const homeworldChoiceOptions =
    projectedCreation?.state.status === 'HOMEWORLD'
      ? projectedCreation.actionPlan?.homeworldChoiceOptions
      : undefined
  const careerChoiceOptions =
    projectedCreation?.state.status === 'CAREER_SELECTION'
      ? projectedCreation.actionPlan?.careerChoiceOptions
      : undefined

  return {
    step: flow.step,
    projectedStep: projection.step,
    projectedStepCurrent: projection.step === flow.step,
    controlsDisabled: readOnly,
    progress: deriveCharacterCreationStepProgressItems(flow),
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {
      backgroundCascadeChoices
    }),
    careerSelection: deriveCharacterCreationCareerSelectionViewModel(flow, {
      careerChoiceOptions
    }),
    careerRoll: deriveCharacterCreationCareerRollButton(flow),
    reenlistmentRoll: deriveCharacterCreationReenlistmentRollViewModel(flow),
    agingRoll: deriveCharacterCreationAgingRollViewModel(flow),
    agingChoices: deriveCharacterCreationAgingChoicesViewModel(flow),
    anagathicsDecision:
      deriveCharacterCreationAnagathicsDecisionViewModel(flow),
    termCascadeChoices: deriveCharacterCreationTermCascadeChoicesViewModel(
      flow,
      {
        termCascadeChoices
      }
    ),
    termResolution: deriveCharacterCreationTermResolutionViewModel(flow),
    termSkills: deriveCharacterCreationTermSkillTrainingViewModel(flow),
    basicTraining: deriveCharacterCreationBasicTrainingButton(flow),
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
    characteristics:
      projectedCharacteristicGridViewModel(characterReadModel) ??
      deriveCharacterCreationCharacteristicGridViewModel(flow),
    homeworld:
      flow.step === 'homeworld'
        ? deriveCharacterCreationHomeworldViewModel(flow, {
            backgroundCascadeChoices,
            homeworldChoiceOptions
          })
        : null
  }
}

export const deriveCharacterCreationViewModel = ({
  flow,
  projection,
  character = null,
  readOnly,
  actionPlan = null
}: DeriveCharacterCreationViewModelOptions): CharacterCreationViewModel => {
  const projected = projectionViewModel(projection)
  const characterReadModel = character
    ? deriveCharacterCreationReadModel(character)
    : null
  const wizard = wizardViewModel({
    flow,
    projectedCreation: projection,
    projection: projected.summary,
    characterReadModel,
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
    characterReadModel,
    pending: pendingViewModel(flow, projection),
    wizard,
    actionPlan
  }
}
