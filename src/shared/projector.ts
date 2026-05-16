import type { EventEnvelope, GameEvent } from './events'
import { boardEventHandlers } from './projection/board'
import {
  type CharacterCreationProjectionOptions,
  createCharacterEventHandlers
} from './projection/character-creation'
import { diceEventHandlers } from './projection/dice'
import { gameEventHandlers } from './projection/game'
import type {
  EventEnvelopeFor,
  EventHandler,
  EventHandlerRegistry
} from './projection/types'
import type { GameState } from './state'

export type ProjectGameStateOptions = CharacterCreationProjectionOptions

const createEventHandlers = (options: ProjectGameStateOptions = {}) =>
  ({
    ...gameEventHandlers,
    ...createCharacterEventHandlers(options),
    ...boardEventHandlers,
    ...diceEventHandlers
  }) satisfies EventHandlerRegistry

const defaultEventHandlers = createEventHandlers()

const hasEventHandler = (
  eventHandlers: EventHandlerRegistry,
  eventType: string
): eventType is GameEvent['type'] => Object.hasOwn(eventHandlers, eventType)

const projectEnvelope = <TEvent extends GameEvent>(
  state: GameState | null,
  envelope: EventEnvelopeFor<TEvent>,
  eventHandlers: EventHandlerRegistry
): GameState | null => {
  const handler = eventHandlers[envelope.event.type] as EventHandler<TEvent>
  return handler(state, envelope)
}

const eventHandlersForOptions = (
  options: ProjectGameStateOptions
): EventHandlerRegistry =>
  options.resolveRulesetById
    ? createEventHandlers(options)
    : defaultEventHandlers

export const projectGameState = (
  events: readonly EventEnvelope[],
  initialState: GameState | null = null,
  options: ProjectGameStateOptions = {}
): GameState | null => {
  let state: GameState | null =
    initialState === null ? null : structuredClone(initialState)
  const eventHandlers = eventHandlersForOptions(options)

  for (const envelope of events) {
    const event = envelope.event
    if (!hasEventHandler(eventHandlers, event.type)) {
      throw new Error(`Unhandled event ${(event as { type: string }).type}`)
    }
    state = projectEnvelope(state, envelope, eventHandlers)
  }

  return state
}
