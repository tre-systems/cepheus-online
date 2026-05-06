import type {
  BoardId,
  CharacterId,
  EventId,
  GameId,
  PieceId,
  UserId
} from './ids'
import type { CareerCreationEvent } from './characterCreation'
import type {
  CharacterCreationSheet,
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  CharacterSheetPatch,
  CharacterType,
  PieceFreedom,
  PieceVisibility
} from './state'

export interface EventEnvelope {
  version: 1
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
  | ({
      type: 'CharacterSheetUpdated'
      characterId: CharacterId
    } & CharacterSheetPatch)
  | {
      type: 'CharacterCreationStarted'
      characterId: CharacterId
      creation: CharacterCreationProjection
    }
  | {
      type: 'CharacterCreationTransitioned'
      characterId: CharacterId
      creationEvent: CareerCreationEvent
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationBasicTrainingCompleted'
      characterId: CharacterId
      trainingSkills: string[]
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationHomeworldSet'
      characterId: CharacterId
      homeworld: CharacterCreationHomeworld
      backgroundSkills: string[]
      pendingCascadeSkills: string[]
    }
  | {
      type: 'CharacterCreationHomeworldCompleted'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationBackgroundSkillSelected'
      characterId: CharacterId
      skill: string
      backgroundSkills: string[]
      pendingCascadeSkills: string[]
    }
  | {
      type: 'CharacterCreationCascadeSkillResolved'
      characterId: CharacterId
      cascadeSkill: string
      selection: string
      backgroundSkills: string[]
      pendingCascadeSkills: string[]
    }
  | ({
      type: 'CharacterCreationFinalized'
      characterId: CharacterId
    } & CharacterCreationSheet)
  | {
      type: 'CharacterCareerTermStarted'
      characterId: CharacterId
      requestedCareer: string
      acceptedCareer: string
      career: string
      drafted: boolean
    }
  | {
      type: 'BoardCreated'
      boardId: BoardId
      name: string
      imageAssetId: string | null
      url: string | null
      width: number
      height: number
      scale: number
    }
  | {
      type: 'BoardSelected'
      boardId: BoardId
    }
  | {
      type: 'DoorStateChanged'
      boardId: BoardId
      doorId: string
      open: boolean
    }
  | {
      type: 'PieceCreated'
      pieceId: PieceId
      boardId: BoardId
      characterId: CharacterId | null
      name: string
      imageAssetId: string | null
      x: number
      y: number
      width?: number
      height?: number
      scale?: number
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
