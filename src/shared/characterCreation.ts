import type { CharacterCharacteristics, CharacteristicKey } from './state'

export type CareerCreationStatus =
  | 'CHARACTERISTICS'
  | 'HOMEWORLD'
  | 'CAREER_SELECTION'
  | 'BASIC_TRAINING'
  | 'SURVIVAL'
  | 'MISHAP'
  | 'COMMISSION'
  | 'ADVANCEMENT'
  | 'SKILLS_TRAINING'
  | 'AGING'
  | 'REENLISTMENT'
  | 'MUSTERING_OUT'
  | 'ACTIVE'
  | 'PLAYABLE'
  | 'DECEASED'

export type CareerCreationEvent =
  | { type: 'SET_CHARACTERISTICS' }
  | { type: 'COMPLETE_HOMEWORLD' }
  | { type: 'SELECT_CAREER'; isNewCareer: boolean; drafted?: boolean }
  | { type: 'COMPLETE_BASIC_TRAINING' }
  | { type: 'SURVIVAL_PASSED'; canCommission: boolean; canAdvance: boolean }
  | { type: 'SURVIVAL_FAILED' }
  | { type: 'COMPLETE_COMMISSION' }
  | { type: 'SKIP_COMMISSION' }
  | { type: 'COMPLETE_ADVANCEMENT' }
  | { type: 'SKIP_ADVANCEMENT' }
  | { type: 'COMPLETE_SKILLS' }
  | { type: 'COMPLETE_AGING' }
  | { type: 'REENLIST' }
  | { type: 'LEAVE_CAREER' }
  | { type: 'REENLIST_BLOCKED' }
  | { type: 'FORCED_REENLIST' }
  | { type: 'CONTINUE_CAREER' }
  | { type: 'FINISH_MUSTERING' }
  | { type: 'CREATION_COMPLETE' }
  | { type: 'DEATH_CONFIRMED' }
  | { type: 'MISHAP_RESOLVED' }
  | { type: 'RESET' }

export interface CareerCreationContext {
  canCommission: boolean
  canAdvance: boolean
}

export interface CareerCreationState {
  status: CareerCreationStatus
  context: CareerCreationContext
}

export interface CareerCheck {
  characteristic: CharacteristicKey | null
  target: number
}

export interface CareerBasics {
  Qualifications: string
  Survival: string
  Commission: string
  Advancement: string
  ReEnlistment: string
}

export type CareerBasicsTable = Record<string, CareerBasics>
export type CareerSkillTable = Record<string, Record<string, string>>

export interface CareerRollOutcome {
  check: CareerCheck
  modifier: number
  total: number
  success: boolean
}

export interface BasicTrainingPlan {
  kind: 'all' | 'choose-one' | 'none'
  skills: string[]
}

export interface SurvivalPromotionOptions {
  canCommission: boolean
  canAdvance: boolean
}

export interface CareerSkill {
  name: string
  level: number
}

export interface CascadeSkillResolution {
  pendingCascadeSkills: string[]
  backgroundSkills: string[]
  careerSkills: string[]
  termSkills: string[]
}

export type AgingChangeType = 'PHYSICAL' | 'MENTAL'

export interface AgingChange {
  type: AgingChangeType
  modifier: number
}

export interface AgingEffect {
  Roll: string | number
  Effects: string
  Changes?: AgingChange[]
}

export interface AgingResolution {
  age: number
  message: string
  characteristicChanges: AgingChange[]
}

export type PromotionOutcome = 'pass' | 'fail' | 'skip' | 'na'
export type ReenlistmentOutcome = 'forced' | 'allowed' | 'blocked' | 'retire'
export type ReenlistmentDecision = 'reenlist' | 'leave' | 'na'
export type TermOutcomeResult = 'MISHAP' | 'MUSTERING_OUT' | 'NEXT_TERM'

export interface TermOutcome {
  id: string
  survival: 'pass' | 'fail'
  commission: PromotionOutcome
  advancement: PromotionOutcome
  reenlistment: ReenlistmentOutcome
  decision: ReenlistmentDecision
  result: TermOutcomeResult
}

export interface BenefitTables {
  materialBenefits: Record<string, Record<string, string>>
  cashBenefits: Record<string, Record<string, string | number>>
}

export type BenefitKind = 'cash' | 'material'

export interface CareerBenefit {
  kind: BenefitKind
  value: string
  credits: number
}

export interface CareerRank {
  name: string
  rank: number
}

export interface CareerTerm {
  career: string
  skills: string[]
  skillsAndTraining: string[]
  benefits: string[]
  complete: boolean
  canReenlist: boolean
  completedBasicTraining: boolean
  musteringOut: boolean
  anagathics: boolean
  anagathicsCost?: number
  draft?: 1
  survival?: number
  reEnlistment?: number
}

export interface CareerTermStart {
  terms: CareerTerm[]
  careers: CareerRank[]
  canEnterDraft: boolean
  failedToQualify: boolean
}

export type ReenlistmentResolution =
  | {
      outcome: 'retire'
      message: string
      term: CareerTerm
      nextTermCareer: null
    }
  | {
      outcome: 'forced'
      message: string
      term: CareerTerm
      nextTermCareer: string
    }
  | {
      outcome: 'allowed'
      message: string
      term: CareerTerm
      nextTermCareer: null
    }
  | {
      outcome: 'blocked'
      message: string
      term: CareerTerm
      nextTermCareer: null
    }

export interface AnagathicsPayment {
  credits: number
  terms: CareerTerm[]
}

export interface AnagathicsUse {
  term: CareerTerm
  survived: boolean
}

export const CAREER_CREATION_STATUSES = [
  'CHARACTERISTICS',
  'HOMEWORLD',
  'CAREER_SELECTION',
  'BASIC_TRAINING',
  'SURVIVAL',
  'MISHAP',
  'COMMISSION',
  'ADVANCEMENT',
  'SKILLS_TRAINING',
  'AGING',
  'REENLISTMENT',
  'MUSTERING_OUT',
  'ACTIVE',
  'PLAYABLE',
  'DECEASED'
] satisfies CareerCreationStatus[]

export const createCareerCreationState = (
  status: CareerCreationStatus = 'CHARACTERISTICS',
  context: Partial<CareerCreationContext> = {}
): CareerCreationState => ({
  status,
  context: {
    canCommission: context.canCommission ?? false,
    canAdvance: context.canAdvance ?? false
  }
})

export const isCareerCreationStatus = (
  value: string | null | undefined
): value is CareerCreationStatus =>
  CAREER_CREATION_STATUSES.includes(value as CareerCreationStatus)

const transitionStatus = (
  state: CareerCreationState,
  event: CareerCreationEvent
): CareerCreationState | null => {
  switch (state.status) {
    case 'CHARACTERISTICS':
      return event.type === 'SET_CHARACTERISTICS'
        ? { ...state, status: 'HOMEWORLD' }
        : null
    case 'HOMEWORLD':
      return event.type === 'COMPLETE_HOMEWORLD'
        ? { ...state, status: 'CAREER_SELECTION' }
        : null
    case 'CAREER_SELECTION':
      return event.type === 'SELECT_CAREER'
        ? {
            ...state,
            status: event.isNewCareer ? 'BASIC_TRAINING' : 'SURVIVAL'
          }
        : null
    case 'BASIC_TRAINING':
      return event.type === 'COMPLETE_BASIC_TRAINING'
        ? { ...state, status: 'SURVIVAL' }
        : null
    case 'SURVIVAL':
      if (event.type === 'SURVIVAL_FAILED') {
        return { ...state, status: 'MISHAP' }
      }
      if (event.type !== 'SURVIVAL_PASSED') return null
      return {
        status: event.canCommission
          ? 'COMMISSION'
          : event.canAdvance
            ? 'ADVANCEMENT'
            : 'SKILLS_TRAINING',
        context: {
          canCommission: event.canCommission,
          canAdvance: event.canAdvance
        }
      }
    case 'MISHAP':
      if (event.type === 'DEATH_CONFIRMED') {
        return { ...state, status: 'DECEASED' }
      }
      return event.type === 'MISHAP_RESOLVED'
        ? { ...state, status: 'MUSTERING_OUT' }
        : null
    case 'COMMISSION':
      return event.type === 'COMPLETE_COMMISSION' ||
        event.type === 'SKIP_COMMISSION'
        ? { ...state, status: 'SKILLS_TRAINING' }
        : null
    case 'ADVANCEMENT':
      return event.type === 'COMPLETE_ADVANCEMENT' ||
        event.type === 'SKIP_ADVANCEMENT'
        ? { ...state, status: 'SKILLS_TRAINING' }
        : null
    case 'SKILLS_TRAINING':
      return event.type === 'COMPLETE_SKILLS'
        ? { ...state, status: 'AGING' }
        : null
    case 'AGING':
      return event.type === 'COMPLETE_AGING'
        ? { ...state, status: 'REENLISTMENT' }
        : null
    case 'REENLISTMENT':
      if (event.type === 'REENLIST' || event.type === 'FORCED_REENLIST') {
        return { ...state, status: 'SURVIVAL' }
      }
      return event.type === 'LEAVE_CAREER' ||
        event.type === 'REENLIST_BLOCKED'
        ? { ...state, status: 'MUSTERING_OUT' }
        : null
    case 'MUSTERING_OUT':
      if (event.type === 'CONTINUE_CAREER') {
        return { ...state, status: 'CAREER_SELECTION' }
      }
      return event.type === 'FINISH_MUSTERING'
        ? { ...state, status: 'ACTIVE' }
        : null
    case 'ACTIVE':
      return event.type === 'CREATION_COMPLETE'
        ? { ...state, status: 'PLAYABLE' }
        : null
    case 'PLAYABLE':
      return null
    case 'DECEASED':
      return null
    default: {
      const exhaustive: never = state.status
      return exhaustive
    }
  }
}

export const transitionCareerCreationState = (
  state: CareerCreationState,
  event: CareerCreationEvent
): CareerCreationState => {
  if (event.type === 'RESET') {
    return createCareerCreationState('CHARACTERISTICS')
  }

  return transitionStatus(state, event) ?? state
}

export const canTransitionCareerCreationState = (
  state: CareerCreationState,
  event: CareerCreationEvent
): boolean => transitionCareerCreationState(state, event) !== state

export const characteristicModifier = (
  characteristic: number | null | undefined
): number => (characteristic == null ? 0 : Math.floor(characteristic / 3) - 2)

export const parseCareerCheck = (check: string): CareerCheck | null => {
  const trimmed = check.trim()
  if (!trimmed || trimmed === '-') return null

  const plainTarget = /^(\d+)\+$/.exec(trimmed)
  if (plainTarget) {
    return { characteristic: null, target: Number(plainTarget[1]) }
  }

  const characteristicTarget =
    /^(Str|Dex|End|Int|Edu|Soc)\s+(\d+)\+$/i.exec(trimmed)
  if (!characteristicTarget) return null

  return {
    characteristic: characteristicTarget[1].toLowerCase() as CharacteristicKey,
    target: Number(characteristicTarget[2])
  }
}

export const evaluateCareerCheck = ({
  check,
  characteristics,
  roll,
  dm = 0
}: {
  check: string
  characteristics: Partial<CharacterCharacteristics>
  roll: number
  dm?: number
}): CareerRollOutcome | null => {
  const parsed = parseCareerCheck(check)
  if (!parsed) return null

  const modifier =
    dm +
    (parsed.characteristic
      ? characteristicModifier(characteristics[parsed.characteristic])
      : 0)
  const total = roll + modifier

  return {
    check: parsed,
    modifier,
    total,
    success: total >= parsed.target
  }
}

export const deriveCareerQualificationDm = (
  previousCareerCount: number
): number => (previousCareerCount > 0 ? previousCareerCount * -2 : 0)

export const availableCareerNames = (
  careerBasics: CareerBasicsTable,
  servedCareerNames: readonly string[] = []
): string[] => {
  const unavailable = new Set(
    servedCareerNames.filter((career) => career !== 'Drifter')
  )

  return Object.keys(careerBasics).filter((career) => !unavailable.has(career))
}

export const deriveBasicTrainingPlan = ({
  career,
  serviceSkills,
  completedTermCount,
  previousCareerNames
}: {
  career: string
  serviceSkills: CareerSkillTable
  completedTermCount: number
  previousCareerNames: readonly string[]
}): BasicTrainingPlan => {
  const skills = Object.values(serviceSkills[career] ?? {})
  if (skills.length === 0) return { kind: 'none', skills: [] }

  if (completedTermCount === 0) {
    return { kind: 'all', skills }
  }

  const careerTerms = previousCareerNames.filter((name) => name === career)
  return careerTerms.length === 0
    ? { kind: 'choose-one', skills }
    : { kind: 'none', skills: [] }
}

export const deriveSurvivalPromotionOptions = (
  careerBasics: Pick<CareerBasics, 'Commission' | 'Advancement'>,
  currentRank: number
): SurvivalPromotionOptions => ({
  canCommission: currentRank === 0 && careerBasics.Commission !== '-',
  canAdvance: currentRank > 0 && careerBasics.Advancement !== '-'
})

export const isCascadeCareerSkill = (skill: string): boolean =>
  skill.includes('*')

export const formatCareerSkill = ({ name, level }: CareerSkill): string =>
  `${name}-${level}`

export const parseCareerSkill = (skill: string): CareerSkill | null => {
  const trimmed = skill.trim()
  if (!trimmed) return null

  const parsed = /^(.*?)-(-?\d+)$/.exec(trimmed)
  if (!parsed) return { name: trimmed, level: 0 }

  const name = parsed[1].trim()
  if (!name) return null

  return {
    name,
    level: Number(parsed[2])
  }
}

export const careerSkillWithLevel = (
  skill: string,
  level: number
): string => skill.trim().replace('*', `-${level}`)

export const normalizeCareerSkill = (
  skill: string,
  defaultLevel = 1
): string | null => {
  const trimmed = skill.trim()
  if (!trimmed) return null

  if (isCascadeCareerSkill(trimmed)) {
    return careerSkillWithLevel(trimmed, defaultLevel)
  }

  const parsed = parseCareerSkill(trimmed)
  if (!parsed) return null

  return formatCareerSkill({
    name: parsed.name,
    level: /-(-?\d+)$/.test(trimmed) ? parsed.level : defaultLevel
  })
}

export const tallyCareerSkills = (skills: readonly string[]): string[] => {
  const totals = new Map<string, number>()

  for (const skill of skills) {
    if (isCascadeCareerSkill(skill)) continue
    const parsed = parseCareerSkill(skill)
    if (!parsed) continue
    totals.set(parsed.name, (totals.get(parsed.name) ?? 0) + parsed.level)
  }

  return [...totals.entries()]
    .sort(([leftName, leftLevel], [rightName, rightLevel]) => {
      if (rightLevel !== leftLevel) return rightLevel - leftLevel
      return leftName.localeCompare(rightName)
    })
    .map(([name, level]) => formatCareerSkill({ name, level }))
}

export const resolveCascadeCareerSkill = ({
  pendingCascadeSkills,
  backgroundSkills = [],
  careerSkills = [],
  termSkills = [],
  cascadeSkill,
  selection,
  basicTraining = false
}: {
  pendingCascadeSkills: readonly string[]
  backgroundSkills?: readonly string[]
  careerSkills?: readonly string[]
  termSkills?: readonly string[]
  cascadeSkill: string
  selection: string
  basicTraining?: boolean
}): CascadeSkillResolution => {
  const remaining = pendingCascadeSkills.filter((skill) => skill !== cascadeSkill)
  const parsed = parseCareerSkill(cascadeSkill)
  const level = parsed?.level ?? 0

  if (isCascadeCareerSkill(selection)) {
    return {
      pendingCascadeSkills: [...remaining, careerSkillWithLevel(selection, level)],
      backgroundSkills: [...backgroundSkills],
      careerSkills: [...careerSkills],
      termSkills: [...termSkills]
    }
  }

  const resolvedSkill = formatCareerSkill({
    name: selection.trim(),
    level
  })

  return {
    pendingCascadeSkills: remaining,
    backgroundSkills: basicTraining
      ? [...backgroundSkills, resolvedSkill]
      : [...backgroundSkills],
    careerSkills: basicTraining
      ? [...careerSkills]
      : [...careerSkills, resolvedSkill],
    termSkills: [...termSkills, resolvedSkill]
  }
}

export const enumerateTermOutcomes = ({
  canCommission = false,
  canAdvance = false,
  canReenlist = true,
  mustRetire = false
}: {
  canCommission?: boolean
  canAdvance?: boolean
  canReenlist?: boolean
  mustRetire?: boolean
} = {}): TermOutcome[] => {
  const outcomes: TermOutcome[] = [
    {
      id: 'survival-fail',
      survival: 'fail',
      commission: 'na',
      advancement: 'na',
      reenlistment: 'blocked',
      decision: 'na',
      result: 'MISHAP'
    }
  ]

  const promotionPaths: Array<{
    commission: PromotionOutcome
    advancement: PromotionOutcome
  }> = []

  if (canCommission) {
    for (const commission of ['pass', 'fail', 'skip'] as const) {
      promotionPaths.push({ commission, advancement: 'na' })
    }
  }

  if (canAdvance) {
    for (const advancement of ['pass', 'fail', 'skip'] as const) {
      promotionPaths.push({ commission: 'na', advancement })
    }
  }

  if (promotionPaths.length === 0) {
    promotionPaths.push({ commission: 'na', advancement: 'na' })
  }

  const reenlistmentPaths: Array<{
    reenlistment: ReenlistmentOutcome
    decision: ReenlistmentDecision
    result: TermOutcomeResult
  }> = []

  if (mustRetire) {
    reenlistmentPaths.push({
      reenlistment: 'retire',
      decision: 'leave',
      result: 'MUSTERING_OUT'
    })
  } else if (!canReenlist) {
    reenlistmentPaths.push({
      reenlistment: 'blocked',
      decision: 'na',
      result: 'MUSTERING_OUT'
    })
  } else {
    reenlistmentPaths.push(
      {
        reenlistment: 'forced',
        decision: 'na',
        result: 'NEXT_TERM'
      },
      {
        reenlistment: 'allowed',
        decision: 'reenlist',
        result: 'NEXT_TERM'
      },
      {
        reenlistment: 'allowed',
        decision: 'leave',
        result: 'MUSTERING_OUT'
      },
      {
        reenlistment: 'blocked',
        decision: 'na',
        result: 'MUSTERING_OUT'
      }
    )
  }

  for (const promotion of promotionPaths) {
    for (const reenlistment of reenlistmentPaths) {
      outcomes.push({
        id: [
          'survival-pass',
          `commission-${promotion.commission}`,
          `advancement-${promotion.advancement}`,
          `reenlist-${reenlistment.reenlistment}`,
          `decision-${reenlistment.decision}`
        ].join('__'),
        survival: 'pass',
        commission: promotion.commission,
        advancement: promotion.advancement,
        reenlistment: reenlistment.reenlistment,
        decision: reenlistment.decision,
        result: reenlistment.result
      })
    }
  }

  return outcomes
}

export const deriveCareerBenefitCount = ({
  termsInCareer,
  currentRank
}: {
  termsInCareer: number
  currentRank: number
}): number => termsInCareer + Math.max(0, currentRank - 3)

export const deriveRemainingCareerBenefits = ({
  termsInCareer,
  currentRank,
  benefitsReceived
}: {
  termsInCareer: number
  currentRank: number
  benefitsReceived: number
}): number =>
  Math.max(
    0,
    deriveCareerBenefitCount({ termsInCareer, currentRank }) - benefitsReceived
  )

export const resolveCareerBenefit = ({
  tables,
  career,
  roll,
  kind
}: {
  tables: BenefitTables
  career: string
  roll: number
  kind: BenefitKind
}): CareerBenefit => {
  const key = String(roll)
  if (kind === 'cash') {
    const rawCash = tables.cashBenefits[career]?.[key] ?? 0
    const credits =
      typeof rawCash === 'number' ? rawCash : Number.parseInt(rawCash, 10)
    const resolvedCredits = Number.isFinite(credits) ? credits : 0
    return {
      kind: 'cash',
      value: String(resolvedCredits),
      credits: resolvedCredits
    }
  }

  const value = tables.materialBenefits[career]?.[key] ?? 'Unknown Benefit'
  return {
    kind: 'material',
    value,
    credits: 0
  }
}

export const selectAgingEffect = (
  table: readonly AgingEffect[],
  roll: number
): AgingEffect | null => {
  if (roll === 0 || table.length === 0) return null

  const rolls = table.map((effect) => Number(effect.Roll))
  const minRoll = Math.min(...rolls)
  const maxRoll = Math.max(...rolls)
  const clampedRoll = Math.max(minRoll, Math.min(maxRoll, roll))

  return (
    table.find((effect) => Number(effect.Roll) === clampedRoll) ?? null
  )
}

export const resolveAging = ({
  currentAge,
  table,
  roll,
  years = 4
}: {
  currentAge: number | null | undefined
  table: readonly AgingEffect[]
  roll: number
  years?: number
}): AgingResolution => {
  const age = (currentAge ?? 18) + years
  const effect = selectAgingEffect(table, roll)
  const changes = effect?.Changes ?? []

  if (roll === 0) {
    return {
      age,
      message: `Character aged to ${age}.`,
      characteristicChanges: []
    }
  }

  if (changes.length === 0) {
    return {
      age,
      message: 'No aging effects.',
      characteristicChanges: []
    }
  }

  return {
    age,
    message: effect?.Effects ?? 'No aging effects.',
    characteristicChanges: changes.map((change) => ({ ...change }))
  }
}

const cloneCareerTerm = (term: CareerTerm): CareerTerm => ({
  ...term,
  skills: [...term.skills],
  skillsAndTraining: [...term.skillsAndTraining],
  benefits: [...term.benefits]
})

export const createCareerTerm = ({
  career,
  completedBasicTraining = false,
  drafted = false
}: {
  career: string
  completedBasicTraining?: boolean
  drafted?: boolean
}): CareerTerm => ({
  career,
  skills: [],
  skillsAndTraining: [],
  benefits: [],
  complete: false,
  canReenlist: true,
  completedBasicTraining,
  musteringOut: false,
  anagathics: false,
  ...(drafted ? { draft: 1 as const } : {})
})

export const startCareerTerm = ({
  career,
  terms,
  careers,
  drafted = false
}: {
  career: string
  terms: readonly CareerTerm[]
  careers: readonly CareerRank[]
  drafted?: boolean
}): CareerTermStart => {
  const completedBasicTraining = terms.some((term) => term.career === career)
  const nextTerms = terms.map((term, index) =>
    index === terms.length - 1 ? { ...cloneCareerTerm(term), complete: true } : cloneCareerTerm(term)
  )

  const hasCareer = careers.some((entry) => entry.name === career)
  const nextCareers = hasCareer
    ? careers.map((entry) => ({ ...entry }))
    : [...careers.map((entry) => ({ ...entry })), { name: career, rank: 0 }]

  return {
    terms: [
      ...nextTerms,
      createCareerTerm({ career, completedBasicTraining, drafted })
    ],
    careers: nextCareers,
    canEnterDraft: !drafted,
    failedToQualify: false
  }
}

export const leaveCareerTerm = (term: CareerTerm): CareerTerm => ({
  ...cloneCareerTerm(term),
  musteringOut: true,
  canReenlist: false,
  complete: true
})

export const mustResolveAging = ({
  age,
  termCount
}: {
  age: number | null | undefined
  termCount: number
}): boolean => (age ?? 0) < 18 + termCount * 4

export const deriveAnagathicsModifier = (
  terms: readonly Pick<CareerTerm, 'anagathics'>[]
): number =>
  terms.reduce((total, term) => total + (term.anagathics ? 1 : 0), 0)

export const deriveAgingRollModifier = (
  terms: readonly Pick<CareerTerm, 'anagathics'>[]
): number => deriveAnagathicsModifier(terms) - terms.length

export const payForAnagathics = ({
  credits,
  terms,
  cost
}: {
  credits: number
  terms: readonly CareerTerm[]
  cost: number
}): AnagathicsPayment => {
  const nextTerms = terms.map(cloneCareerTerm)
  if (nextTerms.length > 0) {
    nextTerms[nextTerms.length - 1] = {
      ...nextTerms[nextTerms.length - 1],
      anagathicsCost: cost
    }
  }

  return {
    credits: credits - cost,
    terms: nextTerms
  }
}

export const resolveAnagathicsUse = ({
  term,
  survived
}: {
  term: CareerTerm
  survived: boolean
}): AnagathicsUse => ({
  term: {
    ...cloneCareerTerm(term),
    anagathics: survived
  },
  survived
})

export const canOfferAnagathics = ({
  noOutstandingSelections = true,
  term,
  hasCareerBasics = true
}: {
  noOutstandingSelections?: boolean
  term: CareerTerm | null | undefined
  hasCareerBasics?: boolean
}): boolean =>
  noOutstandingSelections &&
  !!term &&
  hasCareerBasics &&
  term.survival === undefined &&
  !term.anagathics

export const canOfferReenlistment = ({
  noOutstandingSelections = true,
  term,
  mustAge = false
}: {
  noOutstandingSelections?: boolean
  term: CareerTerm | null | undefined
  mustAge?: boolean
}): boolean =>
  noOutstandingSelections &&
  !!term &&
  term.skillsAndTraining.length > 0 &&
  !mustAge &&
  term.reEnlistment === undefined

export const canOfferMusteringBenefit = ({
  noOutstandingSelections = true,
  remainingBenefits
}: {
  noOutstandingSelections?: boolean
  remainingBenefits: number
}): boolean => noOutstandingSelections && remainingBenefits > 0

export const canOfferNewCareer = ({
  noOutstandingSelections = true,
  termCount,
  remainingBenefits
}: {
  noOutstandingSelections?: boolean
  termCount: number
  remainingBenefits: number
}): boolean => noOutstandingSelections && termCount < 7 && remainingBenefits === 0

export const canCompleteCreation = ({
  noOutstandingSelections = true,
  terms
}: {
  noOutstandingSelections?: boolean
  terms: readonly CareerTerm[]
}): boolean =>
  noOutstandingSelections &&
  terms.length > 0 &&
  terms[terms.length - 1]?.complete === true

export const canStartNextCareerTerm = ({
  termCount,
  term,
  noOutstandingSelections = true
}: {
  termCount: number
  term: CareerTerm | null | undefined
  noOutstandingSelections?: boolean
}): boolean =>
  noOutstandingSelections &&
  termCount < 7 &&
  !!term?.canReenlist &&
  !term.musteringOut &&
  term.career !== 'Drifter'

export const resolveReenlistment = ({
  term,
  termCount,
  roll,
  check,
  characteristics
}: {
  term: CareerTerm
  termCount: number
  roll: number
  check: string
  characteristics: Partial<CharacterCharacteristics>
}): ReenlistmentResolution => {
  if (termCount >= 7) {
    return {
      outcome: 'retire',
      message: 'Your character must retire.',
      term: leaveCareerTerm(term),
      nextTermCareer: null
    }
  }

  if (roll === 12) {
    return {
      outcome: 'forced',
      message: 'Your character must reenlist.',
      term: cloneCareerTerm(term),
      nextTermCareer: term.career
    }
  }

  const result = evaluateCareerCheck({
    check,
    characteristics,
    roll
  })

  if (result?.success) {
    return {
      outcome: 'allowed',
      message: 'Your character may reenlist.',
      term: {
        ...cloneCareerTerm(term),
        canReenlist: true,
        reEnlistment: roll
      },
      nextTermCareer: null
    }
  }

  return {
    outcome: 'blocked',
    message: 'Your character may not reenlist.',
    term: leaveCareerTerm(term),
    nextTermCareer: null
  }
}
