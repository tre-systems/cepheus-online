import type { EventEnvelope } from '../../shared/events'
import type { GameState } from '../../shared/state'

export const CHECKPOINT_INTERVAL = 64

export type CheckpointReason =
  | 'game_creation'
  | 'event_interval'
  | 'character_creation_completion'

export interface CheckpointDecision {
  readonly shouldSave: boolean
  readonly reasons: readonly CheckpointReason[]
}

export const isInitialCreationCheckpointBoundary = (
  state: GameState
): boolean => state.eventSeq === 1

export const isIntervalCheckpointBoundary = (state: GameState): boolean =>
  state.eventSeq % CHECKPOINT_INTERVAL === 0

export const hasCharacterCreationCompletionCheckpointBoundary = (
  envelopes: readonly EventEnvelope[]
): boolean =>
  envelopes.some(
    (envelope) =>
      (envelope.event.type === 'CharacterCreationTransitioned' &&
        envelope.event.creationComplete) ||
      (envelope.event.type === 'CharacterCreationCharacteristicsCompleted' &&
        envelope.event.creationComplete) ||
      envelope.event.type === 'CharacterCreationCompleted'
  )

export const deriveCheckpointDecision = (
  state: GameState,
  envelopes: readonly EventEnvelope[]
): CheckpointDecision => {
  const reasons: CheckpointReason[] = []

  if (isInitialCreationCheckpointBoundary(state)) {
    reasons.push('game_creation')
  }

  if (isIntervalCheckpointBoundary(state)) {
    reasons.push('event_interval')
  }

  if (hasCharacterCreationCompletionCheckpointBoundary(envelopes)) {
    reasons.push('character_creation_completion')
  }

  return {
    shouldSave: reasons.length > 0,
    reasons
  }
}
