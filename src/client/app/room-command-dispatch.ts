import type { GameCommand } from '../../shared/commands'
import type { ServerMessage } from '../../shared/protocol'
import {
  createAppCommandRouter,
  type AppCommandRouter,
  type BoardCommand,
  type CharacterCreationCommand,
  type DiceCommand,
  type DoorCommand,
  type SheetCommand
} from './app-command-router.js'
import type { postRoomCommand } from './room-api.js'

export type CommandAcceptedMessage = Extract<
  ServerMessage,
  { type: 'commandAccepted' }
>

export interface RoomCommandDispatch {
  router: AppCommandRouter<CommandAcceptedMessage>
  postCommand: (
    command: GameCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postBoardCommand: (
    command: BoardCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postDiceCommand: (
    command: DiceCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postDoorCommand: (
    command: DoorCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postSheetCommand: (
    command: SheetCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postCharacterCreationCommand: (
    command: CharacterCreationCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postCharacterCreationCommands: (
    commands: readonly CharacterCreationCommand[]
  ) => Promise<CommandAcceptedMessage[]>
}

export interface CreateRoomCommandDispatchOptions {
  getEventSeq: () => number | null | undefined
  getRoomId: () => string
  getActorSessionSecret: () => string
  createRequestId: (commandType: GameCommand['type']) => string
  handleServerMessage: (message: ServerMessage) => void
  postRoomCommand: typeof postRoomCommand
}

export const isCommandAcceptedMessage = (
  message: ServerMessage
): message is CommandAcceptedMessage => message.type === 'commandAccepted'

export const serverMessageErrorText = (message: ServerMessage): string => {
  if (message.type === 'commandRejected' || message.type === 'error') {
    return message.error.message
  }
  return 'Command failed'
}

export const createRoomCommandDispatch = ({
  getEventSeq,
  getRoomId,
  getActorSessionSecret,
  createRequestId,
  handleServerMessage,
  postRoomCommand
}: CreateRoomCommandDispatchOptions): RoomCommandDispatch => {
  const router = createAppCommandRouter<CommandAcceptedMessage>({
    getEventSeq,
    createRequestId: (command) => createRequestId(command.type),
    submit: async ({ requestId, command }) => {
      const response = await postRoomCommand({
        roomId: getRoomId(),
        requestId,
        command,
        actorSessionSecret: getActorSessionSecret()
      })
      handleServerMessage(response.message)
      if (!response.ok || !isCommandAcceptedMessage(response.message)) {
        throw new Error(serverMessageErrorText(response.message))
      }
      return response.message
    }
  })

  return {
    router,
    postCommand: (command, requestId = createRequestId(command.type)) =>
      router.dispatch(command, { requestId }),
    postBoardCommand: (command, requestId = createRequestId(command.type)) =>
      router.board.dispatch(command, { requestId }),
    postDiceCommand: (command, requestId = createRequestId(command.type)) =>
      router.dice.dispatch(command, { requestId }),
    postDoorCommand: (command, requestId = createRequestId(command.type)) =>
      router.door.dispatch(command, { requestId }),
    postSheetCommand: (command, requestId = createRequestId(command.type)) =>
      router.sheet.dispatch(command, { requestId }),
    postCharacterCreationCommand: (
      command,
      requestId = createRequestId(command.type)
    ) => router.characterCreation.dispatch(command, { requestId }),
    postCharacterCreationCommands: (commands) =>
      router.characterCreation.dispatchSequential(commands)
  }
}
