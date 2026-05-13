import type { EventEnvelope, GameEvent } from './events'
import { boardEventHandlers } from './projection/board'
import { characterEventHandlers } from './projection/character-creation'
import { diceEventHandlers } from './projection/dice'
import { gameEventHandlers } from './projection/game'
import type {
  EventEnvelopeFor,
  EventHandler,
  EventHandlerRegistry
} from './projection/types'
import type { GameState } from './state'

const eventHandlers = {
  ...gameEventHandlers,
  ...characterEventHandlers,
  ...boardEventHandlers,
  ...diceEventHandlers
} satisfies EventHandlerRegistry

const projectEnvelope = <TEvent extends GameEvent>(
  state: GameState | null,
  envelope: EventEnvelopeFor<TEvent>
): GameState | null => {
  const handler = eventHandlers[envelope.event.type] as EventHandler<TEvent>
  return handler(state, envelope)
}

const hasEventHandler = (eventType: string): eventType is GameEvent['type'] =>
  Object.hasOwn(eventHandlers, eventType)

export const projectGameState = (
  events: readonly EventEnvelope[],
  initialState: GameState | null = null
): GameState | null => {
  let state: GameState | null =
    initialState === null ? null : structuredClone(initialState)

  for (const envelope of events) {
    const event = envelope.event
    if (!hasEventHandler(event.type)) {
      throw new Error(`Unhandled event ${(event as { type: string }).type}`)
    }
    state = projectEnvelope(state, envelope)
  }

  return state
}
