import type { EventEnvelope } from '../../shared/events'
import type { GameState } from '../../shared/state'

export const CHECKPOINT_INTERVAL = 64

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

export const shouldSaveCheckpoint = (
  state: GameState,
  envelopes: readonly EventEnvelope[]
): boolean =>
  isInitialCreationCheckpointBoundary(state) ||
  isIntervalCheckpointBoundary(state) ||
  hasCharacterCreationCompletionCheckpointBoundary(envelopes)
