import type { BoardId, CharacterId, GameId, PieceId, UserId } from './ids'
import type {
  CharacterSheetPatch,
  CharacterType,
  PieceFreedom,
  PieceVisibility
} from './state'

export type Command =
  | {
      type: 'CreateGame'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      slug: string
      name: string
    }
  | {
      type: 'CreateCharacter'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      characterType: CharacterType
      name: string
    }
  | ({
      type: 'UpdateCharacterSheet'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
    } & CharacterSheetPatch)
  | {
      type: 'CreateBoard'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      boardId: BoardId
      name: string
      imageAssetId?: string | null
      url?: string | null
      width: number
      height: number
      scale: number
    }
  | {
      type: 'SelectBoard'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      boardId: BoardId
    }
  | {
      type: 'SetDoorOpen'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      boardId: BoardId
      doorId: string
      open: boolean
    }
  | {
      type: 'CreatePiece'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      pieceId: PieceId
      boardId: BoardId
      characterId?: CharacterId | null
      name: string
      imageAssetId?: string | null
      x: number
      y: number
      width?: number
      height?: number
      scale?: number
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
      expectedSeq?: number
      pieceId: PieceId
      visibility: PieceVisibility
    }
  | {
      type: 'SetPieceFreedom'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      pieceId: PieceId
      freedom: PieceFreedom
    }
  | {
      type: 'RollDice'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      expression: string
      reason: string
    }
