import type {
  CareerCreationActionKey,
  LegalCareerCreationAction
} from '../../../../shared/character-creation/types.js'
import type {
  CharacterCreationReadModel,
  CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type { CharacterId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import type { CharacterCreationActionPlan } from './actions.js'
import type { CharacterCreationFlow, CharacterCreationStep } from './flow.js'
import type {
  CharacterCreationAgingChoicesViewModel,
  CharacterCreationAgingRollViewModel,
  CharacterCreationAnagathicsDecisionViewModel,
  CharacterCreationBasicTrainingButton,
  CharacterCreationButtonStates,
  CharacterCreationCareerRollButton,
  CharacterCreationCareerSelectionViewModel,
  CharacterCreationCharacteristicGridViewModel,
  CharacterCreationDeathViewModel,
  CharacterCreationHomeworldViewModel,
  CharacterCreationInjuryResolutionViewModel,
  CharacterCreationMusteringOutViewModel,
  CharacterCreationMishapResolutionViewModel,
  CharacterCreationNextStepViewModel,
  CharacterCreationReenlistmentRollViewModel,
  CharacterCreationReviewSummary,
  CharacterCreationStepProgressItem,
  CharacterCreationTermCascadeChoicesViewModel,
  CharacterCreationTermHistoryViewModel,
  CharacterCreationTermResolutionViewModel,
  CharacterCreationTermSkillTrainingViewModel,
  CharacterCreationValidationSummary
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
  mishapResolution: CharacterCreationMishapResolutionViewModel | null
  injuryResolution: CharacterCreationInjuryResolutionViewModel | null
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

export interface CharacterCreationProjectedActionSection {
  hasProjectedCreation: boolean
  legalActions: readonly LegalCareerCreationAction[]
  legalActionKeys: ReadonlySet<CareerCreationActionKey> | null
  legalAction: (
    key: CareerCreationActionKey
  ) => LegalCareerCreationAction | undefined
  isLegalActionAvailable: (key: CareerCreationActionKey) => boolean | undefined
  cascadeSkillChoices: NonNullable<
    CharacterCreationProjection['actionPlan']
  >['cascadeSkillChoices']
  homeworldChoiceOptions:
    | NonNullable<
        CharacterCreationProjection['actionPlan']
      >['homeworldChoiceOptions']
    | undefined
  careerChoiceOptions:
    | NonNullable<
        CharacterCreationProjection['actionPlan']
      >['careerChoiceOptions']
    | undefined
}

export interface DeriveCharacterCreationViewModelOptions {
  flow: CharacterCreationFlow | null
  projection: CharacterCreationProjection | null
  character?: CharacterState | null
  readOnly: boolean
  actionPlan?: CharacterCreationActionPlan | null
  ruleset?: CepheusRuleset | null
}
