import type { BoardId, CharacterId, GameId, PieceId, UserId } from './ids'
import type {
  BenefitKind,
  AgingLossSelection,
  FailedQualificationOption,
  CareerCreationEvent,
  InjuryResolutionMethod,
  InjurySecondaryChoice,
  CareerCreationTermSkillTable
} from './characterCreation'
import type {
  CharacterCreationHomeworld,
  CharacteristicKey,
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
  | {
      type: 'FinalizeCharacterCreation'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
    }
  | {
      type: 'StartCharacterCareerTerm'
      gameId: GameId
      actorId: UserId
      expectedSeq?: number
      characterId: CharacterId
      career: string
      drafted?: boolean
    }
  | CharacterCreationQualificationCommand
  | CharacterCreationDraftCommand
  | CharacterCreationDrifterCommand
  | CharacterCreationBasicTrainingCommand
  | CharacterCreationSurvivalCommand
  | CharacterCreationCommissionCommand
  | CharacterCreationAdvancementCommand
  | CharacterCreationAgingCommand
  | CharacterCreationAgingLossesCommand
  | CharacterCreationAnagathicsCommand
  | CharacterCreationInjuryResolutionCommand
  | CharacterCreationReenlistmentCommand
  | CharacterCreationCareerReenlistmentCommand
  | CharacterCreationCareerLeaveCommand
  | CharacterCreationTermSkillCommand
  | CharacterCreationSkillsCompletionCommand
  | CharacterCreationTermCascadeSkillCommand
  | CharacterCreationMusteringBenefitCommand
  | CharacterCreationAfterMusteringContinuationCommand
  | CharacterCreationMusteringCompletionCommand
  | CharacterCreationCompletionCommand
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
  skill?: string
}

export type CharacterCreationHomeworldCommand = {
  type: 'CompleteCharacterCreationHomeworld'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationCharacteristicCommand = {
  type: 'RollCharacterCreationCharacteristic'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  characteristic: CharacteristicKey
}

export type CharacterCreationQualificationCommand = {
  type: 'ResolveCharacterCreationQualification'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  career: string
}

export type CharacterCreationDraftCommand = {
  type: 'ResolveCharacterCreationDraft'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationDrifterCommand = {
  type: 'EnterCharacterCreationDrifter'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  option: Extract<FailedQualificationOption, 'Drifter'>
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

export type CharacterCreationCommissionSkipCommand = {
  type: 'SkipCharacterCreationCommission'
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

export type CharacterCreationAdvancementSkipCommand = {
  type: 'SkipCharacterCreationAdvancement'
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

export type CharacterCreationAgingLossesCommand = {
  type: 'ResolveCharacterCreationAgingLosses'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  selectedLosses: AgingLossSelection[]
}

export type CharacterCreationMishapResolutionCommand = {
  type: 'ResolveCharacterCreationMishap'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationInjuryResolutionCommand = {
  type: 'ResolveCharacterCreationInjury'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  method?: InjuryResolutionMethod
  primaryCharacteristic?: CharacteristicKey | null
  secondaryChoice?: InjurySecondaryChoice | null
}

export type CharacterCreationDeathConfirmationCommand = {
  type: 'ConfirmCharacterCreationDeath'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationAnagathicsCommand = {
  type: 'DecideCharacterCreationAnagathics'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  useAnagathics: boolean
}

export type CharacterCreationReenlistmentCommand = {
  type: 'ResolveCharacterCreationReenlistment'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationCareerReenlistmentCommand = {
  type: 'ReenlistCharacterCreationCareer'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationCareerLeaveCommand = {
  type: 'LeaveCharacterCreationCareer'
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

export type CharacterCreationSkillsCompletionCommand = {
  type: 'CompleteCharacterCreationSkills'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
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

export type CharacterCreationMusteringBenefitCommand = {
  type: 'RollCharacterCreationMusteringBenefit'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
  career: string
  kind: BenefitKind
}

export type CharacterCreationAfterMusteringContinuationCommand = {
  type: 'ContinueCharacterCreationAfterMustering'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationMusteringCompletionCommand = {
  type: 'CompleteCharacterCreationMustering'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type CharacterCreationCompletionCommand = {
  type: 'CompleteCharacterCreation'
  gameId: GameId
  actorId: UserId
  expectedSeq?: number
  characterId: CharacterId
}

export type SemanticCommand =
  | CharacterCreationCharacteristicCommand
  | CharacterCreationBasicTrainingCommand
  | CharacterCreationHomeworldCommand
  | CharacterCreationQualificationCommand
  | CharacterCreationDraftCommand
  | CharacterCreationDrifterCommand
  | CharacterCreationSurvivalCommand
  | CharacterCreationCommissionCommand
  | CharacterCreationCommissionSkipCommand
  | CharacterCreationAdvancementCommand
  | CharacterCreationAdvancementSkipCommand
  | CharacterCreationAgingCommand
  | CharacterCreationAgingLossesCommand
  | CharacterCreationMishapResolutionCommand
  | CharacterCreationDeathConfirmationCommand
  | CharacterCreationAnagathicsCommand
  | CharacterCreationReenlistmentCommand
  | CharacterCreationCareerReenlistmentCommand
  | CharacterCreationCareerLeaveCommand
  | CharacterCreationTermSkillCommand
  | CharacterCreationSkillsCompletionCommand
  | CharacterCreationTermCascadeSkillCommand
  | CharacterCreationMusteringBenefitCommand
  | CharacterCreationAfterMusteringContinuationCommand
  | CharacterCreationMusteringCompletionCommand
  | CharacterCreationCompletionCommand

export type GameCommand = Command | SemanticCommand
