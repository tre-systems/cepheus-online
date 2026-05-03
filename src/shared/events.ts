import type {BoardId, CharacterId, EventId, GameId, PieceId, UserId} from './ids'
import type {CharacterType, PieceFreedom, PieceVisibility} from './state'

export interface EventEnvelope {
  id: EventId
  gameId: GameId
  seq: number
  actorId: UserId | null
  createdAt: string
  event: GameEvent
}

export type GameEvent =
  | {
      type: 'GameCreated'
      slug: string
      name: string
      ownerId: UserId
    }
  | {
      type: 'CharacterCreated'
      characterId: CharacterId
      ownerId: UserId | null
      characterType: CharacterType
      name: string
    }
  | {
      type: 'BoardCreated'
      boardId: BoardId
      name: string
      width: number
      height: number
      scale: number
    }
  | {
      type: 'PieceCreated'
      pieceId: PieceId
      boardId: BoardId
      name: string
      x: number
      y: number
    }
  | {
      type: 'PieceMoved'
      pieceId: PieceId
      x: number
      y: number
    }
  | {
      type: 'PieceVisibilityChanged'
      pieceId: PieceId
      visibility: PieceVisibility
    }
  | {
      type: 'PieceFreedomChanged'
      pieceId: PieceId
      freedom: PieceFreedom
    }
  | {
      type: 'DiceRolled'
      expression: string
      reason: string
      total: number
      rolls: number[]
    }
