import type { Command, GameCommand } from '../../shared/commands'

export type BoardCommand = Extract<
  Command,
  {
    type:
      | 'CreateBoard'
      | 'SelectBoard'
      | 'CreatePiece'
      | 'MovePiece'
      | 'SetPieceVisibility'
      | 'SetPieceFreedom'
  }
>

export type DiceCommand = Extract<Command, { type: 'RollDice' }>

export type DoorCommand = Extract<Command, { type: 'SetDoorOpen' }>

export type SheetCommand = Extract<
  Command,
  {
    type:
      | 'UpdateCharacterSheet'
      | 'SetPieceVisibility'
      | 'SetPieceFreedom'
      | 'RollDice'
  }
>

export type CharacterCreationCommand = Extract<
  GameCommand,
  {
    type:
      | 'CreateCharacter'
      | 'UpdateCharacterSheet'
      | 'StartCharacterCreation'
      | 'SetCharacterCreationHomeworld'
      | 'SelectCharacterCreationBackgroundSkill'
      | 'ResolveCharacterCreationCascadeSkill'
      | 'FinalizeCharacterCreation'
      | 'StartCharacterCareerTerm'
      | 'CompleteCharacterCreationHomeworld'
      | 'ResolveCharacterCreationQualification'
      | 'ResolveCharacterCreationDraft'
      | 'EnterCharacterCreationDrifter'
      | 'CompleteCharacterCreationBasicTraining'
      | 'ResolveCharacterCreationSurvival'
      | 'ResolveCharacterCreationMishap'
      | 'ConfirmCharacterCreationDeath'
      | 'ResolveCharacterCreationCommission'
      | 'SkipCharacterCreationCommission'
      | 'ResolveCharacterCreationAdvancement'
      | 'SkipCharacterCreationAdvancement'
      | 'ResolveCharacterCreationAging'
      | 'ResolveCharacterCreationAgingLosses'
      | 'DecideCharacterCreationAnagathics'
      | 'ResolveCharacterCreationReenlistment'
      | 'ReenlistCharacterCreationCareer'
      | 'LeaveCharacterCreationCareer'
      | 'RollCharacterCreationCharacteristic'
      | 'RollCharacterCreationTermSkill'
      | 'CompleteCharacterCreationSkills'
      | 'ResolveCharacterCreationTermCascadeSkill'
      | 'RollCharacterCreationMusteringBenefit'
      | 'ContinueCharacterCreationAfterMustering'
      | 'CompleteCharacterCreationMustering'
      | 'CompleteCharacterCreation'
      | 'CreatePiece'
  }
>

export type AppCommandRoute =
  | 'game'
  | 'board'
  | 'dice'
  | 'door'
  | 'sheet'
  | 'characterCreation'

type RoutedCommandType = Exclude<
  GameCommand['type'],
  'AdvanceCharacterCreation'
>

export const appCommandRouteByType = {
  CreateGame: 'game',
  CreateCharacter: 'characterCreation',
  UpdateCharacterSheet: 'sheet',
  StartCharacterCreation: 'characterCreation',
  SetCharacterCreationHomeworld: 'characterCreation',
  SelectCharacterCreationBackgroundSkill: 'characterCreation',
  ResolveCharacterCreationCascadeSkill: 'characterCreation',
  FinalizeCharacterCreation: 'characterCreation',
  StartCharacterCareerTerm: 'characterCreation',
  CompleteCharacterCreationHomeworld: 'characterCreation',
  ResolveCharacterCreationQualification: 'characterCreation',
  ResolveCharacterCreationDraft: 'characterCreation',
  EnterCharacterCreationDrifter: 'characterCreation',
  CompleteCharacterCreationBasicTraining: 'characterCreation',
  ResolveCharacterCreationSurvival: 'characterCreation',
  ResolveCharacterCreationMishap: 'characterCreation',
  ConfirmCharacterCreationDeath: 'characterCreation',
  ResolveCharacterCreationCommission: 'characterCreation',
  SkipCharacterCreationCommission: 'characterCreation',
  ResolveCharacterCreationAdvancement: 'characterCreation',
  SkipCharacterCreationAdvancement: 'characterCreation',
  ResolveCharacterCreationAging: 'characterCreation',
  ResolveCharacterCreationAgingLosses: 'characterCreation',
  DecideCharacterCreationAnagathics: 'characterCreation',
  ResolveCharacterCreationReenlistment: 'characterCreation',
  ReenlistCharacterCreationCareer: 'characterCreation',
  LeaveCharacterCreationCareer: 'characterCreation',
  RollCharacterCreationCharacteristic: 'characterCreation',
  RollCharacterCreationTermSkill: 'characterCreation',
  CompleteCharacterCreationSkills: 'characterCreation',
  ResolveCharacterCreationTermCascadeSkill: 'characterCreation',
  RollCharacterCreationMusteringBenefit: 'characterCreation',
  ContinueCharacterCreationAfterMustering: 'characterCreation',
  CompleteCharacterCreationMustering: 'characterCreation',
  CompleteCharacterCreation: 'characterCreation',
  CreateBoard: 'board',
  SelectBoard: 'board',
  SetDoorOpen: 'door',
  CreatePiece: 'board',
  MovePiece: 'board',
  SetPieceVisibility: 'board',
  SetPieceFreedom: 'board',
  RollDice: 'dice'
} satisfies Record<RoutedCommandType, AppCommandRoute>

export interface AppCommandSubmitInput {
  requestId: string
  command: GameCommand
}

export type AppCommandSubmit<TResult = unknown> = (
  input: AppCommandSubmitInput
) => Promise<TResult>

export interface CreateAppCommandRouterOptions<TResult = unknown> {
  getEventSeq: () => number | null | undefined
  submit: AppCommandSubmit<TResult>
  createRequestId?: (command: GameCommand, index: number) => string
}

export interface DispatchCommandOptions {
  requestId?: string
}

export interface DispatchCommandBatchOptions {
  requestIds?: readonly string[]
}

export interface AppCommandDomainRouter<
  TCommand extends GameCommand,
  TResult = unknown
> {
  dispatch: (
    command: TCommand,
    options?: DispatchCommandOptions
  ) => Promise<TResult>
  dispatchSequential: (
    commands: readonly TCommand[],
    options?: DispatchCommandBatchOptions
  ) => Promise<TResult[]>
  dispatchAll: (
    commands: readonly TCommand[],
    options?: DispatchCommandBatchOptions
  ) => Promise<TResult[]>
}

export interface AppCommandRouter<TResult = unknown>
  extends AppCommandDomainRouter<GameCommand, TResult> {
  sequenceCommand: (command: GameCommand, offset?: number) => GameCommand
  routeFor: (command: GameCommand) => AppCommandRoute
  board: AppCommandDomainRouter<BoardCommand, TResult>
  dice: AppCommandDomainRouter<DiceCommand, TResult>
  door: AppCommandDomainRouter<DoorCommand, TResult>
  sheet: AppCommandDomainRouter<SheetCommand, TResult>
  characterCreation: AppCommandDomainRouter<CharacterCreationCommand, TResult>
}

const defaultRequestId = (command: GameCommand, index: number): string =>
  `${command.type}-${index + 1}`

const shouldAddExpectedSeq = (command: GameCommand): boolean =>
  command.type !== 'CreateGame' && command.expectedSeq === undefined

export const sequenceCommand = (
  command: GameCommand,
  eventSeq: number | null | undefined,
  offset = 0
): GameCommand => {
  if (eventSeq === null || eventSeq === undefined) return command
  if (!shouldAddExpectedSeq(command)) return command

  return {
    ...command,
    expectedSeq: eventSeq + offset
  }
}

export const createAppCommandRouter = <TResult = unknown>({
  getEventSeq,
  submit,
  createRequestId = defaultRequestId
}: CreateAppCommandRouterOptions<TResult>): AppCommandRouter<TResult> => {
  const routeCommand = (
    command: GameCommand,
    offset: number,
    requestId: string
  ): Promise<TResult> =>
    submit({
      requestId,
      command: sequenceCommand(command, getEventSeq(), offset)
    })

  const domainRouter = <TCommand extends GameCommand>(): AppCommandDomainRouter<
    TCommand,
    TResult
  > => ({
    dispatch: (command, options = {}) =>
      routeCommand(
        command,
        0,
        options.requestId ?? createRequestId(command, 0)
      ),
    dispatchSequential: async (commands, options = {}) => {
      const results: TResult[] = []
      for (const [index, command] of commands.entries()) {
        results.push(
          await routeCommand(
            command,
            0,
            options.requestIds?.[index] ?? createRequestId(command, index)
          )
        )
      }
      return results
    },
    dispatchAll: async (commands, options = {}) => {
      const results: TResult[] = []
      for (const [index, command] of commands.entries()) {
        results.push(
          await routeCommand(
            command,
            index,
            options.requestIds?.[index] ?? createRequestId(command, index)
          )
        )
      }
      return results
    }
  })

  return {
    sequenceCommand: (command, offset = 0) =>
      sequenceCommand(command, getEventSeq(), offset),
    routeFor: (command) =>
      command.type === 'AdvanceCharacterCreation'
        ? 'characterCreation'
        : appCommandRouteByType[command.type],
    ...domainRouter<GameCommand>(),
    board: domainRouter<BoardCommand>(),
    dice: domainRouter<DiceCommand>(),
    door: domainRouter<DoorCommand>(),
    sheet: domainRouter<SheetCommand>(),
    characterCreation: domainRouter<CharacterCreationCommand>()
  }
}
