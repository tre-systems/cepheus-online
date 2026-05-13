import type { EventHandlerMap } from './types'

type GameEventType = 'GameCreated'

export const gameEventHandlers = {
  GameCreated: (_state, envelope) => {
    const event = envelope.event

    return {
      id: envelope.gameId,
      slug: event.slug,
      name: event.name,
      ownerId: event.ownerId,
      players: {
        [event.ownerId]: {
          userId: event.ownerId,
          role: 'REFEREE'
        }
      },
      characters: {},
      boards: {},
      pieces: {},
      diceLog: [],
      selectedBoardId: null,
      eventSeq: envelope.seq
    }
  }
} satisfies EventHandlerMap<GameEventType>
