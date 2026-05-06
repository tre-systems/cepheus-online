import type { Command } from '../../shared/commands'

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
  Command,
  {
    type:
      | 'CreateCharacter'
      | 'UpdateCharacterSheet'
      | 'StartCharacterCreation'
      | 'AdvanceCharacterCreation'
      | 'SetCharacterCreationHomeworld'
      | 'SelectCharacterCreationBackgroundSkill'
      | 'ResolveCharacterCreationCascadeSkill'
      | 'FinalizeCharacterCreation'
      | 'StartCharacterCareerTerm'
      | 'CompleteCharacterCreationBasicTraining'
      | 'ResolveCharacterCreationSurvival'
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

export const appCommandRouteByType = {
  CreateGame: 'game',
  CreateCharacter: 'characterCreation',
  UpdateCharacterSheet: 'sheet',
  StartCharacterCreation: 'characterCreation',
  AdvanceCharacterCreation: 'characterCreation',
  SetCharacterCreationHomeworld: 'characterCreation',
  SelectCharacterCreationBackgroundSkill: 'characterCreation',
  ResolveCharacterCreationCascadeSkill: 'characterCreation',
  FinalizeCharacterCreation: 'characterCreation',
  StartCharacterCareerTerm: 'characterCreation',
  CompleteCharacterCreationBasicTraining: 'characterCreation',
  ResolveCharacterCreationSurvival: 'characterCreation',
  CreateBoard: 'board',
  SelectBoard: 'board',
  SetDoorOpen: 'door',
  CreatePiece: 'board',
  MovePiece: 'board',
  SetPieceVisibility: 'board',
  SetPieceFreedom: 'board',
  RollDice: 'dice'
} satisfies Record<Command['type'], AppCommandRoute>

export interface AppCommandSubmitInput {
  requestId: string
  command: Command
}

export type AppCommandSubmit<TResult = unknown> = (
  input: AppCommandSubmitInput
) => Promise<TResult>

export interface CreateAppCommandRouterOptions<TResult = unknown> {
  getEventSeq: () => number | null | undefined
  submit: AppCommandSubmit<TResult>
  createRequestId?: (command: Command, index: number) => string
}

export interface DispatchCommandOptions {
  requestId?: string
}

export interface DispatchCommandBatchOptions {
  requestIds?: readonly string[]
}

export interface AppCommandDomainRouter<
  TCommand extends Command,
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
  extends AppCommandDomainRouter<Command, TResult> {
  sequenceCommand: (command: Command, offset?: number) => Command
  routeFor: (command: Command) => AppCommandRoute
  board: AppCommandDomainRouter<BoardCommand, TResult>
  dice: AppCommandDomainRouter<DiceCommand, TResult>
  door: AppCommandDomainRouter<DoorCommand, TResult>
  sheet: AppCommandDomainRouter<SheetCommand, TResult>
  characterCreation: AppCommandDomainRouter<CharacterCreationCommand, TResult>
}

const defaultRequestId = (command: Command, index: number): string =>
  `${command.type}-${index + 1}`

const shouldAddExpectedSeq = (command: Command): boolean =>
  command.type !== 'CreateGame' && command.expectedSeq === undefined

export const sequenceCommand = (
  command: Command,
  eventSeq: number | null | undefined,
  offset = 0
): Command => {
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
    command: Command,
    offset: number,
    requestId: string
  ): Promise<TResult> =>
    submit({
      requestId,
      command: sequenceCommand(command, getEventSeq(), offset)
    })

  const domainRouter = <TCommand extends Command>(): AppCommandDomainRouter<
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
    routeFor: (command) => appCommandRouteByType[command.type],
    ...domainRouter<Command>(),
    board: domainRouter<BoardCommand>(),
    dice: domainRouter<DiceCommand>(),
    door: domainRouter<DoorCommand>(),
    sheet: domainRouter<SheetCommand>(),
    characterCreation: domainRouter<CharacterCreationCommand>()
  }
}
