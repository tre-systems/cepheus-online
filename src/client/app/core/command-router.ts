import type { Command, GameCommand } from '../../../shared/commands'
import {
  commandMetadataByType,
  isDeprecatedGameCommand,
  metadataForCommand,
  type CommandRoute,
  type CommandTypeForRoute,
  type NonDeprecatedGameCommandType
} from '../../../shared/command-metadata'

type CommandForRoute<TRoute extends CommandRoute> = Extract<
  Command,
  { type: CommandTypeForRoute<TRoute> }
>

export type BoardCommand = CommandForRoute<'board'>

export type DiceCommand = CommandForRoute<'dice'>

export type DoorCommand = CommandForRoute<'door'>

export type NoteCommand = CommandForRoute<'note'>

type SheetAuxiliaryCommandType =
  | Extract<
      CommandTypeForRoute<'board'>,
      'SetPieceVisibility' | 'SetPieceFreedom'
    >
  | CommandTypeForRoute<'dice'>

export type SheetCommand = Extract<
  Command,
  {
    type: CommandTypeForRoute<'sheet'> | SheetAuxiliaryCommandType
  }
>

export type CharacterCreationCommand = Extract<
  GameCommand,
  {
    type: CommandTypeForRoute<'characterCreation'> | 'CreatePiece'
  }
>

export type AppCommandRoute = CommandRoute

export const appCommandRouteByType = Object.fromEntries(
  Object.entries(commandMetadataByType).map(([type, metadata]) => [
    type,
    metadata.route
  ])
) as Record<NonDeprecatedGameCommandType, AppCommandRoute>

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
  note: AppCommandDomainRouter<NoteCommand, TResult>
  sheet: AppCommandDomainRouter<SheetCommand, TResult>
  characterCreation: AppCommandDomainRouter<CharacterCreationCommand, TResult>
}

const defaultRequestId = (command: GameCommand, index: number): string =>
  `${command.type}-${index + 1}`

const shouldAddExpectedSeq = (command: GameCommand): boolean => {
  if (command.expectedSeq !== undefined) return false
  if (isDeprecatedGameCommand(command)) return true

  return metadataForCommand(command).autoAddExpectedSeq
}

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
      isDeprecatedGameCommand(command)
        ? 'characterCreation'
        : metadataForCommand(command).route,
    ...domainRouter<GameCommand>(),
    board: domainRouter<BoardCommand>(),
    dice: domainRouter<DiceCommand>(),
    door: domainRouter<DoorCommand>(),
    note: domainRouter<NoteCommand>(),
    sheet: domainRouter<SheetCommand>(),
    characterCreation: domainRouter<CharacterCreationCommand>()
  }
}
