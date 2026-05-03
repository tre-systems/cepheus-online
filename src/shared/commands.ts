import type {BoardId, CharacterId, GameId, PieceId, UserId} from './ids'
import type {CharacterType, PieceFreedom, PieceVisibility} from './state'

export type Command =
  | {
      type: 'CreateGame'
      gameId: GameId
      actorId: UserId
      slug: string
      name: string
    }
  | {
      type: 'CreateCharacter'
      gameId: GameId
      actorId: UserId
      characterId: CharacterId
      characterType: CharacterType
      name: string
    }
  | {
      type: 'CreateBoard'
      gameId: GameId
      actorId: UserId
      boardId: BoardId
      name: string
      width: number
      height: number
      scale: number
    }
  | {
      type: 'CreatePiece'
      gameId: GameId
      actorId: UserId
      pieceId: PieceId
      boardId: BoardId
      name: string
      imageAssetId?: string | null
      x: number
      y: number
    }
  | {
      type: 'MovePiece'
      gameId: GameId
      actorId: UserId
      pieceId: PieceId
      x: number
      y: number
      expectedSeq?: number
    }
  | {
      type: 'SetPieceVisibility'
      gameId: GameId
      actorId: UserId
      pieceId: PieceId
      visibility: PieceVisibility
    }
  | {
      type: 'SetPieceFreedom'
      gameId: GameId
      actorId: UserId
      pieceId: PieceId
      freedom: PieceFreedom
    }
  | {
      type: 'RollDice'
      gameId: GameId
      actorId: UserId
      expression: string
      reason: string
    }
