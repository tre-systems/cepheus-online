import type { GameCommand } from './commands'

export type CommandRoute =
  | 'game'
  | 'board'
  | 'dice'
  | 'door'
  | 'sheet'
  | 'characterCreation'

export type NonDeprecatedGameCommand = Exclude<
  GameCommand,
  { type: 'AdvanceCharacterCreation' }
>

export type NonDeprecatedGameCommandType = NonDeprecatedGameCommand['type']

export interface CommandMetadata {
  route: CommandRoute
  usesSeededDice: boolean
  autoAddExpectedSeq: boolean
}

const commandMetadata = {
  CreateGame: {
    route: 'game',
    usesSeededDice: false,
    autoAddExpectedSeq: false
  },
  CreateCharacter: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  UpdateCharacterSheet: {
    route: 'sheet',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  StartCharacterCreation: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  SetCharacterCreationHomeworld: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  SelectCharacterCreationBackgroundSkill: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationCascadeSkill: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  FinalizeCharacterCreation: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  StartCharacterCareerTerm: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  CompleteCharacterCreationHomeworld: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationQualification: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationDraft: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  EnterCharacterCreationDrifter: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  CompleteCharacterCreationBasicTraining: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationSurvival: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationMishap: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ConfirmCharacterCreationDeath: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationCommission: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  SkipCharacterCreationCommission: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationAdvancement: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  SkipCharacterCreationAdvancement: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationAging: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationAgingLosses: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  DecideCharacterCreationAnagathics: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationReenlistment: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  ReenlistCharacterCreationCareer: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  LeaveCharacterCreationCareer: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  RollCharacterCreationCharacteristic: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  RollCharacterCreationTermSkill: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  CompleteCharacterCreationSkills: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationTermCascadeSkill: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  RollCharacterCreationMusteringBenefit: {
    route: 'characterCreation',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  ContinueCharacterCreationAfterMustering: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  CompleteCharacterCreationMustering: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  CompleteCharacterCreation: {
    route: 'characterCreation',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  CreateBoard: {
    route: 'board',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  SelectBoard: {
    route: 'board',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  SetDoorOpen: {
    route: 'door',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  CreatePiece: {
    route: 'board',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  MovePiece: {
    route: 'board',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  SetPieceVisibility: {
    route: 'board',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  SetPieceFreedom: {
    route: 'board',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  RollDice: {
    route: 'dice',
    usesSeededDice: true,
    autoAddExpectedSeq: true
  }
} satisfies Record<NonDeprecatedGameCommandType, CommandMetadata>

export const commandMetadataByType = commandMetadata

export const isDeprecatedGameCommandType = (
  type: GameCommand['type']
): type is 'AdvanceCharacterCreation' => type === 'AdvanceCharacterCreation'

export const isDeprecatedGameCommand = (
  command: GameCommand
): command is Extract<GameCommand, { type: 'AdvanceCharacterCreation' }> =>
  isDeprecatedGameCommandType(command.type)

export const metadataForCommand = (
  command: NonDeprecatedGameCommand
): CommandMetadata => commandMetadataByType[command.type]
