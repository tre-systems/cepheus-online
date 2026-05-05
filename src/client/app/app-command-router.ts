import type { Command } from '../../shared/commands'

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

export interface AppCommandRouter<TResult = unknown> {
  sequenceCommand: (command: Command, offset?: number) => Command
  dispatch: (
    command: Command,
    options?: DispatchCommandOptions
  ) => Promise<TResult>
  dispatchAll: (
    commands: readonly Command[],
    options?: DispatchCommandBatchOptions
  ) => Promise<TResult[]>
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

  return {
    sequenceCommand: (command, offset = 0) =>
      sequenceCommand(command, getEventSeq(), offset),
    dispatch: (command, options = {}) =>
      routeCommand(
        command,
        0,
        options.requestId ?? createRequestId(command, 0)
      ),
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
  }
}
