import {
  asBoardId,
  asCharacterId,
  asGameId,
  asPieceId,
  asUserId
} from './ids'
import {err, ok, type Result} from './result'
import type {Command} from './commands'
import type {GameState} from './state'
import type {CharacterType, PieceFreedom, PieceVisibility} from './state'
import {isObject, isString} from './util'

export type CommandErrorCode =
  | 'invalid_message'
  | 'invalid_command'
  | 'wrong_room'
  | 'game_exists'
  | 'game_not_found'
  | 'duplicate_entity'
  | 'missing_entity'
  | 'stale_command'
  | 'projection_mismatch'

export interface CommandError {
  code: CommandErrorCode
  message: string
}

export type ClientMessage =
  | {
      type: 'command'
      requestId: string
      command: Command
    }
  | {
      type: 'ping'
      requestId?: string
    }

export type ServerMessage =
  | {
      type: 'roomState'
      state: GameState | null
      eventSeq: number
    }
  | {
      type: 'commandAccepted'
      requestId: string
      state: GameState
      eventSeq: number
    }
  | {
      type: 'commandRejected'
      requestId: string
      error: CommandError
      eventSeq: number
    }
  | {
      type: 'pong'
      requestId?: string
    }
  | {
      type: 'error'
      error: CommandError
    }

const invalidMessage = (message: string): CommandError => ({
  code: 'invalid_message',
  message
})

const invalidCommand = (message: string): CommandError => ({
  code: 'invalid_command',
  message
})

const parseId = <T>(
  raw: unknown,
  label: string,
  parse: (value: string) => T
): Result<T, CommandError> => {
  if (!isString(raw)) return err(invalidCommand(`${label} must be a string`))

  try {
    return ok(parse(raw))
  } catch (error) {
    return err(
      invalidCommand(error instanceof Error ? error.message : `${label} failed`)
    )
  }
}

const parseString = (
  raw: unknown,
  label: string
): Result<string, CommandError> => {
  if (!isString(raw)) return err(invalidCommand(`${label} must be a string`))

  const value = raw.trim()
  if (!value) return err(invalidCommand(`${label} cannot be empty`))

  return ok(value)
}

const parseNumber = (
  raw: unknown,
  label: string
): Result<number, CommandError> => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return err(invalidCommand(`${label} must be a finite number`))
  }

  return ok(raw)
}

const parseOptionalSeq = (
  raw: unknown,
  label: string
): Result<number | undefined, CommandError> => {
  if (raw === undefined) return ok(undefined)
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return err(invalidCommand(`${label} must be a non-negative integer`))
  }

  return ok(raw)
}

const parseCharacterType = (
  raw: unknown
): Result<CharacterType, CommandError> => {
  if (
    raw === 'PLAYER' ||
    raw === 'NPC' ||
    raw === 'ANIMAL' ||
    raw === 'ROBOT'
  ) {
    return ok(raw)
  }

  return err(invalidCommand('characterType is not supported'))
}

const parsePieceVisibility = (
  raw: unknown
): Result<PieceVisibility, CommandError> => {
  if (raw === 'HIDDEN' || raw === 'PREVIEW' || raw === 'VISIBLE') {
    return ok(raw)
  }

  return err(invalidCommand('visibility is not supported'))
}

const parsePieceFreedom = (
  raw: unknown
): Result<PieceFreedom, CommandError> => {
  if (raw === 'LOCKED' || raw === 'UNLOCKED' || raw === 'SHARE') {
    return ok(raw)
  }

  return err(invalidCommand('freedom is not supported'))
}

const parseBaseCommand = (
  raw: Record<string, unknown>
): Result<Pick<Command, 'gameId' | 'actorId'>, CommandError> => {
  const gameId = parseId(raw.gameId, 'gameId', asGameId)
  if (!gameId.ok) return gameId

  const actorId = parseId(raw.actorId, 'actorId', asUserId)
  if (!actorId.ok) return actorId

  return ok({
    gameId: gameId.value,
    actorId: actorId.value
  })
}

export const decodeCommand = (raw: unknown): Result<Command, CommandError> => {
  if (!isObject(raw) || !isString(raw.type)) {
    return err(invalidCommand('Command must be an object with a type'))
  }

  const base = parseBaseCommand(raw)
  if (!base.ok) return base

  switch (raw.type) {
    case 'CreateGame': {
      const slug = parseString(raw.slug, 'slug')
      if (!slug.ok) return slug
      const name = parseString(raw.name, 'name')
      if (!name.ok) return name

      return ok({
        type: 'CreateGame',
        ...base.value,
        slug: slug.value,
        name: name.value
      })
    }

    case 'CreateCharacter': {
      const characterId = parseId(
        raw.characterId,
        'characterId',
        asCharacterId
      )
      if (!characterId.ok) return characterId
      const characterType = parseCharacterType(raw.characterType)
      if (!characterType.ok) return characterType
      const name = parseString(raw.name, 'name')
      if (!name.ok) return name

      return ok({
        type: 'CreateCharacter',
        ...base.value,
        characterId: characterId.value,
        characterType: characterType.value,
        name: name.value
      })
    }

    case 'CreateBoard': {
      const boardId = parseId(raw.boardId, 'boardId', asBoardId)
      if (!boardId.ok) return boardId
      const name = parseString(raw.name, 'name')
      if (!name.ok) return name
      const width = parseNumber(raw.width, 'width')
      if (!width.ok) return width
      const height = parseNumber(raw.height, 'height')
      if (!height.ok) return height
      const scale = parseNumber(raw.scale, 'scale')
      if (!scale.ok) return scale

      return ok({
        type: 'CreateBoard',
        ...base.value,
        boardId: boardId.value,
        name: name.value,
        width: width.value,
        height: height.value,
        scale: scale.value
      })
    }

    case 'CreatePiece': {
      const pieceId = parseId(raw.pieceId, 'pieceId', asPieceId)
      if (!pieceId.ok) return pieceId
      const boardId = parseId(raw.boardId, 'boardId', asBoardId)
      if (!boardId.ok) return boardId
      const name = parseString(raw.name, 'name')
      if (!name.ok) return name
      const x = parseNumber(raw.x, 'x')
      if (!x.ok) return x
      const y = parseNumber(raw.y, 'y')
      if (!y.ok) return y

      return ok({
        type: 'CreatePiece',
        ...base.value,
        pieceId: pieceId.value,
        boardId: boardId.value,
        name: name.value,
        x: x.value,
        y: y.value
      })
    }

    case 'MovePiece': {
      const pieceId = parseId(raw.pieceId, 'pieceId', asPieceId)
      if (!pieceId.ok) return pieceId
      const x = parseNumber(raw.x, 'x')
      if (!x.ok) return x
      const y = parseNumber(raw.y, 'y')
      if (!y.ok) return y
      const expectedSeq = parseOptionalSeq(raw.expectedSeq, 'expectedSeq')
      if (!expectedSeq.ok) return expectedSeq

      return ok({
        type: 'MovePiece',
        ...base.value,
        pieceId: pieceId.value,
        x: x.value,
        y: y.value,
        ...(expectedSeq.value === undefined
          ? {}
          : {expectedSeq: expectedSeq.value})
      })
    }

    case 'SetPieceVisibility': {
      const pieceId = parseId(raw.pieceId, 'pieceId', asPieceId)
      if (!pieceId.ok) return pieceId
      const visibility = parsePieceVisibility(raw.visibility)
      if (!visibility.ok) return visibility

      return ok({
        type: 'SetPieceVisibility',
        ...base.value,
        pieceId: pieceId.value,
        visibility: visibility.value
      })
    }

    case 'SetPieceFreedom': {
      const pieceId = parseId(raw.pieceId, 'pieceId', asPieceId)
      if (!pieceId.ok) return pieceId
      const freedom = parsePieceFreedom(raw.freedom)
      if (!freedom.ok) return freedom

      return ok({
        type: 'SetPieceFreedom',
        ...base.value,
        pieceId: pieceId.value,
        freedom: freedom.value
      })
    }

    case 'RollDice': {
      const expression = parseString(raw.expression, 'expression')
      if (!expression.ok) return expression
      const reason = parseString(raw.reason, 'reason')
      if (!reason.ok) return reason

      return ok({
        type: 'RollDice',
        ...base.value,
        expression: expression.value,
        reason: reason.value
      })
    }

    default:
      return err(invalidCommand(`Unsupported command type ${raw.type}`))
  }
}

export const decodeClientMessage = (
  raw: unknown
): Result<ClientMessage, CommandError> => {
  if (!isObject(raw) || !isString(raw.type)) {
    return err(invalidMessage('Message must be an object with a type'))
  }

  if (raw.type === 'ping') {
    if (raw.requestId !== undefined && !isString(raw.requestId)) {
      return err(invalidMessage('requestId must be a string'))
    }

    return ok({
      type: 'ping',
      ...(raw.requestId === undefined ? {} : {requestId: raw.requestId})
    })
  }

  if (raw.type !== 'command') {
    return err(invalidMessage(`Unsupported message type ${raw.type}`))
  }

  const requestId = parseString(raw.requestId, 'requestId')
  if (!requestId.ok) return err(invalidMessage(requestId.error.message))

  const command = decodeCommand(raw.command)
  if (!command.ok) return command

  return ok({
    type: 'command',
    requestId: requestId.value,
    command: command.value
  })
}
