import type {EventEnvelope} from './events'
import type {GameState} from './state'

export const projectGameState = (
  events: readonly EventEnvelope[],
  initialState: GameState | null = null
): GameState | null => {
  let state: GameState | null =
    initialState === null ? null : structuredClone(initialState)

  for (const envelope of events) {
    const event = envelope.event

    switch (event.type) {
      case 'GameCreated':
        state = {
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
        break

      case 'CharacterCreated':
        if (!state) throw new Error('CharacterCreated before GameCreated')
        state.characters[event.characterId] = {
          id: event.characterId,
          ownerId: event.ownerId,
          type: event.characterType,
          name: event.name,
          active: true,
          notes: ''
        }
        state.eventSeq = envelope.seq
        break

      case 'BoardCreated':
        if (!state) throw new Error('BoardCreated before GameCreated')
        state.boards[event.boardId] = {
          id: event.boardId,
          name: event.name,
          imageAssetId: event.imageAssetId,
          url: event.url,
          width: event.width,
          height: event.height,
          scale: event.scale
        }
        state.selectedBoardId = state.selectedBoardId ?? event.boardId
        state.eventSeq = envelope.seq
        break

      case 'PieceCreated':
        if (!state) throw new Error('PieceCreated before GameCreated')
        state.pieces[event.pieceId] = {
          id: event.pieceId,
          boardId: event.boardId,
          characterId: null,
          imageAssetId: event.imageAssetId,
          name: event.name,
          x: event.x,
          y: event.y,
          z: 0,
          width: 50,
          height: 50,
          scale: 1,
          visibility: 'PREVIEW',
          freedom: 'LOCKED'
        }
        state.eventSeq = envelope.seq
        break

      case 'PieceMoved':
        if (!state) throw new Error('PieceMoved before GameCreated')
        if (!state.pieces[event.pieceId]) break
        state.pieces[event.pieceId].x = event.x
        state.pieces[event.pieceId].y = event.y
        state.eventSeq = envelope.seq
        break

      case 'PieceVisibilityChanged':
        if (!state) throw new Error('PieceVisibilityChanged before GameCreated')
        if (!state.pieces[event.pieceId]) break
        state.pieces[event.pieceId].visibility = event.visibility
        state.eventSeq = envelope.seq
        break

      case 'PieceFreedomChanged':
        if (!state) throw new Error('PieceFreedomChanged before GameCreated')
        if (!state.pieces[event.pieceId]) break
        state.pieces[event.pieceId].freedom = event.freedom
        state.eventSeq = envelope.seq
        break

      case 'DiceRolled':
        if (!state) throw new Error('DiceRolled before GameCreated')
        state.diceLog.push({
          id: envelope.id,
          actorId: envelope.actorId,
          createdAt: envelope.createdAt,
          expression: event.expression,
          reason: event.reason,
          rolls: event.rolls,
          total: event.total
        })
        if (state.diceLog.length > 20) {
          state.diceLog.splice(0, state.diceLog.length - 20)
        }
        state.eventSeq = envelope.seq
        break

      default: {
        const exhaustive: never = event
        throw new Error(`Unhandled event ${(exhaustive as {type: string}).type}`)
      }
    }
  }

  return state
}
