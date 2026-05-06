import type { CareerCreationStatus } from './characterCreation'
import type { EventEnvelope } from './events'
import type { CharacterId, EventId, GameId, UserId } from './ids'

export const LIVE_DICE_RESULT_REVEAL_DELAY_MS = 2500

export type LiveActivityDescriptor =
  | DiceRollActivityDescriptor
  | CharacterCreationActivityDescriptor

export interface LiveActivityBase {
  id: EventId
  eventId: EventId
  gameId: GameId
  seq: number
  actorId: UserId | null
  createdAt: string
}

export interface DiceRollActivityDescriptor extends LiveActivityBase {
  type: 'diceRoll'
  expression: string
  reason: string
  rolls: number[]
  total: number
  reveal: {
    revealAt: string
    delayMs: number
  }
}

export interface CharacterCreationActivityDescriptor extends LiveActivityBase {
  type: 'characterCreation'
  characterId: CharacterId
  transition: string
  status: CareerCreationStatus
  creationComplete: boolean
}

export const deriveLiveActivityRevealAt = (
  createdAt: string,
  delayMs = LIVE_DICE_RESULT_REVEAL_DELAY_MS
): string => new Date(Date.parse(createdAt) + delayMs).toISOString()

const baseActivity = (envelope: EventEnvelope): LiveActivityBase => ({
  id: envelope.id,
  eventId: envelope.id,
  gameId: envelope.gameId,
  seq: envelope.seq,
  actorId: envelope.actorId,
  createdAt: envelope.createdAt
})

export const deriveLiveActivity = (
  envelope: EventEnvelope
): LiveActivityDescriptor | null => {
  const event = envelope.event

  switch (event.type) {
    case 'DiceRolled':
      return {
        ...baseActivity(envelope),
        type: 'diceRoll',
        expression: event.expression,
        reason: event.reason,
        rolls: [...event.rolls],
        total: event.total,
        reveal: {
          revealAt: deriveLiveActivityRevealAt(envelope.createdAt),
          delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
        }
      }

    case 'CharacterCreationTransitioned':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.creationEvent.type,
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationStarted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'STARTED',
        status: event.creation.state.status,
        creationComplete: event.creation.creationComplete
      }

    case 'CharacterCreationFinalized':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'FINALIZED',
        status: 'PLAYABLE',
        creationComplete: true
      }

    default:
      return null
  }
}

export const deriveLiveActivities = (
  envelopes: readonly EventEnvelope[]
): LiveActivityDescriptor[] => {
  const activities: LiveActivityDescriptor[] = []

  for (const envelope of envelopes) {
    const activity = deriveLiveActivity(envelope)
    if (activity) activities.push(activity)
  }

  return activities
}
