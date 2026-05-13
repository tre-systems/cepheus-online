import { requireState } from './state'
import type { EventHandlerMap } from './types'

type DiceEventType = 'DiceRolled'

const diceRevealAt = (createdAt: string): string =>
  new Date(Date.parse(createdAt) + 2500).toISOString()

export const diceEventHandlers = {
  DiceRolled: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.diceLog.push({
      id: envelope.id,
      actorId: envelope.actorId,
      createdAt: envelope.createdAt,
      revealAt: diceRevealAt(envelope.createdAt),
      expression: event.expression,
      reason: event.reason,
      rolls: event.rolls,
      total: event.total
    })
    if (nextState.diceLog.length > 20) {
      nextState.diceLog.splice(0, nextState.diceLog.length - 20)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<DiceEventType>
