import type { BoardId, CharacterId, GameId, PieceId, UserId } from './ids'
import type {
  CareerCreationEvent,
  AgingChange,
  BackgroundHomeworld,
  CareerCreationActionPlan,
  CareerCreationPendingDecision,
  CareerCreationState,
  CareerRank,
  CareerTerm
} from './characterCreation'

export type CharacterType = 'PLAYER' | 'NPC' | 'ANIMAL' | 'ROBOT'

export type PieceVisibility = 'HIDDEN' | 'PREVIEW' | 'VISIBLE'
export type PieceFreedom = 'LOCKED' | 'UNLOCKED' | 'SHARE'

export type CharacteristicKey = 'str' | 'dex' | 'end' | 'int' | 'edu' | 'soc'

export type CharacterCharacteristics = Record<CharacteristicKey, number | null>

export interface CharacterEquipmentItem {
  name: string
  quantity: number
  notes: string
}

export interface CharacterSheetPatch {
  notes?: string
  age?: number | null
  characteristics?: Partial<CharacterCharacteristics>
  skills?: string[]
  equipment?: CharacterEquipmentItem[]
  credits?: number
}

export interface CharacterCreationSheet {
  notes: string
  age: number | null
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
}

export interface CharacterCreationHomeworld extends BackgroundHomeworld {
  name: string | null
  lawLevel: string | null
  tradeCodes: string[]
}

export interface CharacterCreationProjection {
  state: CareerCreationState
  terms: CareerTerm[]
  careers: CareerRank[]
  canEnterDraft: boolean
  failedToQualify: boolean
  characteristicChanges: AgingChange[]
  creationComplete: boolean
  homeworld?: CharacterCreationHomeworld | null
  backgroundSkills?: string[]
  pendingCascadeSkills?: string[]
  pendingDecisions?: CareerCreationPendingDecision[]
  actionPlan?: CareerCreationActionPlan
  history?: CareerCreationEvent[]
}

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
  age: number | null
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
  creation: CharacterCreationProjection | null
}

export interface BoardState {
  id: BoardId
  name: string
  imageAssetId: string | null
  url: string | null
  width: number
  height: number
  scale: number
  doors: Record<string, BoardDoorState>
}

export interface BoardDoorState {
  id: string
  open: boolean
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
  revealAt: string
  expression: string
  reason: string
  rolls: number[]
  total: number
}
