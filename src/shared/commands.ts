import type { BoardId, CharacterId, GameId, PieceId, UserId } from './ids'
import type {
  CareerCreationEvent,
  CareerCreationTermSkillTable
} from './characterCreation'
import type {
  CharacterCreationSheet,
  CharacterCreationHomeworld,
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
      type: 'StartCharacterCreation'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
    }
  | {
      type: 'AdvanceCharacterCreation'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      creationEvent: CareerCreationEvent
    }
  | {
      type: 'SetCharacterCreationHomeworld'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      homeworld: CharacterCreationHomeworld
    }
  | {
      type: 'SelectCharacterCreationBackgroundSkill'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      skill: string
    }
  | {
      type: 'ResolveCharacterCreationCascadeSkill'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      cascadeSkill: string
      selection: string
    }
  | ({
      type: 'FinalizeCharacterCreation'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
    } & CharacterCreationSheet)
  | {
      type: 'StartCharacterCareerTerm'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      career: string
      drafted?: boolean
    }
  | CharacterCreationBasicTrainingCommand
  | CharacterCreationSurvivalCommand
  | CharacterCreationCommissionCommand
  | CharacterCreationAdvancementCommand
  | CharacterCreationAgingCommand
  | CharacterCreationReenlistmentCommand
  | CharacterCreationTermSkillCommand
  | CharacterCreationTermCascadeSkillCommand
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

export type CharacterCreationBasicTrainingCommand = {
  type: 'CompleteCharacterCreationBasicTraining'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationHomeworldCommand = {
  type: 'CompleteCharacterCreationHomeworld'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationSurvivalCommand = {
  type: 'ResolveCharacterCreationSurvival'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationCommissionCommand = {
  type: 'ResolveCharacterCreationCommission'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationAdvancementCommand = {
  type: 'ResolveCharacterCreationAdvancement'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationAgingCommand = {
  type: 'ResolveCharacterCreationAging'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationReenlistmentCommand = {
  type: 'ResolveCharacterCreationReenlistment'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationTermSkillCommand = {
  type: 'RollCharacterCreationTermSkill'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  table: CareerCreationTermSkillTable
}

export type CharacterCreationTermCascadeSkillCommand = {
  type: 'ResolveCharacterCreationTermCascadeSkill'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  cascadeSkill: string
  selection: string
}

export type SemanticCommand =
  | CharacterCreationBasicTrainingCommand
  | CharacterCreationHomeworldCommand
  | CharacterCreationSurvivalCommand
  | CharacterCreationCommissionCommand
  | CharacterCreationAdvancementCommand
  | CharacterCreationAgingCommand
  | CharacterCreationReenlistmentCommand
  | CharacterCreationTermSkillCommand
  | CharacterCreationTermCascadeSkillCommand

export type GameCommand = Command | CharacterCreationHomeworldCommand
