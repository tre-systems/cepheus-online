import type {
  CharacterCreationActivityDescriptor,
  LiveActivityDescriptor
} from '../../shared/live-activity'
import type { ClientMessageApplication } from '../game-commands'

export type CreationActivityCardTone = 'neutral' | 'success' | 'warning'

export interface CreationActivityCardViewModel {
  title: string
  detail: string
  tone: CreationActivityCardTone
  seq: number
}

export interface CreationActivityCardOptions {
  viewerActorId?: string | null
}

export const MAX_CREATION_ACTIVITY_TITLE_LENGTH = 48
export const MAX_CREATION_ACTIVITY_DETAIL_LENGTH = 96

export const SRD_CREATION_ACTIVITY_MILESTONE_TRANSITIONS = [
  'SELECT_CAREER',
  'CAREER_QUALIFICATION_PASSED',
  'CAREER_QUALIFICATION_FAILED',
  'DRAFT_RESOLVED',
  'DRIFTER_ENTERED',
  'CAREER_TERM_STARTED',
  'COMPLETE_BASIC_TRAINING',
  'SURVIVAL_PASSED',
  'SURVIVAL_FAILED',
  'COMPLETE_COMMISSION',
  'SKIP_COMMISSION',
  'COMPLETE_ADVANCEMENT',
  'SKIP_ADVANCEMENT',
  'COMPLETE_AGING',
  'REENLIST',
  'LEAVE_CAREER',
  'REENLIST_BLOCKED',
  'FORCED_REENLIST',
  'CONTINUE_CAREER',
  'FINISH_MUSTERING',
  'CREATION_COMPLETE',
  'FINALIZED'
] as const

const creationActivityToastTransitions = new Set<string>(
  SRD_CREATION_ACTIVITY_MILESTONE_TRANSITIONS
)

const transitionTitles = {
  STARTED: 'Character creation started',
  SET_CHARACTERISTICS: 'Characteristics assigned',
  CharacterCreationCharacteristicsCompleted: 'Characteristics assigned',
  HOMEWORLD_SET: 'Homeworld selected',
  COMPLETE_HOMEWORLD: 'Homeworld complete',
  BACKGROUND_SKILL_SELECTED: 'Background skill selected',
  CASCADE_SKILL_RESOLVED: 'Cascade skill resolved',
  SELECT_CAREER: 'Career selected',
  CAREER_QUALIFICATION_PASSED: 'Qualification passed',
  CAREER_QUALIFICATION_FAILED: 'Qualification failed',
  DRAFT_RESOLVED: 'Draft resolved',
  DRIFTER_ENTERED: 'Entered Drifter',
  CAREER_TERM_STARTED: 'Career term started',
  COMPLETE_BASIC_TRAINING: 'Basic training complete',
  SURVIVAL_PASSED: 'Survival passed',
  SURVIVAL_FAILED: 'Killed in service',
  MISHAP_RESOLVED: 'Mishap resolved',
  COMPLETE_COMMISSION: 'Commission earned',
  SKIP_COMMISSION: 'Commission skipped',
  COMPLETE_ADVANCEMENT: 'Advancement earned',
  SKIP_ADVANCEMENT: 'Advancement skipped',
  COMPLETE_SKILLS: 'Skills complete',
  COMPLETE_AGING: 'Aging resolved',
  REENLIST: 'Reenlisted',
  LEAVE_CAREER: 'Left career',
  REENLIST_BLOCKED: 'Reenlistment blocked',
  FORCED_REENLIST: 'Forced reenlistment',
  CONTINUE_CAREER: 'Career continued',
  FINISH_MUSTERING: 'Mustering complete',
  CREATION_COMPLETE: 'Creation complete',
  DEATH_CONFIRMED: 'Death confirmed',
  RESET: 'Creation reset',
  FINALIZED: 'Character finalized'
} as const

const successTransitions = new Set([
  'FINALIZED',
  'CREATION_COMPLETE',
  'CAREER_QUALIFICATION_PASSED',
  'DRAFT_RESOLVED',
  'DRIFTER_ENTERED',
  'SURVIVAL_PASSED',
  'COMPLETE_BASIC_TRAINING',
  'COMPLETE_COMMISSION',
  'COMPLETE_ADVANCEMENT',
  'FINISH_MUSTERING'
])

const warningTransitions = new Set([
  'SURVIVAL_FAILED',
  'CAREER_QUALIFICATION_FAILED',
  'DEATH_CONFIRMED',
  'REENLIST_BLOCKED',
  'FORCED_REENLIST',
  'RESET'
])

const boundDisplayText = (value: string, maxLength: number): string => {
  const compact = value.trim().replace(/\s+/g, ' ')
  if (compact.length <= maxLength) return compact

  return `${compact.slice(0, maxLength - 3)}...`
}

const fallbackTitle = (transition: string): string => {
  const words = transition
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
  if (words.length === 0) return 'Character creation updated'

  return boundDisplayText(
    words
      .map((word, index) =>
        index === 0 ? word[0].toUpperCase() + word.slice(1) : word
      )
      .join(' '),
    MAX_CREATION_ACTIVITY_TITLE_LENGTH
  )
}

export const deriveCreationActivityCardTone = (
  activity: CharacterCreationActivityDescriptor
): CreationActivityCardTone => {
  if (
    activity.creationComplete ||
    activity.status === 'PLAYABLE' ||
    successTransitions.has(activity.transition)
  ) {
    return 'success'
  }

  if (
    activity.status === 'DECEASED' ||
    activity.status === 'MISHAP' ||
    warningTransitions.has(activity.transition)
  ) {
    return 'warning'
  }

  return 'neutral'
}

export const deriveCreationActivityCard = (
  activity: CharacterCreationActivityDescriptor
): CreationActivityCardViewModel => ({
  title: boundDisplayText(
    transitionTitles[activity.transition as keyof typeof transitionTitles] ??
      fallbackTitle(activity.transition),
    MAX_CREATION_ACTIVITY_TITLE_LENGTH
  ),
  detail: boundDisplayText(
    activity.details || 'Character creation updated',
    MAX_CREATION_ACTIVITY_DETAIL_LENGTH
  ),
  tone: deriveCreationActivityCardTone(activity),
  seq: activity.seq
})

export const deriveCreationActivityCards = (
  activities: readonly LiveActivityDescriptor[],
  { viewerActorId = null }: CreationActivityCardOptions = {}
): CreationActivityCardViewModel[] => {
  const cards: CreationActivityCardViewModel[] = []

  for (const activity of activities) {
    if (activity.type !== 'characterCreation') continue
    if (viewerActorId && activity.actorId === viewerActorId) continue
    if (
      !activity.creationComplete &&
      activity.status !== 'DECEASED' &&
      activity.status !== 'MISHAP' &&
      !creationActivityToastTransitions.has(activity.transition)
    ) {
      continue
    }
    cards.push(deriveCreationActivityCard(activity))
  }

  return cards
}

export const deriveCreationActivityCardsFromApplication = (
  application: Pick<ClientMessageApplication, 'liveActivities'>,
  options: CreationActivityCardOptions = {}
): CreationActivityCardViewModel[] =>
  deriveCreationActivityCards(application.liveActivities, options)
