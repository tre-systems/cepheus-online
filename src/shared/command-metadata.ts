import type { GameCommand } from './commands'

export type CommandRoute =
  | 'game'
  | 'board'
  | 'dice'
  | 'door'
  | 'sheet'
  | 'characterCreation'

export type CommandHandlerDomain =
  | 'game'
  | 'board'
  | 'dice'
  | 'character'
  | 'characterCreation'

export type NonDeprecatedGameCommand = Exclude<
  GameCommand,
  { type: 'AdvanceCharacterCreation' }
>

export type NonDeprecatedGameCommandType = NonDeprecatedGameCommand['type']

export interface CommandMetadata {
  route: CommandRoute
  handlerDomain: CommandHandlerDomain
  usesSeededDice: boolean
  autoAddExpectedSeq: boolean
}

type CommandMetadataDefinition = Omit<CommandMetadata, 'handlerDomain'> & {
  handlerDomain?: CommandHandlerDomain
}

const defaultHandlerDomain = (
  type: NonDeprecatedGameCommandType,
  route: CommandRoute
): CommandHandlerDomain => {
  if (type === 'CreateCharacter') return 'character'
  if (route === 'sheet') return 'character'
  if (route === 'door') return 'board'
  if (route === 'characterCreation') return 'characterCreation'
  return route
}

const defineCommandMetadata = <
  T extends Record<NonDeprecatedGameCommandType, CommandMetadataDefinition>
>(
  metadata: T
): Record<keyof T, CommandMetadata> => {
  const entries = Object.entries(metadata).map(([type, value]) => [
    type,
    {
      ...value,
      handlerDomain:
        value.handlerDomain ??
        defaultHandlerDomain(type as NonDeprecatedGameCommandType, value.route)
    }
  ])

  return Object.fromEntries(entries) as Record<keyof T, CommandMetadata>
}

const commandMetadataDefinitions = {
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
  AddCharacterEquipmentItem: {
    route: 'sheet',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  UpdateCharacterEquipmentItem: {
    route: 'sheet',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  RemoveCharacterEquipmentItem: {
    route: 'sheet',
    usesSeededDice: false,
    autoAddExpectedSeq: true
  },
  AdjustCharacterCredits: {
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
    usesSeededDice: true,
    autoAddExpectedSeq: true
  },
  ResolveCharacterCreationInjury: {
    route: 'characterCreation',
    usesSeededDice: true,
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
    usesSeededDice: true,
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
} satisfies Record<NonDeprecatedGameCommandType, CommandMetadataDefinition>

export type CommandTypeForRoute<TRoute extends CommandRoute> = {
  [TType in keyof typeof commandMetadataDefinitions]: (typeof commandMetadataDefinitions)[TType]['route'] extends TRoute
    ? TType
    : never
}[keyof typeof commandMetadataDefinitions]

type DefaultHandlerDomainFor<
  TType extends NonDeprecatedGameCommandType,
  TRoute extends CommandRoute
> = TType extends 'CreateCharacter'
  ? 'character'
  : TRoute extends 'sheet'
    ? 'character'
    : TRoute extends 'door'
      ? 'board'
      : TRoute extends 'characterCreation'
        ? 'characterCreation'
        : TRoute

type HandlerDomainFor<TType extends keyof typeof commandMetadataDefinitions> =
  (typeof commandMetadataDefinitions)[TType] extends {
    readonly handlerDomain: infer TDomain extends CommandHandlerDomain
  }
    ? TDomain
    : DefaultHandlerDomainFor<
        TType,
        (typeof commandMetadataDefinitions)[TType]['route']
      >

export type CommandTypeForHandlerDomain<TDomain extends CommandHandlerDomain> =
  {
    [TType in keyof typeof commandMetadataDefinitions]: HandlerDomainFor<TType> extends TDomain
      ? TType
      : never
  }[keyof typeof commandMetadataDefinitions]

const commandMetadata = defineCommandMetadata(commandMetadataDefinitions)

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
