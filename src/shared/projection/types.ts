import type { EventEnvelope, GameEvent } from '../events'
import type { GameState } from '../state'

export type EventEnvelopeFor<TEvent extends GameEvent> = Omit<
  EventEnvelope,
  'event'
> & {
  event: TEvent
}

export type EventHandler<TEvent extends GameEvent> = (
  state: GameState | null,
  envelope: EventEnvelopeFor<TEvent>
) => GameState | null

export type EventHandlerRegistry = {
  [TType in GameEvent['type']]: EventHandler<
    Extract<GameEvent, { type: TType }>
  >
}

export type EventHandlerMap<TEventType extends GameEvent['type']> = {
  [TType in TEventType]: EventHandler<Extract<GameEvent, { type: TType }>>
}
