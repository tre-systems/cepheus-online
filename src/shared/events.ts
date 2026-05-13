import type {
  BoardId,
  CharacterId,
  EventId,
  GameId,
  PieceId,
  UserId
} from './ids'
import type {
  CareerCreationCheckFact,
  CareerCreationAgingFact,
  AgingLossSelection,
  CareerCreationBenefitFact,
  CareerCreationDraftFact,
  CareerCreationEvent,
  CareerCreationRankFact,
  CareerCreationPendingDecision,
  CareerCreationReenlistmentFact,
  CareerCreationReenlistmentOutcome,
  CareerCreationTermSkillFact,
  FailedQualificationOption
} from './characterCreation'
import type {
  CharacterCreationSheet,
  CharacteristicKey,
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
      type: 'CharacterCreationCharacteristicRolled'
      characterId: CharacterId
      rollEventId?: EventId
      characteristic: CharacteristicKey
      value: number
      characteristicsComplete: boolean
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationCharacteristicsCompleted'
      characterId: CharacterId
      rollEventId?: EventId
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
      type: 'CharacterCreationQualificationResolved'
      characterId: CharacterId
      rollEventId?: EventId
      career: string
      passed: boolean
      qualification: CareerCreationCheckFact
      previousCareerCount: number
      failedQualificationOptions: FailedQualificationOption[]
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationDraftResolved'
      characterId: CharacterId
      rollEventId?: EventId
      draft: CareerCreationDraftFact
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationDrifterEntered'
      characterId: CharacterId
      acceptedCareer: 'Drifter'
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationSurvivalResolved'
      characterId: CharacterId
      rollEventId?: EventId
      passed: boolean
      survival: CareerCreationCheckFact
      canCommission: boolean
      canAdvance: boolean
      pendingDecisions?: CareerCreationPendingDecision[]
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationCommissionResolved'
      characterId: CharacterId
      rollEventId?: EventId
      passed: boolean
      commission: CareerCreationCheckFact
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationCommissionSkipped'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationAdvancementResolved'
      characterId: CharacterId
      rollEventId?: EventId
      passed: boolean
      advancement: CareerCreationCheckFact
      rank: CareerCreationRankFact | null
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationAdvancementSkipped'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationAgingResolved'
      characterId: CharacterId
      rollEventId?: EventId
      aging: CareerCreationAgingFact
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationAgingLossesResolved'
      characterId: CharacterId
      selectedLosses: AgingLossSelection[]
      characteristicPatch: CharacterSheetPatch['characteristics']
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationMishapResolved'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationDeathConfirmed'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationAnagathicsDecided'
      characterId: CharacterId
      useAnagathics: boolean
      termIndex: number
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationReenlistmentResolved'
      characterId: CharacterId
      rollEventId?: EventId
      outcome: CareerCreationReenlistmentFact['outcome']
      reenlistment: CareerCreationReenlistmentFact
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationCareerReenlisted'
      characterId: CharacterId
      outcome: Extract<CareerCreationReenlistmentOutcome, 'forced' | 'allowed'>
      career: string
      forced: boolean
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationCareerLeft'
      characterId: CharacterId
      outcome: Extract<
        CareerCreationReenlistmentOutcome,
        'allowed' | 'blocked' | 'retire'
      >
      retirement: boolean
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationTermSkillRolled'
      characterId: CharacterId
      rollEventId?: EventId
      termSkill: CareerCreationTermSkillFact
      termSkills: string[]
      skillsAndTraining: string[]
      pendingCascadeSkills: string[]
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationTermCascadeSkillResolved'
      characterId: CharacterId
      cascadeSkill: string
      selection: string
      termSkills: string[]
      skillsAndTraining: string[]
      pendingCascadeSkills: string[]
    }
  | {
      type: 'CharacterCreationSkillsCompleted'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationMusteringBenefitRolled'
      characterId: CharacterId
      rollEventId?: EventId
      musteringBenefit: CareerCreationBenefitFact
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationAfterMusteringContinued'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationMusteringCompleted'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationCompleted'
      characterId: CharacterId
      state: CharacterCreationProjection['state']
      creationComplete: boolean
    }
  | {
      type: 'CharacterCreationHomeworldSet'
      characterId: CharacterId
      homeworld: CharacterCreationHomeworld
      backgroundSkills: string[]
      backgroundSkillAllowance?: number
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
      backgroundSkillAllowance?: number
      pendingCascadeSkills: string[]
    }
  | {
      type: 'CharacterCreationCascadeSkillResolved'
      characterId: CharacterId
      cascadeSkill: string
      selection: string
      backgroundSkills: string[]
      backgroundSkillAllowance?: number
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
      state?: CharacterCreationProjection['state']
      creationComplete?: boolean
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
