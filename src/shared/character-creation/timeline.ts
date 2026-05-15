import type { EventEnvelope, GameEvent } from '../events'
import type {
  CareerCreationEvent,
  CharacterCreationTimelineEntry
} from './types'

export interface CharacterCreationTimelineContext {
  readonly canEnterDraft?: boolean
}

export const deriveCharacterCreationHistoryEvent = (
  event: GameEvent,
  context: CharacterCreationTimelineContext = {}
): CareerCreationEvent | null => {
  switch (event.type) {
    case 'CharacterCreationTransitioned':
      return structuredClone(event.creationEvent)
    case 'CharacterCreationCharacteristicsCompleted':
      return { type: 'SET_CHARACTERISTICS' }
    case 'CharacterCreationMishapResolved':
      return { type: 'MISHAP_RESOLVED' }
    case 'CharacterCreationDeathConfirmed':
      return { type: 'DEATH_CONFIRMED' }
    case 'CharacterCreationBasicTrainingCompleted':
      return { type: 'COMPLETE_BASIC_TRAINING' }
    case 'CharacterCreationQualificationResolved':
      return event.passed
        ? {
            type: 'SELECT_CAREER',
            isNewCareer: true,
            qualification: structuredClone(event.qualification)
          }
        : {
            type: 'SELECT_CAREER',
            isNewCareer: false,
            qualification: structuredClone(event.qualification),
            failedQualificationOptions: [...event.failedQualificationOptions],
            canEnterDraft: context.canEnterDraft
          }
    case 'CharacterCreationDraftResolved':
      return {
        type: 'SELECT_CAREER',
        isNewCareer: true,
        drafted: true
      }
    case 'CharacterCreationDrifterEntered':
      return {
        type: 'SELECT_CAREER',
        isNewCareer: true,
        failedQualificationOptions: ['Drifter']
      }
    case 'CharacterCreationSurvivalResolved':
      return event.passed
        ? {
            type: 'SURVIVAL_PASSED',
            canCommission: event.canCommission,
            canAdvance: event.canAdvance,
            survival: structuredClone(event.survival)
          }
        : {
            type: 'SURVIVAL_FAILED',
            survival: structuredClone(event.survival)
          }
    case 'CharacterCreationCommissionResolved':
      return {
        type: 'COMPLETE_COMMISSION',
        commission: structuredClone(event.commission)
      }
    case 'CharacterCreationCommissionSkipped':
      return { type: 'SKIP_COMMISSION' }
    case 'CharacterCreationAdvancementResolved':
      return {
        type: 'COMPLETE_ADVANCEMENT',
        advancement: structuredClone(event.advancement),
        rank: event.rank ? structuredClone(event.rank) : null
      }
    case 'CharacterCreationAdvancementSkipped':
      return { type: 'SKIP_ADVANCEMENT' }
    case 'CharacterCreationTermSkillRolled':
      return {
        type: 'ROLL_TERM_SKILL',
        termSkill: structuredClone(event.termSkill)
      }
    case 'CharacterCreationAgingResolved':
      return {
        type: 'COMPLETE_AGING',
        aging: structuredClone(event.aging)
      }
    case 'CharacterCreationAnagathicsDecided':
      return {
        type: 'DECIDE_ANAGATHICS',
        useAnagathics: event.useAnagathics,
        termIndex: event.termIndex,
        ...(event.cost !== undefined ? { cost: event.cost } : {}),
        ...(event.costRoll ? { costRoll: structuredClone(event.costRoll) } : {})
      }
    case 'CharacterCreationReenlistmentResolved':
      return {
        type: 'RESOLVE_REENLISTMENT',
        reenlistment: structuredClone(event.reenlistment)
      }
    case 'CharacterCreationCareerReenlisted':
      return { type: event.forced ? 'FORCED_REENLIST' : 'REENLIST' }
    case 'CharacterCreationCareerLeft':
      return {
        type: event.outcome === 'blocked' ? 'REENLIST_BLOCKED' : 'LEAVE_CAREER'
      }
    case 'CharacterCreationTermCascadeSkillResolved':
      return {
        type: 'RESOLVE_TERM_CASCADE_SKILL',
        cascadeSkill: event.cascadeSkill,
        selection: event.selection
      }
    case 'CharacterCreationSkillsCompleted':
      return { type: 'COMPLETE_SKILLS' }
    case 'CharacterCreationMusteringBenefitRolled':
      return {
        type: 'FINISH_MUSTERING',
        musteringBenefit: structuredClone(event.musteringBenefit)
      }
    case 'CharacterCreationAfterMusteringContinued':
      return { type: 'CONTINUE_CAREER' }
    case 'CharacterCreationMusteringCompleted':
      return { type: 'FINISH_MUSTERING' }
    case 'CharacterCreationCompleted':
      return { type: 'CREATION_COMPLETE' }
    case 'CharacterCreationHomeworldCompleted':
      return { type: 'COMPLETE_HOMEWORLD' }
    default:
      return null
  }
}

const isCharacterCreationTimelineEvent = (
  event: GameEvent
): event is Extract<GameEvent, { characterId: unknown }> =>
  event.type.startsWith('CharacterCreation') ||
  event.type === 'CharacterCareerTermStarted'

const rollEventIdFor = (event: GameEvent) =>
  'rollEventId' in event ? event.rollEventId : undefined

export const deriveCharacterCreationTimelineEntry = (
  envelope: EventEnvelope
): CharacterCreationTimelineEntry | null => {
  const event = envelope.event
  if (!isCharacterCreationTimelineEvent(event)) return null

  return {
    eventId: envelope.id,
    seq: envelope.seq,
    createdAt: envelope.createdAt,
    eventType: event.type,
    ...(rollEventIdFor(event) ? { rollEventId: rollEventIdFor(event) } : {})
  }
}
