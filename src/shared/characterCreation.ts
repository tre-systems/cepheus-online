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
