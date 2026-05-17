import type {
  CepheusCareerDefinition,
  CepheusRuleset
} from '../../../../shared/character-creation/cepheus-srd-ruleset'
import type {
  BenefitKind,
  FailedQualificationOption,
  InjuryResolutionActionOption
} from '../../../../shared/character-creation/types'
import type { InjurySecondaryChoice } from '../../../../shared/characterCreation'
import type { CharacteristicKey } from '../../../../shared/state'
import type { CharacterCreationStep, CharacterCreationValidation } from './flow'

export type CharacterCreationViewStep = CharacterCreationStep

export type CharacterCreationFieldKind =
  | 'number'
  | 'select'
  | 'text'
  | 'textarea'

export interface CharacterCreationFieldViewModel {
  key: string
  label: string
  kind: CharacterCreationFieldKind
  step: CharacterCreationViewStep
  value: string
  required: boolean
  errors: string[]
}

export interface CharacterCreationCtaLabels {
  primary: string
  secondary: string | null
}

export interface CharacterCreationStepProgressItem {
  step: CharacterCreationViewStep
  label: string
  index: number
  current: boolean
  complete: boolean
  invalid: boolean
  disabled: boolean
  errors: string[]
}

export interface CharacterCreationButtonState {
  label: string
  disabled: boolean
  reason: string | null
}

export interface CharacterCreationButtonStates {
  primary: CharacterCreationButtonState
  secondary: CharacterCreationButtonState | null
}

export interface CharacterCreationCareerRollButton {
  key: string
  label: string
  reason: string
  disabled: boolean
  skipLabel: string | null
}

export interface CharacterCreationCharacteristicRollButton {
  label: string
  reason: string
  disabled: boolean
}

export interface CharacterCreationBasicTrainingButton {
  label: string
  reason: string
  skills: string[]
  kind: 'all' | 'choose-one' | 'none'
  disabled: boolean
}

export interface CharacterCreationValidationSummary {
  ok: boolean
  step: CharacterCreationViewStep
  errors: string[]
  errorCount: number
  message: string
}

export interface CharacterCreationStatStripItem {
  key: CharacteristicKey
  label: string
  value: string
  modifier: string
  missing: boolean
}

export interface CharacterCreationSkillStripViewModel {
  skills: string[]
  summary: string
}

export interface CharacterCreationCharacteristicGridItem {
  key: CharacteristicKey
  label: string
  value: string
  modifier: string
  missing: boolean
  errors: string[]
  rollLabel: string
}

export interface CharacterCreationCharacteristicGridViewModel {
  open: boolean
  stats: CharacterCreationCharacteristicGridItem[]
}

export interface CharacterCreationNextStepViewModel {
  step: CharacterCreationViewStep
  phase: string
  prompt: string
  blockingChoice: CharacterCreationPendingCascadeChoiceViewModel | null
  primaryAction: CharacterCreationButtonState
  secondaryAction: CharacterCreationButtonState | null
  validation: CharacterCreationValidationSummary
  stats: CharacterCreationStatStripItem[]
  skills: CharacterCreationSkillStripViewModel
}

export interface CharacterCreationReviewItem {
  label: string
  value: string
}

export interface CharacterCreationReviewSection {
  key: string
  label: string
  items: CharacterCreationReviewItem[]
}

export interface CharacterCreationReviewSummary {
  title: string
  subtitle: string
  sections: CharacterCreationReviewSection[]
}

export interface CharacterCreationTermHistoryViewModel {
  title: string
  terms: string[]
}

export type CharacterCreationFormValues = Partial<
  Record<string, string | number | null | undefined>
>

export interface CharacterCreationViewRulesOptions {
  ruleset?: CepheusRuleset
  careers?: readonly CepheusCareerDefinition[]
}

export interface CharacterCreationCareerCheckViewModel {
  label: string
  requirement: string
  available: boolean
  characteristic: CharacteristicKey | null
  target: number | null
  modifier: number
}

export interface CharacterCreationCareerOptionViewModel {
  key: string
  label: string
  selected: boolean
  qualification: CharacterCreationCareerCheckViewModel
  survival: CharacterCreationCareerCheckViewModel
  commission: CharacterCreationCareerCheckViewModel
  advancement: CharacterCreationCareerCheckViewModel
}

export interface CharacterCreationFailedQualificationOptionViewModel {
  option: FailedQualificationOption
  label: string
  actionLabel: string
  rollRequirement: string | null
}

export interface CharacterCreationFailedQualificationViewModel {
  open: boolean
  title: string
  message: string
  options: CharacterCreationFailedQualificationOptionViewModel[]
}

export interface CharacterCreationHiddenFieldViewModel {
  key: string
  value: string
}

export interface CharacterCreationCareerSelectionViewModel {
  open: boolean
  hiddenFields: CharacterCreationHiddenFieldViewModel[]
  outcomeTitle: string
  outcomeText: string
  showCareerList: boolean
  careerOptions: CharacterCreationCareerOptionViewModel[]
  failedQualification: CharacterCreationFailedQualificationViewModel
}

export interface CharacterCreationHomeworldOptionViewModel {
  value: string
  label: string
  selected: boolean
}

export interface CharacterCreationBackgroundSkillOptionViewModel {
  value: string
  label: string
  selected: boolean
  preselected: boolean
  cascade: boolean
}

export interface CharacterCreationCascadeSkillChoiceOptionViewModel {
  value: string
  label: string
  cascade: boolean
}

export interface CharacterCreationCascadeSkillChoiceViewModel {
  cascadeSkill: string
  label: string
  level: number
  options: CharacterCreationCascadeSkillChoiceOptionViewModel[]
}

export interface CharacterCreationPendingCascadeChoiceViewModel {
  open: boolean
  cascadeSkill: string
  title: string
  prompt: string
  label: string
  level: number
  options: CharacterCreationCascadeSkillChoiceOptionViewModel[]
}

export interface CharacterCreationHomeworldSummaryViewModel {
  lawLevel: string
  tradeCodes: string[]
  tradeCodeSummary: string
  backgroundSkillSummary: string
  cascadeSummary: string
}

export interface CharacterCreationBackgroundSkillSummary {
  allowance: number
  selectedSkills: string[]
  availableSkills: string[]
  skillOptions: CharacterCreationBackgroundSkillOptionViewModel[]
  remainingSelections: number
  pendingCascadeSkills: string[]
  cascadeSkillChoices: CharacterCreationCascadeSkillChoiceViewModel[]
  errors: string[]
  message: string
}

export interface CharacterCreationHomeworldViewModel {
  step: 'homeworld'
  fields: CharacterCreationFieldViewModel[]
  lawLevelOptions: CharacterCreationHomeworldOptionViewModel[]
  tradeCodeOptions: CharacterCreationHomeworldOptionViewModel[]
  summary: CharacterCreationHomeworldSummaryViewModel
  backgroundSkills: CharacterCreationBackgroundSkillSummary
  pendingCascadeChoice: CharacterCreationPendingCascadeChoiceViewModel | null
}

export interface CharacterCreationDeathViewModel {
  open: boolean
  title: string
  detail: string
  roll: string
  career: string
}

export interface CharacterCreationTermSkillRollViewModel {
  label: string
  detail: string
}

export interface CharacterCreationTermSkillTableViewModel {
  table: string
  label: string
  reason: string
  disabled: boolean
}

export interface CharacterCreationTermSkillTrainingViewModel {
  open: boolean
  title: string
  prompt: string
  required: number
  remaining: number
  rolled: CharacterCreationTermSkillRollViewModel[]
  actions: CharacterCreationTermSkillTableViewModel[]
}

export interface CharacterCreationReenlistmentRollViewModel {
  label: string
  reason: string
}

export interface CharacterCreationAgingRollViewModel {
  label: string
  reason: string
  modifier: number
  modifierText: string
}

export interface CharacterCreationAgingChoiceOptionViewModel {
  characteristic: CharacteristicKey
  label: string
}

export interface CharacterCreationAgingChoiceViewModel {
  index: number
  label: string
  options: CharacterCreationAgingChoiceOptionViewModel[]
}

export interface CharacterCreationAgingChoicesViewModel {
  open: boolean
  title: string
  prompt: string
  choices: CharacterCreationAgingChoiceViewModel[]
}

export interface CharacterCreationTermCascadeChoicesViewModel {
  open: boolean
  title: string
  prompt: string
  choices: CharacterCreationCascadeSkillChoiceViewModel[]
}

export interface CharacterCreationAnagathicsDecisionViewModel {
  title: string
  prompt: string
  reason: string
  useLabel: string
  skipLabel: string
}

export interface CharacterCreationTermResolutionActionViewModel {
  label: string
  continueCareer: boolean
}

export interface CharacterCreationTermResolutionViewModel {
  title: string
  message: string
  actions: CharacterCreationTermResolutionActionViewModel[]
}

export interface CharacterCreationMishapResolutionViewModel {
  title: string
  message: string
  buttonLabel: string
}

export interface CharacterCreationInjuryTargetViewModel {
  characteristic: CharacteristicKey
  label: string
  value: string
  modifier: string
}

export interface CharacterCreationInjuryResolutionViewModel {
  title: string
  message: string
  choiceHint: string | null
  targets: CharacterCreationInjuryTargetViewModel[]
  secondaryChoice: InjurySecondaryChoice
  methods: readonly InjuryResolutionActionOption[]
}

export interface CharacterCreationMusteringBenefitViewModel {
  label: string
  valueLabel: string
  rollLabel: string
  metaLabel: string
}

export interface CharacterCreationMusteringActionViewModel {
  career: string
  kind: BenefitKind
  label: string
  disabled: boolean
  title: string
}

export interface CharacterCreationMusteringOutViewModel {
  title: string
  summary: string
  benefits: CharacterCreationMusteringBenefitViewModel[]
  actions: CharacterCreationMusteringActionViewModel[]
}

export type CharacterCreationStepValidation = CharacterCreationValidation & {
  step: CharacterCreationViewStep
}
