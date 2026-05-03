import type {BoardId, CharacterId, GameId, PieceId, UserId} from './ids'
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
  | ({
      type: 'UpdateCharacterSheet'
      gameId: GameId
      actorId: UserId
      characterId: CharacterId
    } & CharacterSheetPatch)
  | {
      type: 'CreateBoard'
      gameId: GameId
      actorId: UserId
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
      boardId: BoardId
    }
  | {
      type: 'CreatePiece'
      gameId: GameId
      actorId: UserId
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
