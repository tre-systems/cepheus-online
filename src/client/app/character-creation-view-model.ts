import type { CharacterId } from '../../shared/ids'
import type { CharacterCreationProjection } from '../../shared/state'
import type { CharacterCreationActionPlan } from './character-creation-actions.js'
import type {
  CharacterCreationFlow,
  CharacterCreationStep
} from './character-creation-flow.js'
import { creationStepFromStatus } from './character-creation-projection.js'
import {
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationCharacteristicGridViewModel,
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReenlistmentRollViewModel,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationTermCascadeChoicesViewModel,
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
  type CharacterCreationHomeworldViewModel,
  type CharacterCreationNextStepViewModel,
  type CharacterCreationReenlistmentRollViewModel,
  type CharacterCreationStepProgressItem,
  type CharacterCreationTermCascadeChoicesViewModel,
  type CharacterCreationTermResolutionViewModel,
  type CharacterCreationTermSkillTrainingViewModel,
  type CharacterCreationValidationSummary
} from './character-creation-view.js'

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
): CharacterCreationProjectionViewModel => ({
  present: projection !== null,
  status: projection?.state.status ?? null,
  step: projection ? creationStepFromStatus(projection.state.status) : null,
  creationComplete: projection?.creationComplete ?? false,
  completedTermCount:
    projection?.terms.filter((term) => term.complete || term.musteringOut)
      .length ?? 0,
  historyCount: projection?.history?.length ?? 0
})

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
  const wizard = wizardViewModel({ flow, projection: projected, readOnly })

  return {
    mode: !flow ? 'empty' : readOnly ? 'read-only' : 'editable',
    title: flow?.draft.name.trim() || 'Create traveller',
    characterId: flow?.draft.characterId ?? null,
    flow,
    readOnly,
    controlsDisabled: readOnly,
    projection: projected,
    pending: pendingViewModel(flow, projection),
    wizard,
    actionPlan
  }
}
