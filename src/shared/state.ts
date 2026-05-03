import type {BoardId, CharacterId, GameId, PieceId, UserId} from './ids'

export type CharacterType = 'PLAYER' | 'NPC' | 'ANIMAL' | 'ROBOT'

export type PieceVisibility = 'HIDDEN' | 'PREVIEW' | 'VISIBLE'
export type PieceFreedom = 'LOCKED' | 'UNLOCKED' | 'SHARE'

export interface GameState {
  id: GameId
  slug: string
  name: string
  ownerId: UserId
  players: Record<UserId, PlayerState>
  characters: Record<CharacterId, CharacterState>
  boards: Record<BoardId, BoardState>
  pieces: Record<PieceId, PieceState>
  diceLog: DiceRollState[]
  selectedBoardId: BoardId | null
  eventSeq: number
}

export interface PlayerState {
  userId: UserId
  role: 'REFEREE' | 'PLAYER' | 'SPECTATOR'
}

export interface CharacterState {
  id: CharacterId
  ownerId: UserId | null
  type: CharacterType
  name: string
  active: boolean
  notes: string
}

export interface BoardState {
  id: BoardId
  name: string
  imageAssetId: string | null
  url: string | null
  width: number
  height: number
  scale: number
}

export interface PieceState {
  id: PieceId
  boardId: BoardId
  characterId: CharacterId | null
  imageAssetId: string | null
  name: string
  x: number
  y: number
  z: number
  width: number
  height: number
  scale: number
  visibility: PieceVisibility
  freedom: PieceFreedom
}

export interface DiceRollState {
  id: string
  actorId: UserId | null
  createdAt: string
  expression: string
  reason: string
  rolls: number[]
  total: number
}
