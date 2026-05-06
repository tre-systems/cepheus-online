import type { Command } from '../../shared/commands'
import {
  deriveBasicTrainingPlan,
  evaluateCareerCheck,
  parseCareerRankReward,
  parseCareerCheck
} from '../../shared/character-creation/career-rules.js'
import {
  CEPHEUS_SRD_RULESET,
  CEPHEUS_SRD_CAREERS,
  type CepheusCareerDefinition
} from '../../shared/character-creation/cepheus-srd-ruleset.js'
import {
  canRollCashBenefit,
  deriveCashBenefitRollModifier,
  deriveMaterialBenefitRollModifier,
  deriveRemainingCareerBenefits,
  resolveCareerBenefit
} from '../../shared/character-creation/benefits.js'
import { resolveAging } from '../../shared/character-creation/aging.js'
import { deriveAgingRollModifier } from '../../shared/character-creation/term-lifecycle.js'
import type {
  AgingChange,
  AgingChangeType,
  BenefitKind
} from '../../shared/character-creation/types.js'
import {
  deriveBackgroundSkillPlan,
  deriveTotalBackgroundSkillAllowance,
  hasBackgroundHomeworld,
  type BackgroundHomeworld,
  type BackgroundSkillPlan
} from '../../shared/character-creation/background-skills.js'
import {
  careerSkillWithLevel,
  formatCareerSkill,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  parseCareerSkill,
  resolveCascadeCareerSkill
} from '../../shared/character-creation/skills.js'
import type { CharacterId } from '../../shared/ids'
import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacteristicKey,
  CharacterSheetPatch,
  CharacterType,
  GameState
} from '../../shared/state'
import { buildSequencedCommand, type ClientIdentity } from '../game-commands.js'
import { uniqueCharacterId } from './bootstrap-flow.js'

export type CharacterCreationStep =
  | 'basics'
  | 'characteristics'
  | 'homeworld'
  | 'career'
  | 'skills'
  | 'equipment'
  | 'review'

export const CHARACTER_CREATION_STARTING_AGE = 18

export interface CharacterCreationCareerPlan {
  career: string
  qualificationRoll: number | null
  qualificationPassed: boolean | null
  survivalRoll: number | null
  survivalPassed: boolean | null
  commissionRoll: number | null
  commissionPassed: boolean | null
  advancementRoll: number | null
  advancementPassed: boolean | null
  canCommission: boolean | null
  canAdvance: boolean | null
  drafted: boolean
  rank?: number | null
  rankTitle?: string | null
  rankBonusSkill?: string | null
  termSkillRolls?: CharacterCreationTermSkillRoll[]
  agingRoll?: number | null
  agingMessage?: string | null
  agingSelections?: CharacterCreationAgingSelection[]
  reenlistmentRoll?: number | null
  reenlistmentOutcome?: CharacterCreationReenlistmentOutcome | null
}

export type CharacterCreationReenlistmentOutcome =
  | 'forced'
  | 'allowed'
  | 'blocked'
  | 'retire'

export type CharacterCreationTermSkillTable =
  | 'personalDevelopment'
  | 'serviceSkills'
  | 'specialistSkills'
  | 'advancedEducation'

export interface CharacterCreationTermSkillRoll {
  table: CharacterCreationTermSkillTable
  roll: number
  skill: string
}

export interface CharacterCreationCompletedTerm {
  career: string
  drafted: boolean
  anagathics?: boolean
  age: number | null
  rank?: number | null
  rankTitle?: string | null
  rankBonusSkill?: string | null
  qualificationRoll: number | null
  survivalRoll: number | null
  survivalPassed: boolean
  canCommission: boolean
  commissionRoll: number | null
  commissionPassed: boolean | null
  canAdvance: boolean
  advancementRoll: number | null
  advancementPassed: boolean | null
  termSkillRolls?: CharacterCreationTermSkillRoll[]
  agingRoll?: number | null
  agingMessage?: string | null
  agingSelections?: CharacterCreationAgingSelection[]
  reenlistmentRoll?: number | null
  reenlistmentOutcome?: CharacterCreationReenlistmentOutcome | null
}

export interface CharacterCreationAgingSelection {
  type: AgingChangeType
  modifier: number
  characteristic: CharacteristicKey
}

export interface CharacterCreationMusteringBenefit {
  career: string
  kind: BenefitKind
  roll: number
  value: string
  credits: number
}

export interface CharacterCreationDraft {
  characterId: CharacterId
  characterType: CharacterType
  name: string
  age: number | null
  characteristics: CharacterCharacteristics
  homeworld: BackgroundHomeworld
  backgroundSkills: string[]
  pendingCascadeSkills: string[]
  pendingTermCascadeSkills: string[]
  pendingAgingChanges: AgingChange[]
  careerPlan: CharacterCreationCareerPlan | null
  completedTerms: CharacterCreationCompletedTerm[]
  musteringBenefits: CharacterCreationMusteringBenefit[]
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
  notes: string
}

export interface CharacterCreationFlow {
  step: CharacterCreationStep
  draft: CharacterCreationDraft
}

export interface CharacterCreationValidation {
  ok: boolean
  step: CharacterCreationStep
  errors: string[]
}

export interface CharacterCreationCommandOptions {
  identity: ClientIdentity
  state?: Pick<GameState, 'eventSeq'> | null
}

export interface ManualCharacterCreationFlowOptions {
  state?: Pick<GameState, 'characters'> | null
  name?: string | null
  characterType?: CharacterType
}

export interface CharacterCreationWizardResult {
  flow: CharacterCreationFlow
  validation: CharacterCreationValidation
  moved: boolean
}

export type CharacterCreationCareerRollKey =
  | 'qualificationRoll'
  | 'survivalRoll'
  | 'commissionRoll'
  | 'advancementRoll'

export type CharacterCreationCharacteristicRollKey = CharacteristicKey

export interface CharacterCreationCharacteristicRollAction {
  key: CharacterCreationCharacteristicRollKey
  label: string
  reason: string
}

export interface CharacterCreationCareerRollAction {
  key: CharacterCreationCareerRollKey
  label: string
  reason: string
}

export interface CharacterCreationCareerSkipAction {
  key: 'commissionRoll' | 'advancementRoll'
  label: string
}

export interface CharacterCreationBasicTrainingAction {
  label: string
  reason: string
  skills: string[]
  kind: 'all' | 'choose-one' | 'none'
}

export interface CharacterCreationTermSkillTableAction {
  table: CharacterCreationTermSkillTable
  label: string
  reason: string
  disabled: boolean
}

export interface CharacterCreationReenlistmentRollAction {
  label: string
  reason: string
}

export interface CharacterCreationAgingRollAction {
  label: string
  reason: string
  modifier: number
}

export type CharacterCreationDraftPatch = Partial<
  Omit<
    CharacterCreationDraft,
    | 'characteristics'
    | 'homeworld'
    | 'backgroundSkills'
    | 'pendingCascadeSkills'
    | 'pendingTermCascadeSkills'
    | 'pendingAgingChanges'
    | 'careerPlan'
    | 'completedTerms'
    | 'musteringBenefits'
    | 'skills'
    | 'equipment'
  >
> & {
  characteristics?: Partial<CharacterCharacteristics>
  homeworld?: BackgroundHomeworld | null
  backgroundSkills?: readonly string[]
  pendingCascadeSkills?: readonly string[]
  pendingTermCascadeSkills?: readonly string[]
  pendingAgingChanges?: readonly AgingChange[]
  careerPlan?: CharacterCreationCareerPlan | null
  completedTerms?: readonly CharacterCreationCompletedTerm[]
  musteringBenefits?: readonly CharacterCreationMusteringBenefit[]
  skills?: readonly string[]
  equipment?: readonly CharacterEquipmentItem[]
}

type CreateCharacterCommand = Extract<Command, { type: 'CreateCharacter' }>
type StartCharacterCreationCommand = Extract<
  Command,
  { type: 'StartCharacterCreation' }
>
type AdvanceCharacterCreationCommand = Extract<
  Command,
  { type: 'AdvanceCharacterCreation' }
>
type SetCharacterCreationHomeworldCommand = Extract<
  Command,
  { type: 'SetCharacterCreationHomeworld' }
>
type SelectCharacterCreationBackgroundSkillCommand = Extract<
  Command,
  { type: 'SelectCharacterCreationBackgroundSkill' }
>
type ResolveCharacterCreationCascadeSkillCommand = Extract<
  Command,
  { type: 'ResolveCharacterCreationCascadeSkill' }
>
type StartCharacterCareerTermCommand = Extract<
  Command,
  { type: 'StartCharacterCareerTerm' }
>
type UpdateCharacterSheetCommand = Extract<
  Command,
  { type: 'UpdateCharacterSheet' }
>
type FinalizeCharacterCreationCommand = Extract<
  Command,
  { type: 'FinalizeCharacterCreation' }
>

const CHARACTER_CREATION_STEPS = [
  'basics',
  'characteristics',
  'homeworld',
  'career',
  'skills',
  'equipment',
  'review'
] satisfies CharacterCreationStep[]

const CHARACTERISTIC_KEYS = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
] satisfies CharacteristicKey[]

const emptyCharacteristics = (): CharacterCharacteristics => ({
  str: null,
  dex: null,
  end: null,
  int: null,
  edu: null,
  soc: null
})

const emptyHomeworld = (): BackgroundHomeworld => ({
  lawLevel: null,
  tradeCodes: []
})

const createCareerPlan = (
  overrides: Partial<CharacterCreationCareerPlan> = {}
): CharacterCreationCareerPlan => ({
  career: overrides.career ?? '',
  qualificationRoll: overrides.qualificationRoll ?? null,
  qualificationPassed: overrides.qualificationPassed ?? null,
  survivalRoll: overrides.survivalRoll ?? null,
  survivalPassed: overrides.survivalPassed ?? null,
  commissionRoll: overrides.commissionRoll ?? null,
  commissionPassed: overrides.commissionPassed ?? null,
  advancementRoll: overrides.advancementRoll ?? null,
  advancementPassed: overrides.advancementPassed ?? null,
  canCommission: overrides.canCommission ?? null,
  canAdvance: overrides.canAdvance ?? null,
  drafted: overrides.drafted ?? false,
  rank: overrides.rank ?? null,
  rankTitle: overrides.rankTitle ?? null,
  rankBonusSkill: overrides.rankBonusSkill ?? null,
  termSkillRolls: cloneTermSkillRolls(overrides.termSkillRolls ?? []),
  agingRoll: overrides.agingRoll ?? null,
  agingMessage: overrides.agingMessage ?? null,
  agingSelections: cloneAgingSelections(overrides.agingSelections ?? []),
  reenlistmentRoll: overrides.reenlistmentRoll ?? null,
  reenlistmentOutcome: overrides.reenlistmentOutcome ?? null
})

const cloneTermSkillRolls = (
  rolls: readonly CharacterCreationTermSkillRoll[]
): CharacterCreationTermSkillRoll[] =>
  rolls.map((roll) => ({
    table: roll.table,
    roll: roll.roll,
    skill: roll.skill
  }))

const cloneAgingChanges = (
  changes: readonly AgingChange[]
): AgingChange[] =>
  changes.map((change) => ({
    type: change.type,
    modifier: change.modifier
  }))

const cloneAgingSelections = (
  selections: readonly CharacterCreationAgingSelection[]
): CharacterCreationAgingSelection[] =>
  selections.map((selection) => ({
    type: selection.type,
    modifier: selection.modifier,
    characteristic: selection.characteristic
  }))

const cloneCareerPlan = (
  plan: CharacterCreationCareerPlan | null
): CharacterCreationCareerPlan | null =>
  plan
    ? {
        career: plan.career,
        qualificationRoll: plan.qualificationRoll,
        qualificationPassed: plan.qualificationPassed,
        survivalRoll: plan.survivalRoll,
        survivalPassed: plan.survivalPassed,
        commissionRoll: plan.commissionRoll,
        commissionPassed: plan.commissionPassed,
        advancementRoll: plan.advancementRoll,
        advancementPassed: plan.advancementPassed,
        canCommission: plan.canCommission,
        canAdvance: plan.canAdvance,
        drafted: plan.drafted,
        rank: plan.rank ?? null,
        rankTitle: plan.rankTitle ?? null,
        rankBonusSkill: plan.rankBonusSkill ?? null,
        termSkillRolls: cloneTermSkillRolls(plan.termSkillRolls ?? []),
        agingRoll: plan.agingRoll ?? null,
        agingMessage: plan.agingMessage ?? null,
        agingSelections: cloneAgingSelections(plan.agingSelections ?? []),
        reenlistmentRoll: plan.reenlistmentRoll ?? null,
        reenlistmentOutcome: plan.reenlistmentOutcome ?? null
      }
    : null

const normalizeCareerPlan = (
  plan: CharacterCreationCareerPlan | null | undefined
): CharacterCreationCareerPlan | null =>
  plan
    ? createCareerPlan({
        ...plan,
        career: plan.career.trim()
      })
    : null

const cloneEquipment = (
  equipment: readonly CharacterEquipmentItem[]
): CharacterEquipmentItem[] =>
  equipment.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    notes: item.notes
  }))

const cloneCompletedTerms = (
  terms: readonly CharacterCreationCompletedTerm[]
): CharacterCreationCompletedTerm[] =>
  terms.map((term) => ({
    career: term.career,
    drafted: term.drafted,
    ...(term.anagathics === true ? { anagathics: true } : {}),
    age: term.age,
    ...(term.rank != null ? { rank: term.rank } : {}),
    ...(term.rankTitle != null ? { rankTitle: term.rankTitle } : {}),
    ...(term.rankBonusSkill != null
      ? { rankBonusSkill: term.rankBonusSkill }
      : {}),
    qualificationRoll: term.qualificationRoll,
    survivalRoll: term.survivalRoll,
    survivalPassed: term.survivalPassed,
    canCommission: term.canCommission,
    commissionRoll: term.commissionRoll,
    commissionPassed: term.commissionPassed,
    canAdvance: term.canAdvance,
    advancementRoll: term.advancementRoll,
    advancementPassed: term.advancementPassed,
    termSkillRolls: cloneTermSkillRolls(term.termSkillRolls ?? []),
    agingRoll: term.agingRoll ?? null,
    agingMessage: term.agingMessage ?? null,
    agingSelections: cloneAgingSelections(term.agingSelections ?? []),
    reenlistmentRoll: term.reenlistmentRoll ?? null,
    reenlistmentOutcome: term.reenlistmentOutcome ?? null
  }))

const cloneMusteringBenefits = (
  benefits: readonly CharacterCreationMusteringBenefit[]
): CharacterCreationMusteringBenefit[] =>
  benefits.map((benefit) => ({
    career: benefit.career,
    kind: benefit.kind,
    roll: benefit.roll,
    value: benefit.value,
    credits: benefit.credits
  }))

const cloneHomeworld = (
  homeworld: BackgroundHomeworld
): BackgroundHomeworld => ({
  lawLevel: homeworld.lawLevel ?? null,
  tradeCodes: Array.isArray(homeworld.tradeCodes)
    ? [...homeworld.tradeCodes]
    : (homeworld.tradeCodes ?? [])
})

const homeworldTradeCodes = (homeworld: BackgroundHomeworld): string[] => {
  if (typeof homeworld.tradeCodes === 'string') return [homeworld.tradeCodes]
  if (Array.isArray(homeworld.tradeCodes)) return [...homeworld.tradeCodes]
  return []
}

const sameHomeworld = (
  left: BackgroundHomeworld,
  right: BackgroundHomeworld
): boolean => {
  const leftCodes = homeworldTradeCodes(left)
  const rightCodes = homeworldTradeCodes(right)
  return (
    (left.lawLevel ?? null) === (right.lawLevel ?? null) &&
    leftCodes.length === rightCodes.length &&
    leftCodes.every((code, index) => code === rightCodes[index])
  )
}

const normalizeSkillList = (skills: readonly string[]): string[] => {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const rawSkill of skills) {
    const skill = rawSkill.trim()
    const key = skill.toLowerCase()
    if (!skill || seen.has(key)) continue
    normalized.push(skill)
    seen.add(key)
  }

  return normalized
}

const normalizeBackgroundSkillList = (skills: readonly string[]): string[] =>
  normalizeSkillList(
    skills
      .map((skill) => normalizeCareerSkill(skill, 0))
      .filter((skill): skill is string => skill !== null)
  )

const normalizePendingCascadeSkillList = (
  skills: readonly string[]
): string[] =>
  normalizeSkillList(
    skills
      .map((skill) =>
        isCascadeCareerSkill(skill)
          ? careerSkillWithLevel(skill, 0)
          : normalizeCareerSkill(skill, 0)
      )
      .filter((skill): skill is string => skill !== null)
  )

const normalizeEquipmentList = (
  equipment: readonly CharacterEquipmentItem[]
): CharacterEquipmentItem[] => {
  const normalized: CharacterEquipmentItem[] = []

  for (const item of equipment) {
    const name = item.name.trim()
    if (!name) continue
    normalized.push({
      name,
      quantity:
        Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
      notes: item.notes.trim()
    })
  }

  return normalized
}

const normalizeHomeworld = (
  homeworld: BackgroundHomeworld | null | undefined
): BackgroundHomeworld => {
  if (!homeworld) return emptyHomeworld()

  const lawLevel = homeworld.lawLevel?.trim() || null
  const rawTradeCodes = Array.isArray(homeworld.tradeCodes)
    ? homeworld.tradeCodes
    : homeworld.tradeCodes
      ? [homeworld.tradeCodes]
      : []
  const tradeCodes: string[] = []
  const seen = new Set<string>()

  for (const rawTradeCode of rawTradeCodes) {
    const tradeCode = rawTradeCode.trim()
    const key = tradeCode.toLowerCase()
    if (!tradeCode || seen.has(key)) continue
    tradeCodes.push(tradeCode)
    seen.add(key)
  }

  return { lawLevel, tradeCodes }
}

const hasHomeworldTradeCodes = (homeworld: BackgroundHomeworld): boolean =>
  Array.isArray(homeworld.tradeCodes)
    ? homeworld.tradeCodes.length > 0
    : Boolean(homeworld.tradeCodes)

const isFiniteNonNegativeNumber = (value: number) =>
  Number.isFinite(value) && value >= 0

const stepIndex = (step: CharacterCreationStep): number =>
  CHARACTER_CREATION_STEPS.indexOf(step)

const defaultManualCharacterName = (
  state: Pick<GameState, 'characters'> | null
): string => `Character ${Object.keys(state?.characters || {}).length + 1}`

const sequenceCommandAt = <T extends Command>(
  command: T,
  state: Pick<GameState, 'eventSeq'> | null,
  offset: number
): T => {
  if (
    !state ||
    command.expectedSeq !== undefined ||
    command.type === 'CreateGame'
  ) {
    return command
  }

  return {
    ...command,
    expectedSeq: state.eventSeq + offset
  }
}

const validateBasics = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Name is required')
  if (draft.age !== null && !isFiniteNonNegativeNumber(draft.age)) {
    errors.push('Age must be a non-negative number')
  }
  return errors
}

const validateCharacteristics = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []

  for (const key of CHARACTERISTIC_KEYS) {
    const value = draft.characteristics[key]
    if (value === null) {
      errors.push(`${key.toUpperCase()} is required`)
    } else if (!Number.isFinite(value)) {
      errors.push(`${key.toUpperCase()} must be a finite number`)
    }
  }

  return errors
}

const validateHomeworld = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []
  if (!draft.homeworld.lawLevel) {
    errors.push('Homeworld law level is required')
  }
  if (!hasHomeworldTradeCodes(draft.homeworld)) {
    errors.push('Homeworld trade code is required')
  }
  const selectedCount =
    draft.backgroundSkills.length + draft.pendingCascadeSkills.length
  const requiredCount = requiredBackgroundSkillSelections(draft)
  if (draft.pendingCascadeSkills.length > 0) {
    errors.push('Pending background cascade skills must be resolved')
  }
  if (selectedCount < requiredCount) {
    errors.push('Required background skill selections are incomplete')
  }
  return errors
}

const validateCareer = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []
  const plan = draft.careerPlan
  if (!plan?.career.trim()) {
    errors.push('Career is required')
    return errors
  }
  const hasStartedTerm =
    plan.drafted || plan.qualificationRoll !== null
  if (hasStartedTerm && deriveNextCharacterCreationCareerRoll({ draft })) {
    errors.push('Career term rolls are incomplete')
  }
  const termResolved = hasStartedTerm && isCharacterCreationCareerTermResolved(draft)
  const termRecorded = draft.completedTerms.some(
    (term) =>
      term.career === plan.career.trim() &&
      term.drafted === plan.drafted &&
      term.qualificationRoll === plan.qualificationRoll &&
      term.survivalRoll === plan.survivalRoll &&
      term.survivalPassed === (plan.survivalPassed === true) &&
      term.commissionRoll === plan.commissionRoll &&
      term.commissionPassed === plan.commissionPassed &&
      term.advancementRoll === plan.advancementRoll &&
      term.advancementPassed === plan.advancementPassed &&
      (term.agingRoll ?? null) === (plan.agingRoll ?? null) &&
      term.reenlistmentRoll === (plan.reenlistmentRoll ?? null) &&
      term.reenlistmentOutcome === (plan.reenlistmentOutcome ?? null)
  )
  if (termResolved && !termRecorded) {
    errors.push('Career term must be completed')
  }
  if (
    termResolved &&
    !termRecorded &&
    remainingCharacterCreationTermSkillRolls(draft) > 0
  ) {
    errors.push('Career term skill rolls are incomplete')
  }
  if (termResolved && draft.pendingTermCascadeSkills.length > 0) {
    errors.push('Pending career cascade skills must be resolved')
  }
  if (termResolved && draft.pendingAgingChanges.length > 0) {
    errors.push('Pending aging characteristic changes must be resolved')
  }
  if (
    termResolved &&
    !termRecorded &&
    plan.survivalPassed === true &&
    remainingCharacterCreationTermSkillRolls(draft) === 0 &&
    draft.pendingTermCascadeSkills.length === 0 &&
    draft.pendingAgingChanges.length === 0 &&
    requiresCharacterCreationAgingRoll(draft) &&
    plan.agingRoll === null
  ) {
    errors.push('Aging roll is incomplete')
  }
  if (
    termResolved &&
    !termRecorded &&
    plan.survivalPassed === true &&
    remainingCharacterCreationTermSkillRolls(draft) === 0 &&
    draft.pendingTermCascadeSkills.length === 0 &&
    draft.pendingAgingChanges.length === 0 &&
    (!requiresCharacterCreationAgingRoll(draft) || plan.agingRoll !== null) &&
    plan.reenlistmentOutcome === null &&
    !flowlessTermCountRequiresRetirement(draft)
  ) {
    errors.push('Reenlistment roll is incomplete')
  }
  return errors
}

const validateSkills = (draft: CharacterCreationDraft): string[] =>
  draft.skills.length === 0 ? ['At least one skill is required'] : []

const validateEquipment = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []
  if (!isFiniteNonNegativeNumber(draft.credits)) {
    errors.push('Credits must be a non-negative number')
  }
  if (remainingMusteringBenefits(draft) > 0) {
    errors.push('Mustering out benefits are incomplete')
  }

  for (const [index, item] of draft.equipment.entries()) {
    if (!item.name.trim()) errors.push(`Equipment ${index + 1} needs a name`)
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push(`Equipment ${index + 1} quantity must be positive`)
    }
  }

  return errors
}

const validationErrorsForStep = (
  step: CharacterCreationStep,
  draft: CharacterCreationDraft
): string[] => {
  switch (step) {
    case 'basics':
      return validateBasics(draft)
    case 'characteristics':
      return validateCharacteristics(draft)
    case 'homeworld':
      return validateHomeworld(draft)
    case 'career':
      return validateCareer(draft)
    case 'skills':
      return validateSkills(draft)
    case 'equipment':
      return validateEquipment(draft)
    case 'review':
      return [
        ...validateBasics(draft),
        ...validateCharacteristics(draft),
        ...validateHomeworld(draft),
        ...validateCareer(draft),
        ...validateSkills(draft),
        ...validateEquipment(draft)
      ]
    default: {
      const exhaustive: never = step
      return [`Unsupported step ${exhaustive}`]
    }
  }
}

export const characterCreationSteps = (): CharacterCreationStep[] => [
  ...CHARACTER_CREATION_STEPS
]

export const createInitialCharacterDraft = (
  characterId: CharacterId,
  overrides: Partial<CharacterCreationDraft> = {}
): CharacterCreationDraft => {
  const characteristics = {
    ...emptyCharacteristics(),
    ...(overrides.characteristics ?? {})
  }
  const homeworld = normalizeHomeworld(overrides.homeworld)
  const backgroundPlan = deriveCharacterCreationBackgroundSkillPlan({
    characteristics,
    homeworld
  })
  const completedTerms = cloneCompletedTerms(overrides.completedTerms ?? [])

  return {
    characterId,
    characterType: overrides.characterType ?? 'PLAYER',
    name: overrides.name ?? '',
    age:
      overrides.age ??
      CHARACTER_CREATION_STARTING_AGE + completedTerms.length * 4,
    characteristics,
    homeworld,
    backgroundSkills:
      overrides.backgroundSkills === undefined
        ? backgroundPlan.backgroundSkills
        : normalizeBackgroundSkillList(overrides.backgroundSkills),
    pendingCascadeSkills:
      overrides.pendingCascadeSkills === undefined
        ? backgroundPlan.pendingCascadeSkills
        : normalizePendingCascadeSkillList(overrides.pendingCascadeSkills),
    pendingTermCascadeSkills: normalizePendingCascadeSkillList(
      overrides.pendingTermCascadeSkills ?? []
    ),
    pendingAgingChanges: cloneAgingChanges(overrides.pendingAgingChanges ?? []),
    careerPlan: normalizeCareerPlan(overrides.careerPlan),
    completedTerms,
    musteringBenefits: cloneMusteringBenefits(
      overrides.musteringBenefits ?? []
    ),
    skills: normalizeSkillList(overrides.skills ?? []),
    equipment: normalizeEquipmentList(overrides.equipment ?? []),
    credits: overrides.credits ?? 0,
    notes: overrides.notes ?? ''
  }
}

export const createCharacterCreationFlow = (
  characterId: CharacterId,
  overrides: Partial<CharacterCreationDraft> = {}
): CharacterCreationFlow => ({
  step: 'basics',
  draft: createInitialCharacterDraft(characterId, overrides)
})

export const createManualCharacterCreationFlow = ({
  state = null,
  name = null,
  characterType = 'PLAYER'
}: ManualCharacterCreationFlowOptions = {}): CharacterCreationFlow => {
  const defaultName = defaultManualCharacterName(state)
  const draftName = name?.trim() || defaultName
  return createCharacterCreationFlow(uniqueCharacterId(state, draftName), {
    name: draftName,
    characterType
  })
}

export const updateCharacterCreationDraft = (
  draft: CharacterCreationDraft,
  patch: CharacterCreationDraftPatch
): CharacterCreationDraft => {
  const characteristics = {
    ...draft.characteristics,
    ...(patch.characteristics ?? {})
  }
  const homeworld =
    patch.homeworld === undefined
      ? cloneHomeworld(draft.homeworld)
      : normalizeHomeworld(patch.homeworld)
  const homeworldChanged =
    patch.homeworld !== undefined && !sameHomeworld(draft.homeworld, homeworld)
  const eduChanged =
    patch.characteristics?.edu !== undefined &&
    patch.characteristics.edu !== draft.characteristics.edu
  const refreshBackgroundPlan =
    homeworldChanged || eduChanged
  const backgroundPlan = refreshBackgroundPlan
    ? deriveCharacterCreationBackgroundSkillPlan({ characteristics, homeworld })
    : null

  return {
    characterId: patch.characterId ?? draft.characterId,
    characterType: patch.characterType ?? draft.characterType,
    name: patch.name ?? draft.name,
    age: patch.age ?? draft.age,
    credits: patch.credits ?? draft.credits,
    notes: patch.notes ?? draft.notes,
    characteristics,
    homeworld,
    backgroundSkills:
      patch.backgroundSkills !== undefined
        ? normalizeBackgroundSkillList(patch.backgroundSkills)
        : backgroundPlan
          ? backgroundPlan.backgroundSkills
          : [...draft.backgroundSkills],
    pendingCascadeSkills:
      patch.pendingCascadeSkills !== undefined
        ? normalizePendingCascadeSkillList(patch.pendingCascadeSkills)
        : backgroundPlan
          ? backgroundPlan.pendingCascadeSkills
          : [...draft.pendingCascadeSkills],
    pendingTermCascadeSkills:
      patch.pendingTermCascadeSkills === undefined
        ? [...draft.pendingTermCascadeSkills]
        : normalizePendingCascadeSkillList(patch.pendingTermCascadeSkills),
    pendingAgingChanges:
      patch.pendingAgingChanges === undefined
        ? cloneAgingChanges(draft.pendingAgingChanges)
        : cloneAgingChanges(patch.pendingAgingChanges),
    careerPlan:
      patch.careerPlan === undefined
        ? cloneCareerPlan(draft.careerPlan)
        : normalizeCareerPlan(patch.careerPlan),
    completedTerms:
      patch.completedTerms === undefined
        ? cloneCompletedTerms(draft.completedTerms)
        : cloneCompletedTerms(patch.completedTerms),
    musteringBenefits:
      patch.musteringBenefits === undefined
        ? cloneMusteringBenefits(draft.musteringBenefits)
        : cloneMusteringBenefits(patch.musteringBenefits),
    skills:
      patch.skills === undefined
        ? [...draft.skills]
        : normalizeSkillList(patch.skills),
    equipment:
      patch.equipment === undefined
        ? cloneEquipment(draft.equipment)
        : normalizeEquipmentList(patch.equipment)
  }
}

export const characterCreationCareerNames = (): string[] =>
  CEPHEUS_SRD_CAREERS.map((career) => career.name)

export const deriveCharacterCreationBackgroundSkillPlan = (
  draft: Pick<CharacterCreationDraft, 'characteristics' | 'homeworld'>
): BackgroundSkillPlan =>
  deriveBackgroundSkillPlan({
    edu: draft.characteristics.edu,
    homeworld: draft.homeworld,
    rules: CEPHEUS_SRD_RULESET
  })

const totalBackgroundSkillSelections = (
  draft: Pick<
    CharacterCreationDraft,
    'backgroundSkills' | 'pendingCascadeSkills'
  >
): number => draft.backgroundSkills.length + draft.pendingCascadeSkills.length

const requiredBackgroundSkillSelections = (
  draft: Pick<CharacterCreationDraft, 'characteristics' | 'homeworld'>
): number =>
  hasBackgroundHomeworld(draft.homeworld)
    ? deriveTotalBackgroundSkillAllowance(draft.characteristics.edu)
    : 0

export const applyCharacterCreationBackgroundSkillSelection = (
  draft: CharacterCreationDraft,
  selection: string
): CharacterCreationDraft => {
  if (
    totalBackgroundSkillSelections(draft) >=
    requiredBackgroundSkillSelections(draft)
  ) {
    return updateCharacterCreationDraft(draft, {})
  }

  const trimmed = selection.trim()
  if (!trimmed) return updateCharacterCreationDraft(draft, {})

  if (isCascadeCareerSkill(trimmed)) {
    return updateCharacterCreationDraft(draft, {
      pendingCascadeSkills: [
        ...draft.pendingCascadeSkills,
        careerSkillWithLevel(trimmed, 0)
      ]
    })
  }

  const normalized = normalizeCareerSkill(trimmed, 0)
  if (!normalized) return updateCharacterCreationDraft(draft, {})

  return updateCharacterCreationDraft(draft, {
    backgroundSkills: [...draft.backgroundSkills, normalized]
  })
}

export const removeCharacterCreationBackgroundSkillSelection = (
  draft: CharacterCreationDraft,
  selection: string
): CharacterCreationDraft => {
  const trimmed = selection.trim()
  if (!trimmed) return updateCharacterCreationDraft(draft, {})

  const normalized = isCascadeCareerSkill(trimmed)
    ? careerSkillWithLevel(trimmed, 0)
    : normalizeCareerSkill(trimmed, 0)
  if (!normalized) return updateCharacterCreationDraft(draft, {})

  return updateCharacterCreationDraft(draft, {
    backgroundSkills: draft.backgroundSkills.filter(
      (skill) => skill !== normalized
    ),
    pendingCascadeSkills: draft.pendingCascadeSkills.filter(
      (skill) => skill !== normalized
    )
  })
}

export const resolveCharacterCreationCascadeSkill = ({
  draft,
  cascadeSkill,
  selection
}: {
  draft: CharacterCreationDraft
  cascadeSkill: string
  selection: string
}): CharacterCreationDraft => {
  if (!draft.pendingCascadeSkills.includes(cascadeSkill)) {
    return updateCharacterCreationDraft(draft, {})
  }

  const resolution = resolveCascadeCareerSkill({
    pendingCascadeSkills: draft.pendingCascadeSkills,
    backgroundSkills: draft.backgroundSkills,
    cascadeSkill,
    selection,
    basicTraining: true
  })

  return updateCharacterCreationDraft(draft, {
    backgroundSkills: resolution.backgroundSkills,
    pendingCascadeSkills: resolution.pendingCascadeSkills
  })
}

const characteristicRollLabels: Record<CharacteristicKey, string> = {
  str: 'Str',
  dex: 'Dex',
  end: 'End',
  int: 'Int',
  edu: 'Edu',
  soc: 'Soc'
}

export const deriveNextCharacterCreationCharacteristicRoll = (
  flow: Pick<CharacterCreationFlow, 'draft'>
): CharacterCreationCharacteristicRollAction | null => {
  for (const key of CHARACTERISTIC_KEYS) {
    if (flow.draft.characteristics[key] === null) {
      const label = characteristicRollLabels[key]
      return {
        key,
        label: `Roll ${label}`,
        reason: `${flow.draft.name.trim() || 'Character'} ${label}`
      }
    }
  }
  return null
}

export const applyCharacterCreationCharacteristicRoll = (
  flow: CharacterCreationFlow,
  roll: number,
  characteristic: CharacteristicKey | null = null
): CharacterCreationWizardResult => {
  const key = characteristic ?? deriveNextCharacterCreationCharacteristicRoll(flow)?.key
  if (!key || flow.draft.characteristics[key] !== null) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const updatedFlow = updateCharacterCreationFields(flow, {
    characteristics: { [key]: roll }
  })
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

export const selectCharacterCreationCareerPlan = (
  career: string,
  overrides: Partial<Omit<CharacterCreationCareerPlan, 'career'>> = {}
): CharacterCreationCareerPlan => createCareerPlan({ ...overrides, career })

const findCareerDefinition = (
  careerName: string
): CepheusCareerDefinition | null =>
  CEPHEUS_SRD_CAREERS.find((career) => career.name === careerName) ?? null

const evaluateOptionalCareerRoll = ({
  check,
  characteristics,
  roll
}: {
  check: string
  characteristics: Partial<CharacterCharacteristics>
  roll: number | null
}): boolean | null => {
  if (roll === null || !Number.isFinite(roll)) return null
  return evaluateCareerCheck({ check, characteristics, roll })?.success ?? null
}

export const evaluateCharacterCreationCareerPlan = (
  draft: Pick<CharacterCreationDraft, 'characteristics' | 'completedTerms'>,
  plan: CharacterCreationCareerPlan
): CharacterCreationCareerPlan => {
  const normalizedPlan = normalizeCareerPlan(plan) ?? createCareerPlan()
  const careerDefinition = findCareerDefinition(normalizedPlan.career)
  if (!careerDefinition) return normalizedPlan
  const currentRank = currentCharacterCreationCareerRank(
    draft,
    normalizedPlan.career
  )

  const qualificationPassed = evaluateOptionalCareerRoll({
    check: careerDefinition.qualification,
    characteristics: draft.characteristics,
    roll: normalizedPlan.qualificationRoll
  })
  const resolvedQualificationPassed = normalizedPlan.drafted
    ? true
    : qualificationPassed
  const survivalPassed = evaluateOptionalCareerRoll({
    check: careerDefinition.survival,
    characteristics: draft.characteristics,
    roll: normalizedPlan.survivalRoll
  })
  const canCommission =
    survivalPassed === false
      ? false
      : currentRank === 0 && parseCareerCheck(careerDefinition.commission) !== null
  const canAdvance =
    survivalPassed === false || canCommission
      ? false
      : parseCareerCheck(careerDefinition.advancement) !== null
  const evaluatedPlan = {
    ...normalizedPlan,
    qualificationPassed: resolvedQualificationPassed,
    survivalPassed,
    commissionPassed: evaluateOptionalCareerRoll({
      check: careerDefinition.commission,
      characteristics: draft.characteristics,
      roll: normalizedPlan.commissionRoll
    }),
    advancementPassed: evaluateOptionalCareerRoll({
      check: careerDefinition.advancement,
      characteristics: draft.characteristics,
      roll: normalizedPlan.advancementRoll
    }),
    termSkillRolls: cloneTermSkillRolls(normalizedPlan.termSkillRolls ?? []),
    canCommission,
    canAdvance
  }
  const reward = characterCreationRankRewardForPlan(draft, evaluatedPlan)

  return {
    ...evaluatedPlan,
    rank: reward?.rank ?? normalizedPlan.rank ?? null,
    rankTitle: reward?.title ?? normalizedPlan.rankTitle ?? null,
    rankBonusSkill: reward?.bonusSkill ?? normalizedPlan.rankBonusSkill ?? null
  }
}

const characterCreationRankRewardForPlan = (
  draft: Pick<CharacterCreationDraft, 'completedTerms'>,
  plan: CharacterCreationCareerPlan
) => {
  if (!plan.career) return null
  const currentRank = currentCharacterCreationCareerRank(draft, plan.career)
  const nextRank =
    plan.commissionPassed === true && currentRank === 0
      ? 1
      : plan.advancementPassed === true
        ? currentRank + 1
        : null
  if (nextRank === null) return null
  return parseCareerRankReward({
    ranksAndSkills: CEPHEUS_SRD_RULESET.ranksAndSkills,
    career: plan.career,
    rank: nextRank
  })
}

const currentCharacterCreationCareerRank = (
  draft: Pick<CharacterCreationDraft, 'completedTerms'>,
  career: string
): number =>
  draft.completedTerms
    .filter((term) => term.career === career)
    .reduce((rank, term) => Math.max(rank, term.rank ?? 0), 0)

const careerRankAfterPlan = (draft: CharacterCreationDraft): number => {
  const plan = draft.careerPlan
  if (!plan?.career) return 0
  const currentRank = currentCharacterCreationCareerRank(draft, plan.career)
  if (plan.commissionPassed === true && currentRank === 0) return 1
  if (plan.advancementPassed === true) return currentRank + 1
  return currentRank
}

export const applyCharacterCreationCareerPlan = (
  draft: CharacterCreationDraft,
  plan: CharacterCreationCareerPlan
): CharacterCreationDraft =>
  updateCharacterCreationDraft(draft, {
    careerPlan: evaluateCharacterCreationCareerPlan(draft, plan)
  })

export const deriveNextCharacterCreationCareerRoll = (
  flow: Pick<CharacterCreationFlow, 'draft'>
): CharacterCreationCareerRollAction | null => {
  const { careerPlan } = flow.draft
  if (!careerPlan?.career.trim()) return null

  const career = careerPlan.career.trim()
  if (!careerPlan.drafted && careerPlan.qualificationRoll === null) {
    return {
      key: 'qualificationRoll',
      label: 'Roll qualification',
      reason: `${flow.draft.name.trim() || 'Character'} ${career} qualification`
    }
  }
  if (careerPlan.qualificationPassed === false) return null
  if (careerPlan.survivalRoll === null) {
    return {
      key: 'survivalRoll',
      label: 'Roll survival',
      reason: `${flow.draft.name.trim() || 'Character'} ${career} survival`
    }
  }
  if (careerPlan.survivalPassed === false) return null
  if (careerPlan.canCommission && careerPlan.commissionRoll === null) {
    return {
      key: 'commissionRoll',
      label: 'Roll commission',
      reason: `${flow.draft.name.trim() || 'Character'} ${career} commission`
    }
  }
  if (careerPlan.canAdvance && careerPlan.advancementRoll === null) {
    return {
      key: 'advancementRoll',
      label: 'Roll advancement',
      reason: `${flow.draft.name.trim() || 'Character'} ${career} advancement`
    }
  }
  return null
}

const termSkillTableLabels: Record<CharacterCreationTermSkillTable, string> = {
  personalDevelopment: 'Personal development',
  serviceSkills: 'Service skills',
  specialistSkills: 'Specialist skills',
  advancedEducation: 'Advanced education'
}

const careerTermSkillTables = (
  career: CepheusCareerDefinition
): Record<CharacterCreationTermSkillTable, readonly string[]> => ({
  personalDevelopment: career.personalDevelopment,
  serviceSkills: career.serviceSkills,
  specialistSkills: career.specialistSkills,
  advancedEducation: career.advancedEducation
})

export const requiredCharacterCreationTermSkillRolls = (
  draft: Pick<CharacterCreationDraft, 'careerPlan'>
): number => {
  const plan = draft.careerPlan
  if (!plan || !isCareerPlanTermResolved(plan)) {
    return 0
  }
  if (plan.survivalPassed === false) return 0
  return plan.canCommission === false && plan.canAdvance === false ? 2 : 1
}

export const remainingCharacterCreationTermSkillRolls = (
  draft: Pick<CharacterCreationDraft, 'careerPlan'>
): number =>
  Math.max(
    0,
    requiredCharacterCreationTermSkillRolls(draft) -
      (draft.careerPlan?.termSkillRolls?.length ?? 0)
  )

export const deriveCharacterCreationTermSkillTableActions = (
  flow: CharacterCreationFlow
): CharacterCreationTermSkillTableAction[] => {
  if (flow.step !== 'career') return []
  const plan = flow.draft.careerPlan
  if (
    !plan?.career ||
    remainingCharacterCreationTermSkillRolls(flow.draft) <= 0 ||
    flow.draft.pendingTermCascadeSkills.length > 0
  ) {
    return []
  }
  const career = findCareerDefinition(plan.career)
  if (!career) return []

  return (
    Object.keys(termSkillTableLabels) as CharacterCreationTermSkillTable[]
  ).map((table) => {
    const requiresEducation = table === 'advancedEducation'
    const disabled =
      requiresEducation && (flow.draft.characteristics.edu ?? 0) < 8
    return {
      table,
      label: termSkillTableLabels[table],
      reason: disabled
        ? 'Advanced education requires EDU 8+'
        : `${flow.draft.name.trim() || 'Character'} ${career.name} ${termSkillTableLabels[table].toLowerCase()}`,
      disabled
    }
  })
}

export const deriveNextCharacterCreationReenlistmentRoll = (
  flow: CharacterCreationFlow
): CharacterCreationReenlistmentRollAction | null => {
  if (flow.step !== 'career') return null
  const plan = flow.draft.careerPlan
  if (!plan?.career || plan.survivalPassed !== true) return null
  if (!isCareerPlanTermResolved(plan)) return null
  if (remainingCharacterCreationTermSkillRolls(flow.draft) > 0) return null
  if (flow.draft.pendingTermCascadeSkills.length > 0) return null
  if (flow.draft.pendingAgingChanges.length > 0) return null
  if (requiresCharacterCreationAgingRoll(flow.draft) && plan.agingRoll === null) {
    return null
  }
  if (plan.reenlistmentOutcome !== null) return null
  if (flow.draft.completedTerms.length + 1 >= 7) return null
  const check = CEPHEUS_SRD_RULESET.careerBasics[plan.career]?.ReEnlistment
  if (!check) return null
  return {
    label: 'Roll reenlistment',
    reason: `${flow.draft.name.trim() || 'Character'} ${plan.career} reenlistment`
  }
}

const characterCreationAgingTerms = (
  draft: Pick<CharacterCreationDraft, 'completedTerms'>
): Array<{ anagathics: boolean }> => [
  ...draft.completedTerms.map((term) => ({
    anagathics: term.anagathics === true
  })),
  { anagathics: false }
]

export const requiresCharacterCreationAgingRoll = (
  draft: Pick<CharacterCreationDraft, 'age' | 'completedTerms' | 'careerPlan'>
): boolean => {
  const plan = draft.careerPlan
  return (
    plan?.survivalPassed === true &&
    (draft.age ?? CHARACTER_CREATION_STARTING_AGE) >= 30 &&
    plan.agingRoll === null
  )
}

export const deriveNextCharacterCreationAgingRoll = (
  flow: CharacterCreationFlow
): CharacterCreationAgingRollAction | null => {
  if (flow.step !== 'career') return null
  const plan = flow.draft.careerPlan
  if (!plan?.career || plan.survivalPassed !== true) return null
  if (!isCareerPlanTermResolved(plan)) return null
  if (remainingCharacterCreationTermSkillRolls(flow.draft) > 0) return null
  if (flow.draft.pendingTermCascadeSkills.length > 0) return null
  if (flow.draft.pendingAgingChanges.length > 0) return null
  if (!requiresCharacterCreationAgingRoll(flow.draft)) return null

  const modifier = deriveAgingRollModifier(
    characterCreationAgingTerms(flow.draft)
  )
  return {
    label: 'Roll aging',
    reason: `${flow.draft.name.trim() || 'Character'} aging`,
    modifier
  }
}

export const applyCharacterCreationAgingRoll = (
  flow: CharacterCreationFlow,
  roll: number
): CharacterCreationWizardResult => {
  const action = deriveNextCharacterCreationAgingRoll(flow)
  const plan = flow.draft.careerPlan
  if (!action || !plan) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const resolution = resolveAging({
    currentAge: flow.draft.age,
    table: CEPHEUS_SRD_RULESET.aging,
    roll,
    years: 4
  })
  const updatedFlow = updateCharacterCreationFields(flow, {
    age: resolution.age,
    pendingAgingChanges: resolution.characteristicChanges,
    careerPlan: {
      ...plan,
      agingRoll: roll,
      agingMessage: resolution.message,
      agingSelections: []
    }
  })
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

const characteristicOptionsForAgingChange = (
  change: AgingChange,
  selections: readonly CharacterCreationAgingSelection[]
): CharacteristicKey[] => {
  const allowed =
    change.type === 'PHYSICAL'
      ? (['str', 'dex', 'end'] satisfies CharacteristicKey[])
      : (['int', 'edu', 'soc'] satisfies CharacteristicKey[])
  const alreadySelected = new Set(
    selections
      .filter((selection) => selection.type === change.type)
      .map((selection) => selection.characteristic)
  )
  return allowed.filter((key) => !alreadySelected.has(key))
}

export const deriveCharacterCreationAgingChangeOptions = (
  flow: CharacterCreationFlow
): Array<{
  index: number
  type: AgingChangeType
  modifier: number
  options: CharacteristicKey[]
}> => {
  const selections = flow.draft.careerPlan?.agingSelections ?? []
  return flow.draft.pendingAgingChanges.map((change, index) => ({
    index,
    type: change.type,
    modifier: change.modifier,
    options: characteristicOptionsForAgingChange(change, selections)
  }))
}

export const applyCharacterCreationAgingChange = ({
  flow,
  index,
  characteristic
}: {
  flow: CharacterCreationFlow
  index: number
  characteristic: CharacteristicKey
}): CharacterCreationWizardResult => {
  const plan = flow.draft.careerPlan
  const change = flow.draft.pendingAgingChanges[index]
  if (!plan || !change) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }
  const options = characteristicOptionsForAgingChange(
    change,
    plan.agingSelections ?? []
  )
  if (!options.includes(characteristic)) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const currentValue = flow.draft.characteristics[characteristic] ?? 0
  const pendingAgingChanges = cloneAgingChanges(flow.draft.pendingAgingChanges)
  pendingAgingChanges.splice(index, 1)
  const selection: CharacterCreationAgingSelection = {
    type: change.type,
    modifier: change.modifier,
    characteristic
  }
  const updatedFlow = updateCharacterCreationFields(flow, {
    pendingAgingChanges,
    characteristics: {
      ...flow.draft.characteristics,
      [characteristic]: Math.max(0, currentValue + change.modifier)
    },
    careerPlan: {
      ...plan,
      agingSelections: [...(plan.agingSelections ?? []), selection]
    }
  })
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

const evaluateCharacterCreationReenlistment = ({
  draft,
  career,
  roll
}: {
  draft: CharacterCreationDraft
  career: string
  roll: number
}): CharacterCreationReenlistmentOutcome => {
  if (draft.completedTerms.length + 1 >= 7) return 'retire'
  if (roll === 12) return 'forced'
  const check = CEPHEUS_SRD_RULESET.careerBasics[career]?.ReEnlistment ?? ''
  const result = evaluateCareerCheck({
    check,
    characteristics: draft.characteristics,
    roll
  })
  return result?.success ? 'allowed' : 'blocked'
}

export const applyCharacterCreationReenlistmentRoll = (
  flow: CharacterCreationFlow,
  roll: number
): CharacterCreationWizardResult => {
  const action = deriveNextCharacterCreationReenlistmentRoll(flow)
  const plan = flow.draft.careerPlan
  if (!action || !plan) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const updatedFlow = updateCharacterCreationFields(flow, {
    careerPlan: {
      ...plan,
      reenlistmentRoll: roll,
      reenlistmentOutcome: evaluateCharacterCreationReenlistment({
        draft: flow.draft,
        career: plan.career,
        roll
      })
    }
  })
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

const resolveTermSkillRoll = ({
  career,
  table,
  roll
}: {
  career: CepheusCareerDefinition
  table: CharacterCreationTermSkillTable
  roll: number
}): CharacterCreationTermSkillRoll => {
  const entries = careerTermSkillTables(career)[table]
  const index = Math.max(0, Math.min(entries.length - 1, roll - 1))
  const skill = entries[index] ?? ''
  return {
    table,
    roll,
    skill
  }
}

const addRolledSkill = (
  skills: readonly string[],
  rawSkill: string
): string[] => {
  const normalized = normalizeCareerSkill(rawSkill, 1)
  const parsedNewSkill = normalized ? parseCareerSkill(normalized) : null
  if (!normalized || !parsedNewSkill) return normalizeSkillList(skills)

  const updatedSkills: string[] = []
  let merged = false

  for (const skill of normalizeSkillList(skills)) {
    const parsedSkill = parseCareerSkill(skill)
    if (!parsedSkill || parsedSkill.name !== parsedNewSkill.name) {
      updatedSkills.push(skill)
      continue
    }

    if (!merged) {
      updatedSkills.push(
        formatCareerSkill({
          name: parsedSkill.name,
          level: parsedSkill.level + parsedNewSkill.level
        })
      )
      merged = true
    }
  }

  if (!merged) updatedSkills.push(normalized)
  return updatedSkills
}

const addRolledSkills = (
  skills: readonly string[],
  rawSkills: readonly string[]
): string[] => rawSkills.reduce(addRolledSkill, normalizeSkillList(skills))

const termCharacteristicGain = (
  rawSkill: string
): { key: CharacteristicKey; label: string } | null => {
  const parsed = /^\+1\s+(Str|Dex|End|Int|Edu|Soc)$/i.exec(rawSkill.trim())
  if (!parsed) return null
  const label = parsed[1] as 'Str' | 'Dex' | 'End' | 'Int' | 'Edu' | 'Soc'
  return {
    key: label.toLowerCase() as CharacteristicKey,
    label
  }
}

const basicTrainingSkillsForCurrentTerm = (
  draft: CharacterCreationDraft
): string[] => {
  const careerName = draft.careerPlan?.career.trim()
  if (!careerName) return []
  const plan = deriveBasicTrainingPlan({
    career: careerName,
    serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
    completedTermCount: draft.completedTerms.length,
    previousCareerNames: draft.completedTerms.map((term) => term.career)
  })
  if (plan.kind === 'none') return []

  const sourceSkills = plan.kind === 'all' ? plan.skills : plan.skills.slice(0, 1)
  return sourceSkills
    .map((skill) => normalizeCareerSkill(skill, 0))
    .filter((skill): skill is string => skill !== null)
}

export const applyCharacterCreationTermSkillRoll = ({
  flow,
  table,
  roll
}: {
  flow: CharacterCreationFlow
  table: CharacterCreationTermSkillTable
  roll: number
}): CharacterCreationWizardResult => {
  const plan = flow.draft.careerPlan
  if (!plan || remainingCharacterCreationTermSkillRolls(flow.draft) <= 0) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }
  if (table === 'advancedEducation' && (flow.draft.characteristics.edu ?? 0) < 8) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }
  const career = findCareerDefinition(plan.career)
  if (!career) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const termSkillRoll = resolveTermSkillRoll({ career, table, roll })
  const basicTrainingSkills =
    (plan.termSkillRolls?.length ?? 0) === 0
      ? basicTrainingSkillsForCurrentTerm(flow.draft)
      : []
  const characteristicGain = termCharacteristicGain(termSkillRoll.skill)
  const rolledCascadeSkill = isCascadeCareerSkill(termSkillRoll.skill)
    ? careerSkillWithLevel(termSkillRoll.skill, 1)
    : null
  const updatedFlow = updateCharacterCreationFields(flow, {
    careerPlan: {
      ...plan,
      termSkillRolls: [...(plan.termSkillRolls ?? []), termSkillRoll]
    },
    pendingTermCascadeSkills: rolledCascadeSkill
      ? [...flow.draft.pendingTermCascadeSkills, rolledCascadeSkill]
      : flow.draft.pendingTermCascadeSkills,
    characteristics: characteristicGain
      ? {
          ...flow.draft.characteristics,
          [characteristicGain.key]:
            (flow.draft.characteristics[characteristicGain.key] ?? 0) + 1
        }
      : flow.draft.characteristics,
    skills: characteristicGain
      ? normalizeSkillList([...flow.draft.skills, ...basicTrainingSkills])
      : rolledCascadeSkill
        ? normalizeSkillList([...flow.draft.skills, ...basicTrainingSkills])
        : addRolledSkill(
            normalizeSkillList([...flow.draft.skills, ...basicTrainingSkills]),
            termSkillRoll.skill
          )
  })

  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

export const resolveCharacterCreationTermCascadeSkill = ({
  flow,
  cascadeSkill,
  selection
}: {
  flow: CharacterCreationFlow
  cascadeSkill: string
  selection: string
}): CharacterCreationWizardResult => {
  if (!flow.draft.pendingTermCascadeSkills.includes(cascadeSkill)) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const resolution = resolveCascadeCareerSkill({
    pendingCascadeSkills: flow.draft.pendingTermCascadeSkills,
    termSkills: [],
    cascadeSkill,
    selection
  })
  const updatedFlow = updateCharacterCreationFields(flow, {
    pendingTermCascadeSkills: resolution.pendingCascadeSkills,
    skills: addRolledSkills(flow.draft.skills, resolution.termSkills)
  })
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

export const applyCharacterCreationCareerRoll = (
  flow: CharacterCreationFlow,
  roll: number
): CharacterCreationWizardResult => {
  const action = deriveNextCharacterCreationCareerRoll(flow)
  if (!action || !flow.draft.careerPlan) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const updatedDraft = applyCharacterCreationCareerPlan(flow.draft, {
    ...flow.draft.careerPlan,
    [action.key]: roll
  })
  const rewardSkill = updatedDraft.careerPlan?.rankBonusSkill ?? null
  const rankedDraft =
    rewardSkill && ['commissionRoll', 'advancementRoll'].includes(action.key)
      ? applyCharacterCreationRankBonusSkill(updatedDraft, rewardSkill)
      : updatedDraft
  const updatedFlow = { ...flow, draft: rankedDraft }
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

export const deriveCharacterCreationCareerSkipAction = (
  flow: Pick<CharacterCreationFlow, 'draft' | 'step'>
): CharacterCreationCareerSkipAction | null => {
  if (flow.step !== 'career') return null
  const action = deriveNextCharacterCreationCareerRoll(flow)
  if (action?.key === 'commissionRoll') {
    return { key: action.key, label: 'Skip commission' }
  }
  if (action?.key === 'advancementRoll') {
    return { key: action.key, label: 'Skip advancement' }
  }
  return null
}

export const skipCharacterCreationCareerRoll = (
  flow: CharacterCreationFlow
): CharacterCreationWizardResult => {
  const action = deriveCharacterCreationCareerSkipAction(flow)
  if (!action || !flow.draft.careerPlan) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const updatedFlow = {
    ...flow,
    draft: applyCharacterCreationCareerPlan(flow.draft, {
      ...flow.draft.careerPlan,
      [action.key]: -1
    })
  }
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

const applyCharacterCreationRankBonusSkill = (
  draft: CharacterCreationDraft,
  rewardSkill: string
): CharacterCreationDraft => {
  const normalizedSkill = normalizeCareerSkill(rewardSkill, 1)
  if (!normalizedSkill) return draft
  if (isCascadeCareerSkill(rewardSkill)) {
    const pending = careerSkillWithLevel(rewardSkill, 1)
    return updateCharacterCreationDraft(draft, {
      pendingTermCascadeSkills: pending
        ? [...draft.pendingTermCascadeSkills, pending]
        : draft.pendingTermCascadeSkills
    })
  }
  return updateCharacterCreationDraft(draft, {
    skills: addRolledSkill(draft.skills, rewardSkill)
  })
}

export const isCharacterCreationCareerTermResolved = (
  draft: CharacterCreationDraft
): boolean => {
  const plan = draft.careerPlan
  return plan ? isCareerPlanTermResolved(plan) : false
}

const isCareerPlanTermResolved = (
  plan: CharacterCreationCareerPlan
): boolean => {
  if (!plan?.career.trim()) return false
  if (!plan.drafted && plan.qualificationPassed !== true) return false
  if (plan.survivalPassed === null || plan.survivalRoll === null) return false
  if (plan.survivalPassed === false) return true
  if (plan.canCommission && plan.commissionRoll === null) return false
  if (plan.canAdvance && plan.advancementRoll === null) return false
  return true
}

const completedTermFromPlan = (
  draft: CharacterCreationDraft
): CharacterCreationCompletedTerm | null => {
  const plan = draft.careerPlan
  if (!plan || !isCharacterCreationCareerTermResolved(draft)) return null

  return {
    career: plan.career.trim(),
    drafted: plan.drafted,
    age: draft.age,
    rank: careerRankAfterPlan(draft),
    rankTitle: plan.rankTitle ?? null,
    rankBonusSkill: plan.rankBonusSkill ?? null,
    qualificationRoll: plan.qualificationRoll,
    survivalRoll: plan.survivalRoll,
    survivalPassed: plan.survivalPassed === true,
    canCommission: plan.canCommission === true,
    commissionRoll: plan.commissionRoll,
    commissionPassed: plan.commissionPassed,
    canAdvance: plan.canAdvance === true,
    advancementRoll: plan.advancementRoll,
    advancementPassed: plan.advancementPassed,
    termSkillRolls: cloneTermSkillRolls(plan.termSkillRolls ?? []),
    ...(plan.agingRoll != null
      ? {
          agingRoll: plan.agingRoll,
          agingMessage: plan.agingMessage ?? null,
          agingSelections: cloneAgingSelections(plan.agingSelections ?? [])
        }
      : {}),
    reenlistmentRoll: plan.reenlistmentRoll ?? null,
    reenlistmentOutcome:
      plan.reenlistmentOutcome ??
      (plan.survivalPassed === false
        ? null
        : flowlessTermCountRequiresRetirement(draft)
          ? 'retire'
          : null)
  }
}

const flowlessTermCountRequiresRetirement = (
  draft: Pick<CharacterCreationDraft, 'completedTerms'>
): boolean => draft.completedTerms.length + 1 >= 7

export const completeCharacterCreationCareerTerm = ({
  flow,
  continueCareer
}: {
  flow: CharacterCreationFlow
  continueCareer: boolean
}): CharacterCreationWizardResult => {
  const completedTerm = completedTermFromPlan(flow.draft)
  if (
    !completedTerm ||
    remainingCharacterCreationTermSkillRolls(flow.draft) > 0 ||
    flow.draft.pendingTermCascadeSkills.length > 0 ||
    flow.draft.pendingAgingChanges.length > 0 ||
    (completedTerm.survivalPassed &&
      requiresCharacterCreationAgingRoll(flow.draft)) ||
    (completedTerm.survivalPassed &&
      !completedTerm.reenlistmentOutcome)
  ) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const nextAge =
    completedTerm.agingRoll == null
      ? (flow.draft.age ?? CHARACTER_CREATION_STARTING_AGE) + 4
      : flow.draft.age
  const canContinueCareer =
    continueCareer &&
    completedTerm.survivalPassed &&
    (completedTerm.reenlistmentOutcome === 'allowed' ||
      completedTerm.reenlistmentOutcome === 'forced')
  const nextCareerPlan =
    canContinueCareer
      ? createCareerPlan({
          career: completedTerm.career,
          qualificationRoll: 12,
          qualificationPassed: true,
          drafted: false
        })
      : flow.draft.careerPlan
  const nextFlow = updateCharacterCreationFields(flow, {
    age: nextAge,
    careerPlan: nextCareerPlan,
    pendingTermCascadeSkills: [],
    completedTerms: [...flow.draft.completedTerms, completedTerm]
  })

  const resolvedFlow =
    canContinueCareer
      ? nextFlow
      : { ...nextFlow, step: 'skills' as const }
  return {
    flow: resolvedFlow,
    validation: validateCurrentCharacterCreationStep(resolvedFlow),
    moved: resolvedFlow.step !== flow.step
  }
}

export const remainingMusteringBenefits = (
  draft: Pick<
    CharacterCreationDraft,
    'completedTerms' | 'musteringBenefits'
  >
): number => {
  const term = nextMusteringBenefitTerm(draft)
  return term ? remainingMusteringBenefitsForCareer(draft, term.career) : 0
}

const termsInCareer = (
  draft: Pick<CharacterCreationDraft, 'completedTerms'>,
  career: string
): number => draft.completedTerms.filter((term) => term.career === career).length

const benefitsInCareer = (
  draft: Pick<CharacterCreationDraft, 'musteringBenefits'>,
  career: string
): number =>
  draft.musteringBenefits.filter((benefit) => benefit.career === career).length

const cashBenefitsReceived = (
  draft: Pick<CharacterCreationDraft, 'musteringBenefits'>
): number =>
  draft.musteringBenefits.filter(
    (benefit) => benefit.kind === 'cash'
  ).length

const rankInCareer = (
  draft: Pick<CharacterCreationDraft, 'completedTerms'>,
  career: string
): number =>
  draft.completedTerms
    .filter((term) => term.career === career)
    .reduce((rank, term) => Math.max(rank, term.rank ?? 0), 0)

const remainingMusteringBenefitsForCareer = (
  draft: Pick<CharacterCreationDraft, 'completedTerms' | 'musteringBenefits'>,
  career: string
): number =>
  deriveRemainingCareerBenefits({
    termsInCareer: termsInCareer(draft, career),
    currentRank: rankInCareer(draft, career),
    benefitsReceived: benefitsInCareer(draft, career)
  })

const nextMusteringBenefitTerm = (
  draft: Pick<CharacterCreationDraft, 'completedTerms' | 'musteringBenefits'>
): CharacterCreationCompletedTerm | null =>
  draft.completedTerms.find(
    (term) => remainingMusteringBenefitsForCareer(draft, term.career) > 0
  ) ?? null

export const characterCreationMusteringBenefitRollModifier = ({
  draft,
  kind
}: {
  draft: Pick<
    CharacterCreationDraft,
    'completedTerms' | 'musteringBenefits' | 'skills'
  >
  kind: BenefitKind
}): number => {
  const term = nextMusteringBenefitTerm(draft)
  if (!term) return 0
  if (kind === 'cash') {
    return deriveCashBenefitRollModifier({
      retired: draft.completedTerms.length >= 7,
      hasGambling: draft.skills.some((skill) => parseCareerSkill(skill)?.name === 'Gambling')
    })
  }
  return deriveMaterialBenefitRollModifier({
    currentRank: rankInCareer(draft, term.career)
  })
}

export const canRollCharacterCreationMusteringBenefit = ({
  draft,
  kind
}: {
  draft: Pick<
    CharacterCreationDraft,
    'completedTerms' | 'musteringBenefits' | 'skills'
  >
  kind: BenefitKind
}): boolean => {
  const term = nextMusteringBenefitTerm(draft)
  if (!term) return false
  if (
    kind === 'cash' &&
    !canRollCashBenefit({
      cashBenefitsReceived: cashBenefitsReceived(draft)
    })
  ) {
    return false
  }
  return true
}

export const applyCharacterCreationMusteringBenefit = ({
  flow,
  kind,
  roll
}: {
  flow: CharacterCreationFlow
  kind: BenefitKind
  roll: number
}): CharacterCreationWizardResult => {
  const remaining = remainingMusteringBenefits(flow.draft)
  const term = nextMusteringBenefitTerm(flow.draft)
  if (
    remaining <= 0 ||
    !term ||
    !canRollCharacterCreationMusteringBenefit({ draft: flow.draft, kind })
  ) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const benefit = resolveCareerBenefit({
    tables: CEPHEUS_SRD_RULESET,
    career: term.career,
    roll,
    kind
  })
  const musteringBenefit: CharacterCreationMusteringBenefit = {
    career: term.career,
    kind,
    roll,
    value: benefit.value,
    credits: benefit.credits
  }
  const equipment =
    kind === 'material' && benefit.value !== '-'
      ? [
          ...flow.draft.equipment,
          {
            name: benefit.value,
            quantity: 1,
            notes: `Mustering out: ${term.career}`
          }
        ]
      : flow.draft.equipment
  const updatedFlow = updateCharacterCreationFields(flow, {
    musteringBenefits: [...flow.draft.musteringBenefits, musteringBenefit],
    credits: flow.draft.credits + benefit.credits,
    equipment
  })

  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

export const deriveCharacterCreationBasicTrainingAction = (
  flow: CharacterCreationFlow
): CharacterCreationBasicTrainingAction | null => {
  if (flow.step !== 'skills' || flow.draft.skills.length > 0) return null
  const careerName = flow.draft.careerPlan?.career.trim()
  if (!careerName) return null
  const careerDefinition = findCareerDefinition(careerName)
  if (!careerDefinition) return null

  const skills = careerDefinition.serviceSkills
    .map((skill) => normalizeCareerSkill(skill, 0))
    .filter((skill): skill is string => skill !== null)
  if (skills.length === 0) return null

  return {
    label: 'Apply basic training',
    reason: `First ${careerName} term grants service skills at level 0`,
    skills,
    kind: 'all'
  }
}

export const applyCharacterCreationBasicTraining = (
  flow: CharacterCreationFlow
): CharacterCreationWizardResult => {
  const action = deriveCharacterCreationBasicTrainingAction(flow)
  if (!action) {
    const validation = validateCurrentCharacterCreationStep(flow)
    return { flow, validation, moved: false }
  }

  const updatedFlow = updateCharacterCreationFields(flow, {
    skills: action.skills
  })
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
  }
}

export const updateCharacterCreationFields = (
  flow: CharacterCreationFlow,
  patch: CharacterCreationDraftPatch
): CharacterCreationFlow => ({
  ...flow,
  draft: updateCharacterCreationDraft(flow.draft, patch)
})

export const validateCurrentCharacterCreationStep = (
  flow: CharacterCreationFlow
): CharacterCreationValidation => {
  const errors = validationErrorsForStep(flow.step, flow.draft)
  return {
    ok: errors.length === 0,
    step: flow.step,
    errors
  }
}

export const advanceCharacterCreationStep = (
  flow: CharacterCreationFlow
): CharacterCreationFlow => {
  const validation = validateCurrentCharacterCreationStep(flow)
  if (!validation.ok) return flow

  const nextIndex = Math.min(
    stepIndex(flow.step) + 1,
    CHARACTER_CREATION_STEPS.length - 1
  )
  return {
    ...flow,
    step: CHARACTER_CREATION_STEPS[nextIndex]
  }
}

export const backCharacterCreationStep = (
  flow: CharacterCreationFlow
): CharacterCreationFlow => {
  const previousIndex = Math.max(stepIndex(flow.step) - 1, 0)
  return {
    ...flow,
    step: CHARACTER_CREATION_STEPS[previousIndex]
  }
}

export const nextCharacterCreationWizardStep = (
  flow: CharacterCreationFlow
): CharacterCreationWizardResult => {
  const validation = validateCurrentCharacterCreationStep(flow)
  if (!validation.ok) {
    return { flow, validation, moved: false }
  }

  const nextFlow = advanceCharacterCreationStep(flow)
  return {
    flow: nextFlow,
    validation: validateCurrentCharacterCreationStep(nextFlow),
    moved: nextFlow.step !== flow.step
  }
}

export const backCharacterCreationWizardStep = (
  flow: CharacterCreationFlow
): CharacterCreationWizardResult => {
  const previousFlow = backCharacterCreationStep(flow)
  return {
    flow: previousFlow,
    validation: validateCurrentCharacterCreationStep(previousFlow),
    moved: previousFlow.step !== flow.step
  }
}

export const applyParsedCharacterCreationDraftPatch = (
  flow: CharacterCreationFlow,
  patch: CharacterCreationDraftPatch
): CharacterCreationWizardResult => {
  const updatedFlow = updateCharacterCreationFields(flow, patch)
  const careerPlanNeedsEvaluation =
    patch.careerPlan !== undefined || patch.characteristics !== undefined
  const evaluatedFlow =
    careerPlanNeedsEvaluation && updatedFlow.draft.careerPlan !== null
      ? {
          ...updatedFlow,
          draft: applyCharacterCreationCareerPlan(
            updatedFlow.draft,
            updatedFlow.draft.careerPlan
          )
        }
      : updatedFlow

  return {
    flow: evaluatedFlow,
    validation: validateCurrentCharacterCreationStep(evaluatedFlow),
    moved: false
  }
}

export const deriveCreateCharacterCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): CreateCharacterCommand =>
  buildSequencedCommand(
    {
      type: 'CreateCharacter',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      characterType: draft.characterType,
      name: draft.name.trim()
    },
    state
  ) as CreateCharacterCommand

export const deriveStartCharacterCreationCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): StartCharacterCreationCommand =>
  buildSequencedCommand(
    {
      type: 'StartCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId
    },
    state
  ) as StartCharacterCreationCommand

export const deriveStartCharacterCareerTermCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): StartCharacterCareerTermCommand =>
  buildSequencedCommand(
    {
      type: 'StartCharacterCareerTerm',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      career: draft.careerPlan?.career.trim() ?? '',
      ...(draft.careerPlan?.drafted ? { drafted: true } : {})
    },
    state
  ) as StartCharacterCareerTermCommand

const initialCharacterCreationStateCommands = (
  draft: CharacterCreationDraft,
  identity: ClientIdentity
): Command[] => {
  const careerPlan = draft.careerPlan
  const firstCareer = draft.completedTerms[0]?.career ?? careerPlan?.career.trim() ?? ''
  const firstDrafted = draft.completedTerms[0]?.drafted ?? careerPlan?.drafted ?? false
  const baseCommand = {
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId
  }
  const advance = (
    creationEvent: AdvanceCharacterCreationCommand['creationEvent']
  ): AdvanceCharacterCreationCommand => ({
    type: 'AdvanceCharacterCreation',
    ...baseCommand,
    creationEvent
  })
  const backgroundPlan = deriveCharacterCreationBackgroundSkillPlan(draft)
  const backgroundCommands =
    draft.homeworld.lawLevel && hasHomeworldTradeCodes(draft.homeworld)
      ? characterCreationBackgroundCommands({
          draft,
          identity,
          baseCommand,
          backgroundPlan
        })
      : []
  const commands: Command[] = [
    {
      type: 'StartCharacterCreation',
      ...baseCommand
    },
    advance({ type: 'SET_CHARACTERISTICS' }),
    ...backgroundCommands,
    advance({ type: 'COMPLETE_HOMEWORLD' }),
    {
      type: 'StartCharacterCareerTerm',
      ...baseCommand,
      career: firstCareer,
      ...(firstDrafted ? { drafted: true } : {})
    } satisfies StartCharacterCareerTermCommand,
    advance({
      type: 'SELECT_CAREER',
      isNewCareer: true,
      ...(firstDrafted ? { drafted: true } : {})
    })
  ]

  const completedTerms =
    draft.completedTerms.length > 0
      ? draft.completedTerms
      : careerPlan && careerPlan.survivalPassed !== null
        ? [
            {
              career: careerPlan.career.trim(),
              drafted: careerPlan.drafted,
              age: draft.age,
              qualificationRoll: careerPlan.qualificationRoll,
              survivalRoll: careerPlan.survivalRoll,
              survivalPassed: careerPlan.survivalPassed === true,
              canCommission: careerPlan.canCommission === true,
              commissionRoll: careerPlan.commissionRoll,
              commissionPassed: careerPlan.commissionPassed,
              canAdvance: careerPlan.canAdvance === true,
              advancementRoll: careerPlan.advancementRoll,
              advancementPassed: careerPlan.advancementPassed,
              termSkillRolls: cloneTermSkillRolls(careerPlan.termSkillRolls ?? [])
            } satisfies CharacterCreationCompletedTerm
          ]
        : []

  if (completedTerms.length > 0) {
    commands.push(advance({ type: 'COMPLETE_BASIC_TRAINING' }))
    let endedWithMishap = false

    for (const [index, term] of completedTerms.entries()) {
      commands.push(
        term.survivalPassed
          ? advance({
              type: 'SURVIVAL_PASSED',
              canCommission: term.canCommission,
              canAdvance: term.canAdvance
            })
          : advance({ type: 'SURVIVAL_FAILED' })
      )

      if (!term.survivalPassed) {
        commands.push(advance({ type: 'MISHAP_RESOLVED' }))
        endedWithMishap = true
        break
      }

      if (term.canCommission) {
        commands.push(
          advance({
            type: term.commissionPassed
              ? 'COMPLETE_COMMISSION'
              : 'SKIP_COMMISSION'
          })
        )
      } else if (term.canAdvance) {
        commands.push(
          advance({
            type: term.advancementPassed
              ? 'COMPLETE_ADVANCEMENT'
              : 'SKIP_ADVANCEMENT'
          })
        )
      }

      commands.push(advance({ type: 'COMPLETE_SKILLS' }))
      commands.push(advance({ type: 'COMPLETE_AGING' }))
      if (index < completedTerms.length - 1) {
        commands.push(advance({ type: 'REENLIST' }))
      }
    }

    if (!endedWithMishap) commands.push(advance({ type: 'LEAVE_CAREER' }))
    commands.push(
      advance({ type: 'FINISH_MUSTERING' }),
      advance({ type: 'CREATION_COMPLETE' })
    )
  }

  return commands
}

const characterCreationBackgroundCommands = ({
  draft,
  identity,
  baseCommand,
  backgroundPlan
}: {
  draft: CharacterCreationDraft
  identity: ClientIdentity
  baseCommand: Pick<
    SetCharacterCreationHomeworldCommand,
    'gameId' | 'actorId' | 'characterId'
  >
  backgroundPlan: BackgroundSkillPlan
}): Command[] => {
  const commands: Command[] = [
    {
      type: 'SetCharacterCreationHomeworld',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      homeworld: {
        name: null,
        lawLevel: draft.homeworld.lawLevel ?? null,
        tradeCodes: Array.isArray(draft.homeworld.tradeCodes)
          ? [...draft.homeworld.tradeCodes]
          : draft.homeworld.tradeCodes
            ? [draft.homeworld.tradeCodes]
            : []
      }
    } satisfies SetCharacterCreationHomeworldCommand
  ]

  const resolvedCascadeSkills = new Set<string>()
  for (const cascadeSkill of backgroundPlan.pendingCascadeSkills) {
    const selection = resolvedCascadeSelection(cascadeSkill, draft)
    if (!selection) continue
    commands.push({
      type: 'ResolveCharacterCreationCascadeSkill',
      ...baseCommand,
      cascadeSkill,
      selection
    } satisfies ResolveCharacterCreationCascadeSkillCommand)
    resolvedCascadeSkills.add(careerSkillWithLevel(selection, 0))
  }

  const preselected = new Set(backgroundPlan.backgroundSkills)
  const requiredCount = requiredBackgroundSkillSelections(draft)
  const extraSelectionCount = Math.max(
    0,
    requiredCount -
      backgroundPlan.backgroundSkills.length -
      backgroundPlan.pendingCascadeSkills.length
  )
  let selected = 0
  for (const skill of draft.backgroundSkills) {
    if (selected >= extraSelectionCount) break
    if (preselected.has(skill) || resolvedCascadeSkills.has(skill)) continue
    commands.splice(commands.length - resolvedCascadeSkills.size, 0, {
      type: 'SelectCharacterCreationBackgroundSkill',
      ...baseCommand,
      skill
    } satisfies SelectCharacterCreationBackgroundSkillCommand)
    selected += 1
  }

  return commands
}

const resolvedCascadeSelection = (
  cascadeSkill: string,
  draft: CharacterCreationDraft
): string | null => {
  const cascadeName = cascadeSkill.replace(/-\d+$/, '')
  const options = CEPHEUS_SRD_RULESET.cascadeSkills[cascadeName]
  if (!options || options.length === 0) return null

  for (const option of options) {
    if (
      draft.backgroundSkills.some(
        (skill) => skill === careerSkillWithLevel(option, 0)
      )
    ) {
      return option
    }
  }

  return options[0] ?? null
}

export const deriveInitialCharacterCreationStateCommands = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): Command[] => {
  if (!state) return []

  return initialCharacterCreationStateCommands(draft, identity).map(
    (command, index) => sequenceCommandAt(command, state, index)
  )
}

const careerHistoryNotes = (draft: CharacterCreationDraft): string[] => {
  const terms = draft.completedTerms.map((term, index) => {
    const survival = term.survivalPassed ? 'survived' : 'mishap'
    const drafted = term.drafted ? ', drafted' : ''
    return `Term ${index + 1}: ${term.career}${drafted}, ${survival}.`
  })
  const benefits = draft.musteringBenefits.map(
    (benefit) =>
      `Mustering out: ${benefit.career} ${benefit.kind} ${benefit.roll} -> ${benefit.value}.`
  )
  return [...terms, ...benefits]
}

const deriveCharacterCreationSheet = (
  draft: CharacterCreationDraft
): {
  age: CharacterCreationDraft['age']
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
  notes: string
} => {
  const history = careerHistoryNotes(draft)
  return {
    age: draft.age,
    characteristics: { ...draft.characteristics },
    skills: normalizeSkillList([...draft.backgroundSkills, ...draft.skills]),
    equipment: cloneEquipment(draft.equipment),
    credits: draft.credits,
    notes: [draft.notes.trim(), ...history].filter(Boolean).join('\n')
  }
}

export const deriveCharacterSheetPatch = (
  draft: CharacterCreationDraft
): CharacterSheetPatch => deriveCharacterCreationSheet(draft)

export const deriveUpdateCharacterSheetCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): UpdateCharacterSheetCommand =>
  buildSequencedCommand(
    {
      type: 'UpdateCharacterSheet',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      ...deriveCharacterSheetPatch(draft)
    },
    state
  ) as UpdateCharacterSheetCommand

export const deriveFinalizeCharacterCreationCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): FinalizeCharacterCreationCommand => {
  const sheet = deriveCharacterCreationSheet(draft)
  return buildSequencedCommand(
    {
      type: 'FinalizeCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      ...sheet
    },
    state
  ) as FinalizeCharacterCreationCommand
}

export const deriveCharacterCreationCommands = (
  flow: CharacterCreationFlow,
  options: CharacterCreationCommandOptions
): Command[] => {
  const validation = {
    ...validateCurrentCharacterCreationStep({
      ...flow,
      step: 'review'
    })
  }
  if (!validation.ok) return []
  if (!options.state) return []

  const lifecycleCommands = initialCharacterCreationStateCommands(
    flow.draft,
    options.identity
  )
  const reachesPlayable = lifecycleCommands.some(
    (command) =>
      command.type === 'AdvanceCharacterCreation' &&
      command.creationEvent.type === 'CREATION_COMPLETE'
  )
  const sheetCommand: Command = reachesPlayable
    ? deriveFinalizeCharacterCreationCommand(flow.draft, {
        identity: options.identity,
        state: null
      })
    : {
        type: 'UpdateCharacterSheet',
        gameId: options.identity.gameId,
        actorId: options.identity.actorId,
        characterId: flow.draft.characterId,
        ...deriveCharacterSheetPatch(flow.draft)
      }

  const baseCommands: Command[] = [
    {
      type: 'CreateCharacter',
      gameId: options.identity.gameId,
      actorId: options.identity.actorId,
      characterId: flow.draft.characterId,
      characterType: flow.draft.characterType,
      name: flow.draft.name.trim()
    },
    ...lifecycleCommands,
    sheetCommand
  ]

  return baseCommands.map((command, index) =>
    sequenceCommandAt(command, options.state ?? null, index)
  )
}
