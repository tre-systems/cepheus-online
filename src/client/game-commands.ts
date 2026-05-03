import type {Command} from '../shared/commands'
import {
  asBoardId,
  asGameId,
  asPieceId,
  asUserId,
  type BoardId,
  type GameId,
  type PieceId,
  type UserId
} from '../shared/ids'
import type {ClientMessage, ServerMessage} from '../shared/protocol'
import type {GameState} from '../shared/state'

export interface ClientIdentity {
  gameId: GameId
  actorId: UserId
}

export interface ClientCommandOptions {
  requestId: string
  identity: ClientIdentity
}

export interface ClientMessageApplication {
  state: GameState | null
  shouldReload: boolean
  error: string | null
}

export const DEFAULT_GAME_ID = 'demo-room'
export const DEFAULT_ACTOR_ID = 'local-user'

export const resolveClientIdentity = (
  searchParams: URLSearchParams
): ClientIdentity => ({
  gameId: asGameId(searchParams.get('game') ?? DEFAULT_GAME_ID),
  actorId: asUserId(searchParams.get('user') ?? DEFAULT_ACTOR_ID)
})

export const buildCommandMessage = (
  requestId: string,
  command: Command
): Extract<ClientMessage, {type: 'command'}> => ({
  type: 'command',
  requestId,
  command
})

export const buildCreateGameCommand = ({
  identity
}: ClientCommandOptions): Command => ({
  type: 'CreateGame',
  gameId: identity.gameId,
  actorId: identity.actorId,
  slug: identity.gameId,
  name: `Cepheus Room ${identity.gameId}`
})

export const buildCreateBoardCommand = ({
  identity
}: ClientCommandOptions): Command => ({
  type: 'CreateBoard',
  gameId: identity.gameId,
  actorId: identity.actorId,
  boardId: asBoardId('main-board'),
  name: 'Downport Skirmish',
  width: 1200,
  height: 800,
  scale: 50
})

export const buildCreatePieceCommand = ({
  identity,
  boardId = asBoardId('main-board'),
  imageAssetId = null
}: ClientCommandOptions & {
  boardId?: BoardId
  imageAssetId?: string | null
}): Command => ({
  type: 'CreatePiece',
  gameId: identity.gameId,
  actorId: identity.actorId,
  pieceId: asPieceId('scout-1'),
  boardId,
  name: 'Scout',
  imageAssetId,
  x: 220,
  y: 180
})

export const buildMovePieceCommand = ({
  identity,
  state,
  pieceId,
  x,
  y
}: {
  identity: ClientIdentity
  state: GameState
  pieceId: PieceId
  x: number
  y: number
}): Command => ({
  type: 'MovePiece',
  gameId: identity.gameId,
  actorId: identity.actorId,
  pieceId,
  x,
  y,
  expectedSeq: state.eventSeq
})

export const buildRollDiceCommand = ({
  identity,
  expression,
  reason
}: {
  identity: ClientIdentity
  expression: string
  reason: string
}): Command => ({
  type: 'RollDice',
  gameId: identity.gameId,
  actorId: identity.actorId,
  expression,
  reason
})

export const buildBootstrapCommands = (
  identity: ClientIdentity,
  state: GameState | null
): Command[] => {
  if (!state) {
    return [buildCreateGameCommand({requestId: 'bootstrap-game', identity})]
  }

  if (Object.keys(state.boards).length === 0) {
    return [buildCreateBoardCommand({requestId: 'bootstrap-board', identity})]
  }

  if (Object.keys(state.pieces).length === 0) {
    const boardId = (state.selectedBoardId ??
      Object.keys(state.boards)[0]) as BoardId

    return [
      buildCreatePieceCommand({
        requestId: 'bootstrap-piece',
        identity,
        boardId
      })
    ]
  }

  return []
}

export const applyServerMessage = (
  currentState: GameState | null,
  message: ServerMessage
): ClientMessageApplication => {
  switch (message.type) {
    case 'roomState':
      return {
        state: message.state,
        shouldReload: false,
        error: null
      }

    case 'commandAccepted':
      return {
        state: message.state,
        shouldReload: false,
        error: null
      }

    case 'commandRejected':
      return {
        state: currentState,
        shouldReload: message.error.code === 'stale_command',
        error: message.error.message
      }

    case 'error':
      return {
        state: currentState,
        shouldReload: false,
        error: message.error.message
      }

    case 'pong':
      return {
        state: currentState,
        shouldReload: false,
        error: null
      }

    default: {
      const exhaustive: never = message
      return {
        state: currentState,
        shouldReload: false,
        error: `Unhandled message ${(exhaustive as {type: string}).type}`
      }
    }
  }
}
