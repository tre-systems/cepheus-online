import type { CareerCreationEvent, CareerCreationState, CareerCreationStatus, CareerCreationContext } from './types'

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
      if (event.type === 'COMPLETE_COMMISSION') {
        return {
          ...state,
          status: state.context.canAdvance ? 'ADVANCEMENT' : 'SKILLS_TRAINING'
        }
      }
      return event.type === 'SKIP_COMMISSION'
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
