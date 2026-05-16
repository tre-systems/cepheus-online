import {
  derivePrimaryEducationSkillOptions,
  deriveTotalBackgroundSkillAllowance
} from '../../../../shared/character-creation/background-skills.js'
import {
  characteristicModifier,
  deriveFailedQualificationOptions,
  parseCareerCheck
} from '../../../../shared/character-creation/career-rules.js'
import {
  CEPHEUS_SRD_CAREERS,
  CEPHEUS_SRD_RULESET,
  type CepheusCareerDefinition,
  type CepheusSrdRuleset
} from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import {
  careerSkillWithLevel,
  formatCareerSkill,
  isCascadeCareerSkill,
  parseCareerSkill,
  tallyCareerSkills
} from '../../../../shared/character-creation/skills.js'
import type {
  BasicTrainingActionOption,
  BenefitKind,
  CareerChoiceOptions,
  CareerCreationActionKey,
  CascadeSkillChoice,
  FailedQualificationActionOption,
  FailedQualificationOption,
  HomeworldChoiceOptions,
  InjuryResolutionActionOption,
  MusteringBenefitActionOption,
  TermSkillTableActionOption
} from '../../../../shared/character-creation/types.js'
import type { InjurySecondaryChoice } from '../../../../shared/characterCreation.js'
import type {
  CharacterCharacteristics,
  CharacterCreationProjection,
  CharacterEquipmentItem,
  CharacteristicKey
} from '../../../../shared/state'
import type {
  CharacterCreationCareerPlan,
  CharacterCreationCompletedTerm,
  CharacterCreationDraftPatch,
  CharacterCreationFlow,
  CharacterCreationMusteringBenefit,
  CharacterCreationStep,
  CharacterCreationValidation
} from './flow.js'
import {
  canRollCharacterCreationMusteringBenefit,
  characterCreationMusteringBenefitRollModifier,
  characterCreationSteps,
  deriveCharacterCreationAgingChangeOptions,
  deriveCharacterCreationAnagathicsDecision,
  deriveCharacterCreationBasicTrainingAction,
  deriveCharacterCreationCareerSkipAction,
  deriveCharacterCreationTermSkillTableActions,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationCareerRoll,
  deriveNextCharacterCreationCharacteristicRoll,
  deriveNextCharacterCreationReenlistmentRoll,
  isCharacterCreationCareerTermResolved,
  remainingCharacterCreationTermSkillRolls,
  remainingMusteringBenefits,
  requiredCharacterCreationTermSkillRolls,
  validateCurrentCharacterCreationStep
} from './flow.js'

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
  ruleset?: CepheusSrdRuleset
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

export const formatCharacterCreationReenlistmentOutcome = (
  plan: CharacterCreationCareerPlan | null | undefined
): string => {
  if (plan?.reenlistmentOutcome === 'forced') {
    return `Reenlistment ${plan.reenlistmentRoll}: mandatory reenlistment.`
  }
  if (plan?.reenlistmentOutcome === 'allowed') {
    return `Reenlistment ${plan.reenlistmentRoll}: may reenlist or muster out.`
  }
  if (plan?.reenlistmentOutcome === 'blocked') {
    return `Reenlistment ${plan.reenlistmentRoll}: must muster out.`
  }
  if (plan?.reenlistmentOutcome === 'retire') {
    return 'Seven terms served: must retire and muster out.'
  }
  return 'Roll reenlistment before deciding what happens next.'
}

export const formatCharacterCreationCharacteristicModifier = (
  value: string | number | null | undefined
): string => {
  if (value === '' || value === null || value === undefined) return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  const modifier = Math.floor(number / 3) - 2
  if (modifier === 0) return ''
  return modifier > 0 ? `+${modifier}` : String(modifier)
}

export const formatCharacterCreationCareerCheckShort = (
  check: CharacterCreationCareerCheckViewModel
): string => {
  if (!check.available) return 'Unavailable'
  const modifier =
    check.modifier === 0
      ? ''
      : check.modifier > 0
        ? ` +${check.modifier}`
        : ` ${check.modifier}`
  return `${check.requirement}${modifier}`
}

export const formatCharacterCreationCareerOutcome = (
  plan: CharacterCreationCareerPlan | null | undefined
): string => {
  if (!plan?.career) return 'Select a career to attempt qualification.'
  if (plan.drafted && plan.survivalRoll === null) {
    return `Drafted into ${plan.career}: ready to roll survival.`
  }
  const lines = []
  if (plan.qualificationRoll !== null) {
    lines.push(
      `Qualification ${plan.qualificationRoll}: ${
        plan.qualificationPassed ? 'accepted' : 'rejected'
      }`
    )
  }
  if (plan.survivalRoll !== null) {
    lines.push(
      `Survival ${plan.survivalRoll}: ${
        plan.survivalPassed ? 'survived' : 'mishap'
      }`
    )
  }
  if (plan.commissionRoll !== null) {
    lines.push(
      plan.commissionRoll === -1
        ? 'Commission skipped'
        : `Commission ${plan.commissionRoll}: ${
            plan.commissionPassed ? 'commissioned' : 'not commissioned'
          }`
    )
  }
  if (plan.advancementRoll !== null) {
    lines.push(
      plan.advancementRoll === -1
        ? 'Advancement skipped'
        : `Advancement ${plan.advancementRoll}: ${
            plan.advancementPassed ? 'advanced' : 'held rank'
          }`
    )
  }
  if (plan.agingRoll != null) {
    lines.push(`Aging ${plan.agingRoll}: ${plan.agingMessage ?? 'resolved'}`)
  }
  if (plan.reenlistmentOutcome) {
    lines.push(formatCharacterCreationReenlistmentOutcome(plan))
  }
  return lines.join(' | ') || `${plan.career}: ready to roll qualification.`
}

export const formatCharacterCreationCompletedTermSummary = (
  term: CharacterCreationCompletedTerm,
  index: number
): string => {
  const result = term.survivalPassed ? 'survived' : 'killed in service'
  const commission =
    term.commissionRoll === null
      ? ''
      : term.commissionRoll === -1
        ? ', skipped commission'
        : term.commissionPassed
          ? ', commissioned'
          : ', no commission'
  const advancement =
    term.advancementRoll === null
      ? ''
      : term.advancementRoll === -1
        ? ', skipped advancement'
        : term.advancementPassed
          ? ', advanced'
          : ', held rank'
  const rank = term.rankTitle ? `, rank ${term.rankTitle}` : ''
  const bonusSkill = term.rankBonusSkill
    ? `; rank skill ${term.rankBonusSkill}`
    : ''
  const termSkillRolls = term.termSkillRolls ?? []
  const training =
    termSkillRolls.length > 0
      ? `; training ${termSkillRolls
          .map((roll) => `${roll.skill} (${roll.roll})`)
          .join(', ')}`
      : ''
  const aging =
    term.agingRoll != null
      ? `; aging ${term.agingRoll}${
          term.agingMessage ? ` ${term.agingMessage}` : ''
        }`
      : ''
  const anagathics =
    term.anagathics === true
      ? `; anagathics${
          term.anagathicsCost != null ? ` (Cr${term.anagathicsCost})` : ''
        }`
      : ''
  const reenlistment =
    term.reenlistmentOutcome && term.reenlistmentRoll !== null
      ? `; reenlistment ${term.reenlistmentRoll} ${term.reenlistmentOutcome}`
      : term.reenlistmentOutcome === 'retire'
        ? '; retirement required'
        : ''
  return `${index + 1}. ${term.career}: ${result}${commission}${advancement}${rank}${bonusSkill}${training}${anagathics}${aging}${reenlistment}`
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

const formatCredits = (credits: number): string => `Cr${credits}`

const musteringBenefitKindLabel = (kind: BenefitKind): string =>
  kind === 'cash' ? 'Cash' : 'Material'

const musteringBenefitValueLabel = (
  benefit: CharacterCreationMusteringBenefit
): string =>
  benefit.kind === 'cash' ? formatCredits(benefit.credits) : benefit.value

const musteringBenefitRollLabel = (
  benefit: CharacterCreationMusteringBenefit
): string => {
  if (benefit.legacyProjection) return 'Legacy benefit'
  const diceRoll = benefit.diceRoll ?? null
  const modifier = benefit.modifier ?? null
  const tableRoll = benefit.tableRoll ?? benefit.roll
  if (diceRoll === null || modifier === null) return `Table ${benefit.roll}`
  if (modifier === 0) return `Roll ${diceRoll}`
  return `Roll ${diceRoll} ${signedModifier(modifier)} DM = ${tableRoll}`
}

export const formatCharacterCreationMusteringBenefitSummary = (
  benefit: CharacterCreationMusteringBenefit
): string =>
  `${benefit.career} ${musteringBenefitKindLabel(benefit.kind).toLowerCase()}: ${musteringBenefitValueLabel(benefit)}`

interface CharacterCreationHomeworldDraftFields {
  homeWorld?: {
    lawLevel?: string | null
    tradeCodes?: string | readonly string[] | null
  } | null
  homeworld?: {
    lawLevel?: string | null
    tradeCodes?: string | readonly string[] | null
  } | null
  backgroundSkills?: readonly string[]
  pendingCascadeSkills?: readonly string[]
}

export const characteristicDefinitions: {
  key: CharacteristicKey
  label: string
}[] = [
  { key: 'str', label: 'Str' },
  { key: 'dex', label: 'Dex' },
  { key: 'end', label: 'End' },
  { key: 'int', label: 'Int' },
  { key: 'edu', label: 'Edu' },
  { key: 'soc', label: 'Soc' }
]

export const characterCreationStepLabels: Record<
  CharacterCreationViewStep,
  string
> = {
  basics: 'Basics',
  characteristics: 'Characteristics',
  homeworld: 'Homeworld',
  career: 'Career',
  skills: 'Skills',
  equipment: 'Equipment',
  review: 'Review'
}

export const characterCreationPrimaryCtaLabels: Record<
  CharacterCreationViewStep,
  string
> = {
  basics: 'Continue to characteristics',
  characteristics: 'Continue to homeworld',
  homeworld: 'Continue to career',
  career: 'Continue to skills',
  skills: 'Continue to equipment',
  equipment: 'Review character',
  review: 'Create character'
}

export const deriveCharacterCreationCtaLabels = (
  step: CharacterCreationViewStep
): CharacterCreationCtaLabels => ({
  primary: characterCreationPrimaryCtaLabels[step],
  secondary: step === 'basics' ? null : 'Back'
})

export const characterCreationViewSteps = (): CharacterCreationViewStep[] =>
  characterCreationSteps()

const stepIndex = (step: CharacterCreationViewStep): number =>
  characterCreationViewSteps().indexOf(step)

export const deriveCharacterCreationStepProgressItems = (
  flow: CharacterCreationFlow,
  options: CharacterCreationViewRulesOptions = {}
): CharacterCreationStepProgressItem[] => {
  const currentIndex = stepIndex(flow.step)

  return characterCreationViewSteps().map((step, index) => {
    const validation = validationForStep(flow, step, options)
    const visited = index <= currentIndex
    const current = step === flow.step

    return {
      step,
      label: characterCreationStepLabels[step],
      index,
      current,
      complete: index < currentIndex && validation.ok,
      invalid: visited && !validation.ok,
      disabled: index > currentIndex,
      errors: visited ? [...validation.errors] : []
    }
  })
}

export const deriveCharacterCreationButtonStates = (
  flow: CharacterCreationFlow,
  options: CharacterCreationViewRulesOptions = {}
): CharacterCreationButtonStates => {
  const labels = deriveCharacterCreationCtaLabels(flow.step)
  const validation = validationForStep(flow, flow.step, options)
  const reason = validation.ok
    ? null
    : `${validation.errors.length} ${
        validation.errors.length === 1 ? 'issue' : 'issues'
      } to fix`

  return {
    primary: {
      label: labels.primary,
      disabled: !validation.ok,
      reason
    },
    secondary:
      labels.secondary === null
        ? null
        : {
            label: labels.secondary,
            disabled: false,
            reason: null
          }
  }
}

export const deriveCharacterCreationCareerRollButton = (
  flow: CharacterCreationFlow,
  {
    availableActionKeys
  }: { availableActionKeys?: ReadonlySet<CareerCreationActionKey> } = {}
): CharacterCreationCareerRollButton | null => {
  if (flow.step !== 'career') return null
  const action = deriveNextCharacterCreationCareerRoll(flow)
  if (!action) return null
  const requiredAction: Partial<
    Record<CharacterCreationCareerRollButton['key'], CareerCreationActionKey>
  > = {
    qualificationRoll: 'selectCareer',
    survivalRoll: 'rollSurvival',
    commissionRoll: 'rollCommission',
    advancementRoll: 'rollAdvancement'
  }
  const requiredActionKey = requiredAction[action.key]
  if (
    availableActionKeys &&
    requiredActionKey &&
    !availableActionKeys.has(requiredActionKey)
  ) {
    return null
  }

  return {
    key: action.key,
    label: action.label,
    reason: action.reason,
    disabled: false,
    skipLabel: deriveCharacterCreationCareerSkipAction(flow)?.label ?? null
  }
}

export const deriveCharacterCreationCharacteristicRollButton = (
  flow: CharacterCreationFlow
): CharacterCreationCharacteristicRollButton | null => {
  if (flow.step !== 'characteristics') return null
  const action = deriveNextCharacterCreationCharacteristicRoll(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason,
    disabled: false
  }
}

export const deriveCharacterCreationBasicTrainingButton = (
  flow: CharacterCreationFlow,
  {
    basicTrainingOptions
  }: { basicTrainingOptions?: BasicTrainingActionOption } = {}
): CharacterCreationBasicTrainingButton | null => {
  if (basicTrainingOptions && flow.step === 'skills') {
    if (basicTrainingOptions.kind === 'none') return null
    const careerName = flow.draft.careerPlan?.career.trim()
    if (!careerName || basicTrainingOptions.skills.length === 0) return null

    return {
      label:
        basicTrainingOptions.kind === 'choose-one'
          ? 'Choose basic training'
          : 'Apply basic training',
      reason:
        basicTrainingOptions.kind === 'choose-one'
          ? `Choose one ${careerName} service skill at level 0`
          : `First ${careerName} term grants service skills at level 0`,
      skills: [...basicTrainingOptions.skills],
      kind: basicTrainingOptions.kind,
      disabled: false
    }
  }

  const action = deriveCharacterCreationBasicTrainingAction(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason,
    skills: [...action.skills],
    kind: action.kind,
    disabled: false
  }
}

const signedModifier = (modifier: number): string =>
  modifier > 0 ? `+${modifier}` : String(modifier)

export const deriveCharacterCreationStatStrip = (
  flow: Pick<CharacterCreationFlow, 'draft'>
): CharacterCreationStatStripItem[] =>
  characteristicDefinitions.map(({ key, label }) => {
    const value = flow.draft.characteristics[key]
    return {
      key,
      label,
      value: value === null ? '-' : String(value),
      modifier:
        value === null ? '-' : signedModifier(characteristicModifier(value)),
      missing: value === null
    }
  })

export const deriveCharacterCreationSkillStrip = (
  flow: Pick<CharacterCreationFlow, 'draft'>
): CharacterCreationSkillStripViewModel => {
  const pendingTermCascadeSkills = new Set(flow.draft.pendingTermCascadeSkills)
  const skills = tallyCareerSkills([
    ...flow.draft.backgroundSkills,
    ...flow.draft.skills.filter((skill) => !pendingTermCascadeSkills.has(skill))
  ])

  return {
    skills,
    summary: skills.join(', ')
  }
}

export const deriveCharacterCreationCharacteristicGridViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationCharacteristicGridViewModel | null => {
  if (flow.step !== 'characteristics') return null

  return {
    open: true,
    stats: deriveCharacterCreationFieldViewModels(flow, 'characteristics').map(
      (field) => {
        const key = field.key as CharacteristicKey
        const missing = field.value === ''
        return {
          key,
          label: field.label,
          value: field.value,
          modifier: missing
            ? ''
            : formatCharacterCreationCharacteristicModifier(field.value),
          missing,
          errors: [...field.errors],
          rollLabel: `Roll ${field.label}`
        }
      }
    )
  }
}

const valueText = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const parseOptionalNumber = (
  value: string | number | null | undefined
): number | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null

  const text = String(value).trim()
  if (!text) return null

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const parseOptionalBoolean = (
  value: string | number | boolean | null | undefined
): boolean | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value

  const text = String(value).trim().toLowerCase()
  if (!text) return false
  return text === 'true' || text === '1' || text === 'yes' || text === 'on'
}

const parseNumberWithDefault = (
  value: string | number | null | undefined,
  fallback: number
): number | undefined => {
  if (value === undefined) return undefined
  if (value === null) return fallback

  const text = String(value).trim()
  if (!text) return fallback

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const splitListText = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)

const parseEquipmentText = (value: string): CharacterEquipmentItem[] =>
  value
    .split('\n')
    .map((line) => {
      const [name = '', quantity = '1', ...notes] = line
        .split('|')
        .map((part) => part.trim())
      if (!name) return null

      const parsedQuantity = Number.parseInt(quantity, 10)
      return {
        name,
        quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 1,
        notes: notes.join(' | ')
      }
    })
    .filter((item): item is CharacterEquipmentItem => item !== null)

const parseCareerPlan = (
  values: CharacterCreationFormValues
): CharacterCreationCareerPlan | undefined => {
  const keys = [
    'career',
    'qualificationRoll',
    'qualificationPassed',
    'survivalRoll',
    'commissionRoll',
    'advancementRoll',
    'drafted'
  ]
  if (!keys.some((key) => values[key] !== undefined)) return undefined

  const drafted = parseOptionalBoolean(values.drafted)

  return {
    ...emptyCareerPlan(),
    career: valueText(values.career),
    qualificationRoll: parseOptionalNumber(values.qualificationRoll) ?? null,
    qualificationPassed:
      parseOptionalBoolean(values.qualificationPassed) ?? null,
    survivalRoll: parseOptionalNumber(values.survivalRoll) ?? null,
    commissionRoll: parseOptionalNumber(values.commissionRoll) ?? null,
    advancementRoll: parseOptionalNumber(values.advancementRoll) ?? null,
    drafted: drafted ?? false
  }
}

const parseHomeworld = (
  values: CharacterCreationFormValues
): CharacterCreationDraftPatch['homeworld'] | undefined => {
  const lawLevel = values['homeworld.lawLevel'] ?? values.lawLevel
  const tradeCodes = values['homeworld.tradeCodes'] ?? values.tradeCodes
  if (lawLevel === undefined && tradeCodes === undefined) return undefined

  return {
    lawLevel:
      lawLevel === undefined ? null : valueText(lawLevel).trim() || null,
    tradeCodes:
      tradeCodes === undefined ? [] : splitListText(valueText(tradeCodes))
  }
}

const validationForStep = (
  flow: CharacterCreationFlow,
  step: CharacterCreationViewStep = flow.step,
  options: CharacterCreationViewRulesOptions = {}
): CharacterCreationValidation & { step: CharacterCreationViewStep } => {
  const validation = validateCurrentCharacterCreationStep({
    ...flow,
    step
  })
  if (step !== 'career') return validation

  const errors = [
    ...validation.errors,
    ...careerRollErrors(flow.draft, options)
  ]
  return {
    ok: errors.length === 0,
    step,
    errors
  }
}

const selectedCareerDefinition = (
  career: string | null | undefined,
  careers: readonly CepheusCareerDefinition[] = CEPHEUS_SRD_CAREERS
): CepheusCareerDefinition | null =>
  careers.find((candidate) => candidate.name === career) ?? null

const emptyCareerPlan = (): CharacterCreationCareerPlan => ({
  career: '',
  qualificationRoll: null,
  qualificationPassed: null,
  survivalRoll: null,
  survivalPassed: null,
  commissionRoll: null,
  commissionPassed: null,
  advancementRoll: null,
  advancementPassed: null,
  canCommission: null,
  canAdvance: null,
  drafted: false,
  anagathics: null
})

const rollErrors = ({
  value,
  label,
  required
}: {
  value: number | null | undefined
  label: string
  required: boolean
}): string[] => {
  if (value === null || value === undefined) {
    return required ? [`${label} is required`] : []
  }
  if (value === -1) return []
  if (!Number.isFinite(value)) return [`${label} must be a finite number`]
  if (value < 2 || value > 12) return [`${label} must be between 2 and 12`]
  return []
}

const careerRollErrors = (
  { careerPlan }: Pick<CharacterCreationFlow['draft'], 'careerPlan'>,
  options: Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): string[] => {
  const careerDefinition = selectedCareerDefinition(
    careerPlan?.career,
    options.careers
  )
  const requiresCommission =
    careerDefinition !== null &&
    careerPlan?.survivalPassed !== false &&
    parseCareerCheck(careerDefinition.commission) !== null
  const requiresAdvancement =
    careerDefinition !== null &&
    careerPlan?.survivalPassed === true &&
    careerPlan.canCommission === false &&
    parseCareerCheck(careerDefinition.advancement) !== null

  return [
    ...rollErrors({
      value: careerPlan?.qualificationRoll,
      label: 'Qualification roll',
      required:
        careerPlan?.drafted !== true &&
        !(
          careerPlan?.qualificationPassed === true &&
          careerPlan.qualificationRoll === null
        )
    }),
    ...(careerPlan?.qualificationPassed === false && careerPlan.drafted !== true
      ? ['Qualification failed; choose a different career']
      : []),
    ...rollErrors({
      value: careerPlan?.survivalRoll,
      label: 'Survival roll',
      required: true
    }),
    ...rollErrors({
      value: careerPlan?.commissionRoll,
      label: 'Commission roll',
      required: requiresCommission
    }),
    ...rollErrors({
      value: careerPlan?.advancementRoll,
      label: 'Advancement roll',
      required: requiresAdvancement
    })
  ]
}

const fieldErrors = (
  errors: readonly string[],
  key: string,
  characteristicKey?: CharacteristicKey
): string[] =>
  errors.filter((error) => {
    if (key === 'name') return error.startsWith('Name ')
    if (key === 'age') return error.startsWith('Age ')
    if (key === 'skills') return error.startsWith('At least one skill')
    if (key === 'credits') return error.startsWith('Credits ')
    if (key === 'equipment') return error.startsWith('Equipment ')
    if (key === 'career') return error.startsWith('Career is ')
    if (key === 'homeworld.lawLevel') {
      return error.startsWith('Homeworld law level ')
    }
    if (key === 'homeworld.tradeCodes') {
      return error.startsWith('Homeworld trade code ')
    }
    if (key === 'qualificationRoll') {
      return error.startsWith('Qualification roll ')
    }
    if (key === 'survivalRoll') return error.startsWith('Survival roll ')
    if (key === 'commissionRoll') return error.startsWith('Commission roll ')
    if (key === 'advancementRoll') return error.startsWith('Advancement roll ')
    if (characteristicKey) {
      return error.startsWith(`${characteristicKey.toUpperCase()} `)
    }
    return false
  })

const homeworldDraftFields = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationHomeworldDraftFields =>
  draft as CharacterCreationFlow['draft'] &
    CharacterCreationHomeworldDraftFields

const selectedHomeworld = (
  draft: CharacterCreationFlow['draft']
): NonNullable<CharacterCreationHomeworldDraftFields['homeWorld']> => {
  const fields = homeworldDraftFields(draft)
  return fields.homeWorld ?? fields.homeworld ?? {}
}

const selectedTradeCodes = (
  tradeCodes: string | readonly string[] | null | undefined
): string[] => {
  if (!tradeCodes) return []
  return typeof tradeCodes === 'string' ? [tradeCodes] : [...tradeCodes]
}

const backgroundSkillValue = (skill: string): string =>
  isCascadeCareerSkill(skill)
    ? careerSkillWithLevel(skill, 0)
    : formatCareerSkill({ name: skill, level: 0 })

const cascadeChoiceOptions = (
  cascadeSkill: string,
  ruleset: CepheusSrdRuleset = CEPHEUS_SRD_RULESET
): CharacterCreationCascadeSkillChoiceOptionViewModel[] => {
  const parsed = parseCareerSkill(cascadeSkill)
  if (!parsed) return []

  const options = ruleset.cascadeSkills[parsed.name] ?? []
  return options.map((option) => ({
    value: isCascadeCareerSkill(option)
      ? careerSkillWithLevel(option, parsed.level)
      : formatCareerSkill({ name: option, level: parsed.level }),
    label: option,
    cascade: isCascadeCareerSkill(option)
  }))
}

const projectedCascadeChoiceViewModel = (
  choice: CascadeSkillChoice
): CharacterCreationCascadeSkillChoiceViewModel => ({
  cascadeSkill: choice.cascadeSkill,
  label: choice.label,
  level: choice.level,
  options: choice.options.map((option) => ({ ...option }))
})

export const deriveCharacterCreationCascadeSkillChoiceViewModels = (
  pendingCascadeSkills: readonly string[],
  projectedChoices: readonly CascadeSkillChoice[] = [],
  options: Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationCascadeSkillChoiceViewModel[] => {
  const projectedBySkill = new Map(
    projectedChoices.map((choice) => [choice.cascadeSkill, choice])
  )

  return pendingCascadeSkills.map((cascadeSkill) => {
    const projected = projectedBySkill.get(cascadeSkill)
    if (projected) return projectedCascadeChoiceViewModel(projected)

    const parsed = parseCareerSkill(cascadeSkill)
    return {
      cascadeSkill,
      label: parsed?.name ?? cascadeSkill,
      level: parsed?.level ?? 0,
      options: cascadeChoiceOptions(cascadeSkill, options.ruleset)
    }
  })
}

const pendingCascadeChoiceViewModel = (
  pendingCascadeSkills: readonly string[],
  projectedChoices: readonly CascadeSkillChoice[] = [],
  options: Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationPendingCascadeChoiceViewModel | null => {
  const choice = deriveCharacterCreationCascadeSkillChoiceViewModels(
    pendingCascadeSkills,
    projectedChoices,
    options
  )[0]
  if (!choice) return null

  return {
    open: true,
    cascadeSkill: choice.cascadeSkill,
    title: `Choose ${choice.label}`,
    prompt: `Resolve ${choice.label}-${choice.level} into a specialty.`,
    label: choice.label,
    level: choice.level,
    options: choice.options
  }
}

const deriveCharacterCreationBackgroundSkillSummary = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
    homeworldChoiceOptions?: HomeworldChoiceOptions
  } & Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationBackgroundSkillSummary => {
  const fields = homeworldDraftFields(flow.draft)
  const homeworld = selectedHomeworld(flow.draft)
  const allowance = deriveTotalBackgroundSkillAllowance(
    flow.draft.characteristics.edu
  )
  const selectedSkills = [...(fields.backgroundSkills ?? [])]
  const pendingCascadeSkills = [...(fields.pendingCascadeSkills ?? [])]
  const selected = new Set([...selectedSkills, ...pendingCascadeSkills])
  const projectedSkillOptions = options.homeworldChoiceOptions?.backgroundSkills
  const localFallbackSkillOptions = () =>
    derivePrimaryEducationSkillOptions({
      edu: flow.draft.characteristics.edu,
      homeworld,
      rules: options.ruleset ?? CEPHEUS_SRD_RULESET
    }).map((option) => {
      const value = backgroundSkillValue(option.name)
      return {
        value,
        label: option.name,
        preselected: option.preselected,
        cascade: isCascadeCareerSkill(option.name)
      }
    })
  const skillOptions = (
    projectedSkillOptions ?? localFallbackSkillOptions()
  ).map((option) => ({
    ...option,
    selected: selected.has(option.value)
  }))
  const cascadeSkillChoices =
    deriveCharacterCreationCascadeSkillChoiceViewModels(
      pendingCascadeSkills,
      options.backgroundCascadeChoices,
      options
    )
  const errors =
    pendingCascadeSkills.length === 0
      ? []
      : [
          `${pendingCascadeSkills.length} cascade skill ${
            pendingCascadeSkills.length === 1
              ? 'choice remains'
              : 'choices remain'
          }`
        ]

  return {
    allowance,
    selectedSkills,
    availableSkills: skillOptions.map((option) => option.label),
    skillOptions,
    remainingSelections: Math.max(
      allowance - selectedSkills.length - pendingCascadeSkills.length,
      0
    ),
    pendingCascadeSkills,
    cascadeSkillChoices,
    errors,
    message: errors.length === 0 ? 'Background skills ready' : errors.join(', ')
  }
}

const plural = (count: number, singular: string, pluralText: string): string =>
  `${count} ${count === 1 ? singular : pluralText}`

const homeworldSummaryViewModel = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
    homeworldChoiceOptions?: HomeworldChoiceOptions
  } & Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationHomeworldSummaryViewModel => {
  const homeworld = selectedHomeworld(flow.draft)
  const tradeCodes = selectedTradeCodes(homeworld.tradeCodes)
  const backgroundSkills = deriveCharacterCreationBackgroundSkillSummary(
    flow,
    options
  )
  const selectedCount =
    backgroundSkills.selectedSkills.length +
    backgroundSkills.pendingCascadeSkills.length

  return {
    lawLevel: homeworld.lawLevel ?? 'Not set',
    tradeCodes,
    tradeCodeSummary: tradeCodes.length > 0 ? tradeCodes.join(', ') : 'Not set',
    backgroundSkillSummary: `${selectedCount}/${backgroundSkills.allowance} background skills selected`,
    cascadeSummary:
      backgroundSkills.pendingCascadeSkills.length === 0
        ? 'No cascade choices pending'
        : `${plural(
            backgroundSkills.pendingCascadeSkills.length,
            'cascade choice',
            'cascade choices'
          )} pending`
  }
}

export const deriveCharacterCreationValidationSummary = (
  flow: CharacterCreationFlow,
  step: CharacterCreationViewStep = flow.step,
  options: Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): CharacterCreationValidationSummary => {
  const validation = validationForStep(flow, step, options)
  const errorCount = validation.errors.length

  return {
    ok: validation.ok,
    step: validation.step,
    errors: [...validation.errors],
    errorCount,
    message: validation.ok
      ? 'Ready to continue'
      : `${errorCount} ${errorCount === 1 ? 'issue' : 'issues'} to fix`
  }
}

const characterCreationPrompt = (
  flow: CharacterCreationFlow,
  validation: CharacterCreationValidationSummary,
  options: Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): string => {
  switch (flow.step) {
    case 'basics':
      return 'Name the traveller and choose the sheet type.'
    case 'characteristics': {
      const roll = deriveCharacterCreationCharacteristicRollButton(flow)
      return roll ? '' : 'Characteristics are ready.'
    }
    case 'homeworld': {
      const summary = deriveCharacterCreationBackgroundSkillSummary(
        flow,
        options
      )
      if (
        validation.errors.includes('Homeworld law level is required') ||
        validation.errors.includes('Homeworld trade code is required')
      ) {
        return 'Choose homeworld law level and trade codes.'
      }
      if (summary.pendingCascadeSkills.length > 0) {
        const choice = pendingCascadeChoiceViewModel(
          flow.draft.pendingCascadeSkills,
          [],
          options
        )
        return choice
          ? `Choose a ${choice.label} specialty.`
          : `${plural(
              summary.pendingCascadeSkills.length,
              'cascade choice',
              'cascade choices'
            )} must be resolved.`
      }
      if (summary.remainingSelections > 0) {
        return `Choose ${plural(
          summary.remainingSelections,
          'more background skill',
          'more background skills'
        )}.`
      }
      return 'Homeworld and background skills are ready.'
    }
    case 'career':
      if (deriveCharacterCreationDeathViewModel(flow)) {
        return 'The survival roll failed. This traveller is dead.'
      }
      return deriveCharacterCreationCareerRollButton(flow)
        ? 'Resolve the current career term rolls.'
        : 'Choose a career and confirm term results.'
    case 'skills':
      return deriveCharacterCreationBasicTrainingButton(flow)
        ? 'Apply basic training or enter skills manually.'
        : 'Review the skill list before equipment.'
    case 'equipment':
      return 'Add starting equipment, credits, and notes.'
    case 'review':
      return validation.ok
        ? 'Review the complete character before creating it.'
        : 'Fix the highlighted character details before creating it.'
    default: {
      const exhaustive: never = flow.step
      return exhaustive
    }
  }
}

export const deriveCharacterCreationNextStepViewModel = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
  } & CharacterCreationViewRulesOptions = {}
): CharacterCreationNextStepViewModel => {
  const validation = deriveCharacterCreationValidationSummary(
    flow,
    flow.step,
    options
  )
  const buttons = deriveCharacterCreationButtonStates(flow, options)
  const blockingChoice =
    flow.step === 'homeworld'
      ? pendingCascadeChoiceViewModel(
          flow.draft.pendingCascadeSkills,
          options.backgroundCascadeChoices,
          options
        )
      : null

  return {
    step: flow.step,
    phase: characterCreationStepLabels[flow.step],
    prompt: characterCreationPrompt(flow, validation, options),
    blockingChoice,
    primaryAction: buttons.primary,
    secondaryAction: buttons.secondary,
    validation,
    stats: deriveCharacterCreationStatStrip(flow),
    skills: deriveCharacterCreationSkillStrip(flow)
  }
}

export const deriveCharacterCreationDeathViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  { available }: { available?: boolean } = {}
): CharacterCreationDeathViewModel | null => {
  const plan = flow.draft.careerPlan
  if (flow.step !== 'career' || plan?.survivalPassed !== false) return null
  if (available === false) return null

  const name = flow.draft.name.trim() || 'This traveller'
  const career = plan?.career.trim() || 'career'
  const roll = plan.survivalRoll === null ? '-' : String(plan.survivalRoll)

  return {
    open: true,
    title: 'Killed in service',
    detail: `${name} failed the ${career} survival roll. Character creation ends here.`,
    roll,
    career
  }
}

export const deriveCharacterCreationMishapResolutionViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  { available }: { available?: boolean } = {}
): CharacterCreationMishapResolutionViewModel | null => {
  const plan = flow.draft.careerPlan
  if (flow.step !== 'career') return null
  if (available === false) return null
  if (available !== true && plan?.survivalPassed !== false) return null

  const career = plan?.career.trim() || 'career'

  return {
    title: `${career} mishap`,
    message: `${
      plan?.survivalPassed === false
        ? 'Survival failed.'
        : 'A mishap must be resolved.'
    } Resolve the mishap before this traveller musters out.`,
    buttonLabel: 'Resolve mishap'
  }
}

const injuryTargetKeys = (
  projection: CharacterCreationProjection
): CharacteristicKey[] => {
  const injury = projection.terms.at(-1)?.facts?.mishap?.outcome.injury
  if (!injury) return []
  if (injury.type === 'roll') return ['str', 'dex']
  if (injury.injuryRoll === 3) return ['str', 'dex']

  return ['str', 'dex', 'end']
}

const injuryChoiceHint = (
  injury: NonNullable<
    NonNullable<
      NonNullable<
        CharacterCreationProjection['terms'][number]['facts']
      >['mishap']
    >['outcome']['injury']
  >
): string => {
  if (injury.type === 'roll') {
    return 'Choose the characteristic to use if the injury table result needs a loss target.'
  }
  if (injury.injuryRoll === 1) {
    return 'Choose the primary characteristic for the 1D6 loss; remaining physical losses are applied by the rules.'
  }
  if (injury.injuryRoll === 2) {
    return 'Choose the physical characteristic that takes the 1D6 loss.'
  }
  if (injury.injuryRoll === 3) {
    return 'Choose whether Strength or Dexterity takes the -2 loss.'
  }

  return 'Choose the physical characteristic that takes the permanent loss.'
}

export const deriveCharacterCreationInjuryResolutionViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  {
    available,
    projection
  }: {
    available?: boolean
    projection?: CharacterCreationProjection | null
  } = {}
): CharacterCreationInjuryResolutionViewModel | null => {
  if (available === false || flow.step !== 'career' || !projection) return null
  const term = projection.terms.at(-1)
  const injury = term?.facts?.mishap?.outcome.injury
  if (!term || !injury || term.facts?.injury) return null

  const targets = injuryTargetKeys(projection)
  if (targets.length === 0) return null
  const methods =
    projection.actionPlan?.legalActions.find(
      (action) => action.key === 'resolveInjury'
    )?.injuryResolutionOptions ?? []

  const career = term.career.trim() || flow.draft.careerPlan?.career || 'Career'
  const characteristics = flow.draft.characteristics

  return {
    title: `${career} injury`,
    message:
      injury.type === 'roll'
        ? 'Roll the injury table and choose where any permanent loss applies.'
        : 'Resolve this injury before mustering out.',
    choiceHint: injuryChoiceHint(injury),
    targets: targets.map((characteristic) => {
      const definition = characteristicDefinitions.find(
        (candidate) => candidate.key === characteristic
      )
      const value = characteristics[characteristic]

      return {
        characteristic,
        label: definition?.label ?? characteristic.toUpperCase(),
        value: value === null ? '-' : String(value),
        modifier:
          value === null
            ? ''
            : formatCharacterCreationCharacteristicModifier(value)
      }
    }),
    methods,
    secondaryChoice: { mode: 'both_other_physical' }
  }
}

export const deriveCharacterCreationTermSkillTrainingViewModel = (
  flow: CharacterCreationFlow,
  {
    termSkillTableOptions
  }: {
    termSkillTableOptions?: readonly TermSkillTableActionOption[]
  } = {}
): CharacterCreationTermSkillTrainingViewModel | null => {
  if (flow.step !== 'career') return null

  const required = requiredCharacterCreationTermSkillRolls(flow.draft)
  const remaining = remainingCharacterCreationTermSkillRolls(flow.draft)
  const localActions = deriveCharacterCreationTermSkillTableActions(flow)
  const localActionsByTable = new Map(
    localActions.map((action) => [action.table, action])
  )
  const actions = termSkillTableOptions
    ? termSkillTableOptions.map((option) => {
        const localAction = localActionsByTable.get(option.table)
        return {
          table: option.table,
          label: option.label,
          reason: localAction?.reason ?? 'Roll this term skill table.',
          disabled: localAction?.disabled ?? false
        }
      })
    : localActions
  const rolled =
    flow.draft.careerPlan?.termSkillRolls?.map((roll) => ({
      label: roll.skill,
      detail: `${roll.roll} on ${roll.table}`
    })) ?? []

  if (required === 0 && remaining === 0 && rolled.length === 0) return null

  return {
    open: actions.length > 0 || remaining > 0,
    title: 'Skills and training',
    prompt:
      remaining > 0
        ? `Choose a table and roll ${plural(
            remaining,
            'more skill',
            'more skills'
          )}.`
        : 'Term skills are complete.',
    required,
    remaining,
    rolled,
    actions: actions.map((action) => ({
      table: action.table,
      label: action.label,
      reason: action.reason,
      disabled: action.disabled
    }))
  }
}

export const deriveCharacterCreationReenlistmentRollViewModel = (
  flow: CharacterCreationFlow,
  { available }: { available?: boolean } = {}
): CharacterCreationReenlistmentRollViewModel | null => {
  if (available === false) return null
  const action = deriveNextCharacterCreationReenlistmentRoll(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason
  }
}

export const deriveCharacterCreationAgingRollViewModel = (
  flow: CharacterCreationFlow,
  { available }: { available?: boolean } = {}
): CharacterCreationAgingRollViewModel | null => {
  if (available === false) return null
  const action = deriveNextCharacterCreationAgingRoll(flow)
  if (!action) return null

  const modifier =
    action.modifier === 0
      ? ''
      : action.modifier > 0
        ? `+${action.modifier}`
        : String(action.modifier)

  return {
    label: action.label,
    reason: action.reason,
    modifier: action.modifier,
    modifierText: modifier
  }
}

export const deriveCharacterCreationAgingChoicesViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationAgingChoicesViewModel | null => {
  const choices = deriveCharacterCreationAgingChangeOptions(flow)
  if (choices.length === 0) return null

  return {
    open: true,
    title: 'Aging effects',
    prompt: 'Choose where each aging effect applies.',
    choices: choices.map((choice) => ({
      index: choice.index,
      label: `${choice.type.toLowerCase()} ${choice.modifier}`,
      options: choice.options.map((option) => ({
        characteristic: option,
        label: option.toUpperCase()
      }))
    }))
  }
}

export const deriveCharacterCreationTermCascadeChoicesViewModel = (
  flow: CharacterCreationFlow,
  options: {
    termCascadeChoices?: readonly CascadeSkillChoice[]
  } & Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationTermCascadeChoicesViewModel | null => {
  if (flow.step !== 'career') return null

  const choices =
    options.termCascadeChoices === undefined
      ? deriveCharacterCreationCascadeSkillChoiceViewModels(
          flow.draft.pendingTermCascadeSkills,
          [],
          options
        )
      : flow.draft.pendingTermCascadeSkills.flatMap((cascadeSkill) => {
          const projected = options.termCascadeChoices?.find(
            (choice) => choice.cascadeSkill === cascadeSkill
          )
          return projected ? [projectedCascadeChoiceViewModel(projected)] : []
        })
  if (choices.length === 0) return null

  return {
    open: true,
    title: 'Choose a specialty',
    prompt: 'Resolve the rolled cascade skill before continuing.',
    choices
  }
}

export const deriveCharacterCreationAnagathicsDecisionViewModel = (
  flow: CharacterCreationFlow,
  { available }: { available?: boolean } = {}
): CharacterCreationAnagathicsDecisionViewModel | null => {
  if (available === false) return null
  const decision = deriveCharacterCreationAnagathicsDecision(flow)
  if (!decision) return null

  return {
    title: 'Anagathics',
    prompt:
      'Choose whether this term used anagathics before aging and reenlistment.',
    reason: decision.reason,
    useLabel: 'Use anagathics',
    skipLabel: 'Skip'
  }
}

export const deriveCharacterCreationTermResolutionViewModel = (
  flow: CharacterCreationFlow,
  {
    availableActionKeys
  }: { availableActionKeys?: ReadonlySet<CareerCreationActionKey> } = {}
): CharacterCreationTermResolutionViewModel | null => {
  if (flow.step !== 'career') return null

  const plan = flow.draft.careerPlan
  if (!plan?.career) return null

  const title = 'Career term'
  const actionAvailable = (key: CareerCreationActionKey): boolean =>
    availableActionKeys ? availableActionKeys.has(key) : true
  const anyActionAvailable = (
    keys: readonly CareerCreationActionKey[]
  ): boolean =>
    availableActionKeys
      ? keys.some((key) => availableActionKeys.has(key))
      : true
  if (
    !isCharacterCreationCareerTermResolved(flow.draft) &&
    anyActionAvailable([
      'selectCareer',
      'rollSurvival',
      'rollCommission',
      'skipCommission',
      'rollAdvancement',
      'skipAdvancement'
    ])
  ) {
    return {
      title,
      message: 'Roll each required check. The next roll appears above.',
      actions: []
    }
  }

  if (
    deriveCharacterCreationTermSkillTableActions(flow).length > 0 &&
    actionAvailable('rollTermSkill')
  ) {
    return {
      title,
      message: 'Roll this term’s skills before deciding what happens next.',
      actions: []
    }
  }

  if (flow.draft.pendingTermCascadeSkills.length > 0) {
    return {
      title,
      message:
        'Choose the rolled skill specialty before deciding what happens next.',
      actions: []
    }
  }

  if (
    deriveCharacterCreationAnagathicsDecision(flow) &&
    actionAvailable('decideAnagathics')
  ) {
    return {
      title,
      message:
        'Decide whether this term used anagathics before deciding what happens next.',
      actions: []
    }
  }

  if (
    deriveNextCharacterCreationAgingRoll(flow) &&
    actionAvailable('resolveAging')
  ) {
    return {
      title,
      message: 'Roll aging before deciding what happens next.',
      actions: []
    }
  }

  if (flow.draft.pendingAgingChanges.length > 0) {
    return {
      title,
      message: 'Apply aging effects before deciding what happens next.',
      actions: []
    }
  }

  if (
    plan.survivalPassed === true &&
    !plan.reenlistmentOutcome &&
    actionAvailable('rollReenlistment')
  ) {
    return {
      title,
      message: 'Roll reenlistment before deciding what happens next.',
      actions: []
    }
  }

  if (plan.survivalPassed !== true) {
    return {
      title,
      message:
        'Killed in service. This character cannot muster out or become playable.',
      actions: []
    }
  }

  const actions: CharacterCreationTermResolutionActionViewModel[] = []
  if (
    plan.reenlistmentOutcome === 'allowed' ||
    plan.reenlistmentOutcome === 'forced'
  ) {
    const continueAllowed =
      plan.reenlistmentOutcome === 'forced'
        ? anyActionAvailable(['forcedReenlist', 'continueCareer'])
        : anyActionAvailable(['reenlist', 'continueCareer'])
    if (continueAllowed) {
      actions.push({
        label:
          plan.reenlistmentOutcome === 'forced'
            ? 'Serve required term'
            : 'Serve another term',
        continueCareer: true
      })
    }
  }

  if (anyActionAvailable(['leaveCareer', 'finishMustering'])) {
    actions.push({ label: 'Muster out', continueCareer: false })
  }

  if (availableActionKeys && actions.length === 0) return null

  return {
    title,
    message: formatCharacterCreationReenlistmentOutcome(plan),
    actions
  }
}

export const deriveCharacterCreationMusteringOutViewModel = (
  flow: CharacterCreationFlow,
  {
    musteringBenefitOptions
  }: {
    musteringBenefitOptions?: readonly MusteringBenefitActionOption[]
  } = {}
): CharacterCreationMusteringOutViewModel => {
  const remaining = remainingMusteringBenefits(flow.draft)
  const summary =
    flow.draft.completedTerms.length === 0
      ? 'No career terms completed yet.'
      : remaining > 0
        ? `${remaining} benefit ${remaining === 1 ? 'roll' : 'rolls'} remaining.`
        : 'Benefits complete.'
  const benefitActions =
    musteringBenefitOptions?.map((option) => ({
      career: option.career,
      kind: option.kind,
      label: option.kind === 'cash' ? 'Roll cash' : 'Roll benefit'
    })) ??
    ([
      {
        career: flow.draft.completedTerms.at(-1)?.career ?? '',
        kind: 'cash',
        label: 'Roll cash'
      },
      {
        career: flow.draft.completedTerms.at(-1)?.career ?? '',
        kind: 'material',
        label: 'Roll benefit'
      }
    ] satisfies readonly {
      career: string
      kind: BenefitKind
      label: string
    }[])

  return {
    title: 'Mustering out',
    summary,
    benefits: flow.draft.musteringBenefits.map((benefit) => ({
      label: `${benefit.career} ${musteringBenefitKindLabel(benefit.kind)}`,
      valueLabel: musteringBenefitValueLabel(benefit),
      rollLabel: musteringBenefitRollLabel(benefit),
      metaLabel:
        benefit.kind === 'cash'
          ? 'Credits'
          : (benefit.materialItem ?? benefit.value)
    })),
    actions: benefitActions.map(({ career, kind, label }) => {
      const modifier = characterCreationMusteringBenefitRollModifier({
        draft: flow.draft,
        kind
      })
      const disabled =
        !musteringBenefitOptions &&
        (remaining <= 0 ||
          !canRollCharacterCreationMusteringBenefit({
            draft: flow.draft,
            kind
          }))
      return {
        career,
        kind,
        label,
        disabled,
        title: modifier === 0 ? '' : `${modifier > 0 ? '+' : ''}${modifier} DM`
      }
    })
  }
}

export const deriveCharacterCreationFieldViewModels = (
  flow: CharacterCreationFlow,
  step: CharacterCreationViewStep = flow.step,
  options: Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): CharacterCreationFieldViewModel[] => {
  const validation = validationForStep(flow, step, options)
  const { draft } = flow

  switch (step) {
    case 'basics':
      return [
        {
          key: 'name',
          label: 'Name',
          kind: 'text',
          step,
          value: draft.name,
          required: true,
          errors: fieldErrors(validation.errors, 'name')
        },
        {
          key: 'characterType',
          label: 'Type',
          kind: 'select',
          step,
          value: draft.characterType,
          required: true,
          errors: []
        }
      ]
    case 'characteristics':
      return characteristicDefinitions.map(({ key, label }) => ({
        key,
        label,
        kind: 'number',
        step,
        value: valueText(draft.characteristics[key]),
        required: true,
        errors: fieldErrors(validation.errors, key, key)
      }))
    case 'homeworld': {
      const homeworld = selectedHomeworld(draft)
      return [
        {
          key: 'homeworld.lawLevel',
          label: 'Law level',
          kind: 'text',
          step,
          value: homeworld.lawLevel ?? '',
          required: true,
          errors: fieldErrors(validation.errors, 'homeworld.lawLevel')
        },
        {
          key: 'homeworld.tradeCodes',
          label: 'Trade code',
          kind: 'text',
          step,
          value: selectedTradeCodes(homeworld.tradeCodes).join(', '),
          required: true,
          errors: fieldErrors(validation.errors, 'homeworld.tradeCodes')
        }
      ]
    }
    case 'career': {
      const careerPlan = draft.careerPlan
      const careerDefinition = selectedCareerDefinition(
        careerPlan?.career,
        options.careers
      )
      const requiresCommission =
        careerDefinition !== null &&
        careerPlan?.survivalPassed !== false &&
        parseCareerCheck(careerDefinition.commission) !== null
      const requiresAdvancement =
        careerDefinition !== null &&
        careerPlan?.survivalPassed === true &&
        careerPlan.canCommission === false &&
        parseCareerCheck(careerDefinition.advancement) !== null

      return [
        {
          key: 'career',
          label: 'Career',
          kind: 'select',
          step,
          value: careerPlan?.career ?? '',
          required: true,
          errors: fieldErrors(validation.errors, 'career')
        },
        {
          key: 'qualificationRoll',
          label: 'Qualification roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.qualificationRoll),
          required:
            careerPlan?.drafted !== true &&
            !(
              careerPlan?.qualificationPassed === true &&
              careerPlan.qualificationRoll === null
            ),
          errors: fieldErrors(validation.errors, 'qualificationRoll')
        },
        {
          key: 'survivalRoll',
          label: 'Survival roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.survivalRoll),
          required: true,
          errors: fieldErrors(validation.errors, 'survivalRoll')
        },
        {
          key: 'commissionRoll',
          label: 'Commission roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.commissionRoll),
          required: requiresCommission,
          errors: fieldErrors(validation.errors, 'commissionRoll')
        },
        {
          key: 'advancementRoll',
          label: 'Advancement roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.advancementRoll),
          required: requiresAdvancement,
          errors: fieldErrors(validation.errors, 'advancementRoll')
        }
      ]
    }
    case 'skills':
      return [
        {
          key: 'skills',
          label: 'Skills',
          kind: 'textarea',
          step,
          value: draft.skills.join('\n'),
          required: true,
          errors: fieldErrors(validation.errors, 'skills')
        }
      ]
    case 'equipment':
      return [
        {
          key: 'equipment',
          label: 'Equipment',
          kind: 'textarea',
          step,
          value: equipmentText(draft.equipment),
          required: false,
          errors: fieldErrors(validation.errors, 'equipment')
        },
        {
          key: 'credits',
          label: 'Credits',
          kind: 'number',
          step,
          value: valueText(draft.credits),
          required: false,
          errors: fieldErrors(validation.errors, 'credits')
        },
        {
          key: 'notes',
          label: 'Notes',
          kind: 'textarea',
          step,
          value: draft.notes,
          required: false,
          errors: []
        }
      ]
    case 'review':
      return []
    default: {
      const exhaustive: never = step
      return exhaustive
    }
  }
}

const optionViewModels = (
  values: readonly string[],
  selectedValues: readonly string[]
): CharacterCreationHomeworldOptionViewModel[] => {
  const selected = new Set(selectedValues)
  return values.map((value) => ({
    value,
    label: value,
    selected: selected.has(value)
  }))
}

export const deriveCharacterCreationHomeworldViewModel = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
    homeworldChoiceOptions?: HomeworldChoiceOptions
  } & CharacterCreationViewRulesOptions = {}
): CharacterCreationHomeworldViewModel => {
  const homeworld = selectedHomeworld(flow.draft)
  const tradeCodes = selectedTradeCodes(homeworld.tradeCodes)
  const ruleset = options.ruleset ?? CEPHEUS_SRD_RULESET
  const lawLevels =
    options.homeworldChoiceOptions?.lawLevels ??
    Object.keys(ruleset.homeWorldSkillsByLawLevel)
  const tradeCodeOptions =
    options.homeworldChoiceOptions?.tradeCodes ??
    Object.keys(ruleset.homeWorldSkillsByTradeCode)

  return {
    step: 'homeworld',
    fields: deriveCharacterCreationFieldViewModels(flow, 'homeworld'),
    lawLevelOptions: optionViewModels(
      lawLevels,
      homeworld.lawLevel ? [homeworld.lawLevel] : []
    ),
    tradeCodeOptions: optionViewModels(tradeCodeOptions, tradeCodes),
    summary: homeworldSummaryViewModel(flow, options),
    backgroundSkills: deriveCharacterCreationBackgroundSkillSummary(
      flow,
      options
    ),
    pendingCascadeChoice: pendingCascadeChoiceViewModel(
      flow.draft.pendingCascadeSkills,
      options.backgroundCascadeChoices,
      options
    )
  }
}

export const parseCharacterCreationDraftPatch = (
  values: CharacterCreationFormValues
): CharacterCreationDraftPatch => {
  const patch: CharacterCreationDraftPatch = {}

  if (values.name !== undefined) patch.name = valueText(values.name)
  if (values.characterType !== undefined) {
    const characterType = valueText(values.characterType)
    if (
      characterType === 'PLAYER' ||
      characterType === 'NPC' ||
      characterType === 'ANIMAL' ||
      characterType === 'ROBOT'
    ) {
      patch.characterType = characterType
    }
  }
  if (values.credits !== undefined) {
    patch.credits = parseNumberWithDefault(values.credits, 0)
  }
  if (values.notes !== undefined) patch.notes = valueText(values.notes)
  if (values.skills !== undefined) {
    patch.skills = splitListText(valueText(values.skills))
  }
  if (values.equipment !== undefined) {
    patch.equipment = parseEquipmentText(valueText(values.equipment))
  }
  const careerPlan = parseCareerPlan(values)
  if (careerPlan !== undefined) patch.careerPlan = careerPlan
  const homeworld = parseHomeworld(values)
  if (homeworld !== undefined) patch.homeworld = homeworld

  const characteristics: CharacterCreationDraftPatch['characteristics'] = {}
  for (const { key } of characteristicDefinitions) {
    const value = Object.hasOwn(values, key)
      ? values[key]
      : values[`characteristics.${key}`]
    if (value !== undefined) characteristics[key] = parseOptionalNumber(value)
  }
  if (Object.keys(characteristics).length > 0) {
    patch.characteristics = characteristics
  }

  return patch
}

export const equipmentText = (
  equipment: readonly CharacterEquipmentItem[]
): string =>
  equipment
    .map((item) => [item.name, item.quantity, item.notes].join(' | '))
    .join('\n')

const itemValue = (value: string | number | null): string =>
  value === null || value === '' ? 'Not set' : String(value)

const outcomeValue = (
  roll: number | null | undefined,
  passed: boolean | null | undefined,
  unavailableLabel = 'Not set'
): string => {
  if (roll === null || roll === undefined) return unavailableLabel
  if (roll === -1) return 'Skipped'
  if (passed === true) return `${roll} (passed)`
  if (passed === false) return `${roll} (failed)`
  return `${roll} (not evaluated)`
}

const careerReviewItems = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationReviewItem[] => {
  const careerPlan = draft.careerPlan
  const completedTerm = draft.completedTerms.at(-1)
  const career = careerPlan?.career.trim() || completedTerm?.career || ''

  return [
    { label: 'Career', value: itemValue(career) },
    {
      label: 'Qualification',
      value: outcomeValue(
        careerPlan?.qualificationRoll ?? completedTerm?.qualificationRoll,
        careerPlan?.qualificationPassed ??
          (completedTerm ? completedTerm.qualificationRoll !== null : null)
      )
    },
    {
      label: 'Survival',
      value: outcomeValue(
        careerPlan?.survivalRoll ?? completedTerm?.survivalRoll,
        careerPlan?.survivalPassed ?? completedTerm?.survivalPassed
      )
    },
    {
      label: 'Commission',
      value: outcomeValue(
        careerPlan?.commissionRoll ?? completedTerm?.commissionRoll,
        careerPlan?.commissionPassed ?? completedTerm?.commissionPassed,
        (careerPlan?.canCommission ?? completedTerm?.canCommission) === false
          ? 'Not available'
          : 'Not set'
      )
    },
    {
      label: 'Advancement',
      value: outcomeValue(
        careerPlan?.advancementRoll ?? completedTerm?.advancementRoll,
        careerPlan?.advancementPassed ?? completedTerm?.advancementPassed,
        (careerPlan?.canAdvance ?? completedTerm?.canAdvance) === false
          ? 'Not available'
          : 'Not set'
      )
    }
  ]
}

const termHistoryReviewItems = (
  completedTerms: readonly CharacterCreationCompletedTerm[]
): CharacterCreationReviewItem[] => {
  if (completedTerms.length === 0) {
    return [{ label: 'Terms', value: 'Not recorded' }]
  }

  return completedTerms.map((term, index) => ({
    label: `Term ${index + 1}`,
    value: [
      term.career,
      term.drafted ? 'drafted' : null,
      term.survivalPassed ? 'survived' : 'killed in service',
      term.commissionPassed === true ? 'commissioned' : null,
      term.advancementPassed === true ? 'advanced' : null,
      term.rankTitle ? `rank ${term.rankTitle}` : null,
      term.rankBonusSkill ? `rank skill ${term.rankBonusSkill}` : null,
      (term.termSkillRolls ?? []).length > 0
        ? `training ${(term.termSkillRolls ?? [])
            .map((roll) => `${roll.skill} (${roll.roll})`)
            .join(', ')}`
        : null,
      term.anagathics === true ? 'anagathics' : null,
      term.agingRoll != null
        ? `aging ${term.agingRoll}${
            term.agingMessage ? ` ${term.agingMessage}` : ''
          }`
        : null
    ]
      .filter(Boolean)
      .join(', ')
  }))
}

const musteringReviewItems = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationReviewItem[] => {
  if (draft.musteringBenefits.length === 0) {
    return [{ label: 'Benefits', value: 'Not rolled' }]
  }

  return draft.musteringBenefits.map((benefit, index) => ({
    label: `Benefit ${index + 1}`,
    value: `${formatCharacterCreationMusteringBenefitSummary(benefit)} (${musteringBenefitRollLabel(benefit)})`
  }))
}

const careerCheckViewModel = ({
  label,
  requirement,
  characteristics
}: {
  label: string
  requirement: string
  characteristics: Partial<CharacterCharacteristics>
}): CharacterCreationCareerCheckViewModel => {
  const check = parseCareerCheck(requirement)

  return {
    label,
    requirement,
    available: check !== null,
    characteristic: check?.characteristic ?? null,
    target: check?.target ?? null,
    modifier:
      check?.characteristic === undefined || check.characteristic === null
        ? 0
        : characteristicModifier(characteristics[check.characteristic])
  }
}

export const deriveCharacterCreationCareerOptionViewModels = (
  draft: Pick<CharacterCreationFlow['draft'], 'careerPlan' | 'characteristics'>,
  careers: readonly CepheusCareerDefinition[] = CEPHEUS_SRD_CAREERS
): CharacterCreationCareerOptionViewModel[] =>
  careers.map((career) => ({
    key: career.name,
    label: career.name,
    selected: draft.careerPlan?.career === career.name,
    qualification: careerCheckViewModel({
      label: 'Qualification',
      requirement: career.qualification,
      characteristics: draft.characteristics
    }),
    survival: careerCheckViewModel({
      label: 'Survival',
      requirement: career.survival,
      characteristics: draft.characteristics
    }),
    commission: careerCheckViewModel({
      label: 'Commission',
      requirement: career.commission,
      characteristics: draft.characteristics
    }),
    advancement: careerCheckViewModel({
      label: 'Advancement',
      requirement: career.advancement,
      characteristics: draft.characteristics
    })
  }))

const projectedCareerOptionViewModels = (
  options: CareerChoiceOptions
): CharacterCreationCareerOptionViewModel[] =>
  options.careers.map((career) => ({
    key: career.key,
    label: career.label,
    selected: career.selected,
    qualification: { ...career.qualification },
    survival: { ...career.survival },
    commission: { ...career.commission },
    advancement: { ...career.advancement }
  }))

export const deriveCharacterCreationFailedQualificationViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  {
    failedQualificationOptions
  }: {
    failedQualificationOptions?: readonly FailedQualificationActionOption[]
  } = {}
): CharacterCreationFailedQualificationViewModel => {
  const plan = flow.draft.careerPlan
  const open =
    flow.step === 'career' &&
    plan?.qualificationPassed === false &&
    plan.drafted !== true &&
    failedQualificationOptions?.length !== 0
  const actionOptions =
    failedQualificationOptions ??
    deriveFailedQualificationOptions({
      canEnterDraft: !flow.draft.completedTerms.some((term) => term.drafted)
    }).map((option) => ({
      option,
      ...(option === 'Draft'
        ? { rollRequirement: { key: 'draft' as const, dice: '1d6' as const } }
        : {})
    }))
  const options = open
    ? actionOptions.map(({ option, rollRequirement }) => ({
        option,
        label: option,
        actionLabel: option === 'Draft' ? 'Roll draft' : 'Become a Drifter',
        rollRequirement: rollRequirement?.dice ?? null
      }))
    : []

  return {
    open,
    title: 'Qualification failed',
    message: 'Choose Drifter or roll for the Draft.',
    options
  }
}

export const deriveCharacterCreationCareerSelectionViewModel = (
  flow: CharacterCreationFlow,
  {
    careerChoiceOptions,
    failedQualificationOptions,
    careers
  }: {
    careerChoiceOptions?: CareerChoiceOptions
    failedQualificationOptions?: readonly FailedQualificationActionOption[]
  } & Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): CharacterCreationCareerSelectionViewModel | null => {
  if (flow.step !== 'career') return null

  const plan = flow.draft.careerPlan
  const hiddenFields = Object.entries({
    career: plan?.career ?? '',
    drafted: plan?.drafted ? 'true' : 'false',
    qualificationPassed:
      plan?.qualificationPassed === null ||
      plan?.qualificationPassed === undefined
        ? ''
        : String(plan.qualificationPassed),
    qualificationRoll: plan?.qualificationRoll ?? '',
    survivalRoll: plan?.survivalRoll ?? '',
    commissionRoll: plan?.commissionRoll ?? '',
    advancementRoll: plan?.advancementRoll ?? ''
  }).map(([key, value]) => ({
    key,
    value: value === null ? '' : String(value)
  }))

  return {
    open: true,
    hiddenFields,
    outcomeTitle: plan?.career ? `${plan.career} term` : 'Choose a career',
    outcomeText: formatCharacterCreationCareerOutcome(plan),
    showCareerList: !plan?.career,
    careerOptions: careerChoiceOptions
      ? projectedCareerOptionViewModels(careerChoiceOptions)
      : deriveCharacterCreationCareerOptionViewModels(flow.draft, careers),
    failedQualification: deriveCharacterCreationFailedQualificationViewModel(
      flow,
      { failedQualificationOptions }
    )
  }
}

export const deriveCharacterCreationReviewSummary = (
  flow: CharacterCreationFlow,
  {
    completedTerms = flow.draft.completedTerms
  }: { completedTerms?: readonly CharacterCreationCompletedTerm[] } = {}
): CharacterCreationReviewSummary => {
  const { draft } = flow
  const skills = draft.skills.length > 0 ? draft.skills.join(', ') : 'Not set'
  const equipment =
    draft.equipment.length > 0
      ? draft.equipment
          .map((item) => `${item.name} x${item.quantity}`)
          .join(', ')
      : 'None'

  return {
    title: draft.name.trim() || 'Unnamed character',
    subtitle: draft.characterType,
    sections: [
      {
        key: 'basics',
        label: characterCreationStepLabels.basics,
        items: [
          { label: 'Name', value: itemValue(draft.name.trim()) },
          { label: 'Type', value: draft.characterType },
          { label: 'Age', value: itemValue(draft.age) }
        ]
      },
      {
        key: 'characteristics',
        label: characterCreationStepLabels.characteristics,
        items: characteristicDefinitions.map(({ key, label }) => ({
          label,
          value: itemValue(draft.characteristics[key])
        }))
      },
      {
        key: 'career',
        label: characterCreationStepLabels.career,
        items: careerReviewItems(draft)
      },
      {
        key: 'career-history',
        label: 'Terms',
        items: termHistoryReviewItems(completedTerms)
      },
      {
        key: 'skills',
        label: characterCreationStepLabels.skills,
        items: [{ label: 'Skills', value: skills }]
      },
      {
        key: 'mustering-out',
        label: 'Mustering out',
        items: musteringReviewItems(draft)
      },
      {
        key: 'equipment',
        label: characterCreationStepLabels.equipment,
        items: [
          { label: 'Equipment', value: equipment },
          { label: 'Credits', value: itemValue(draft.credits) },
          { label: 'Notes', value: itemValue(draft.notes.trim()) }
        ]
      }
    ]
  }
}

export const deriveCharacterCreationTermHistoryViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationTermHistoryViewModel | null => {
  if (flow.draft.completedTerms.length === 0) return null

  return {
    title: 'Terms served',
    terms: flow.draft.completedTerms.map((term, index) =>
      formatCharacterCreationCompletedTermSummary(term, index)
    )
  }
}
