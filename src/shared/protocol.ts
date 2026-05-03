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
import type {
  CharacterEquipmentItem,
  CharacteristicKey,
  CharacterSheetPatch,
  CharacterType,
  PieceFreedom,
  PieceVisibility
} from './state'
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

const parseOptionalId = <T>(
  raw: unknown,
  label: string,
  parse: (value: string) => T
): Result<T | null, CommandError> => {
  if (raw === undefined || raw === null) return ok(null)

  return parseId(raw, label, parse)
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

const parseOptionalString = (
  raw: unknown,
  label: string
): Result<string | null, CommandError> => {
  if (raw === undefined || raw === null) return ok(null)
  if (!isString(raw)) return err(invalidCommand(`${label} must be a string`))

  const value = raw.trim()
  if (!value) return ok(null)

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

const parseOptionalFinitePositiveNumber = (
  raw: unknown,
  label: string
): Result<number | undefined, CommandError> => {
  if (raw === undefined) return ok(undefined)
  const value = parseNumber(raw, label)
  if (!value.ok) return value
  if (value.value <= 0) {
    return err(invalidCommand(`${label} must be positive`))
  }

  return ok(value.value)
}

const parseNullableNumber = (
  raw: unknown,
  label: string
): Result<number | null, CommandError> => {
  if (raw === null) return ok(null)

  return parseNumber(raw, label)
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

const parseStringArray = (
  raw: unknown,
  label: string
): Result<string[], CommandError> => {
  if (!Array.isArray(raw)) {
    return err(invalidCommand(`${label} must be an array`))
  }

  const values: string[] = []
  for (const [index, item] of raw.entries()) {
    const value = parseString(item, `${label}[${index}]`)
    if (!value.ok) return value
    values.push(value.value)
  }

  return ok(values)
}

const characteristicKeys = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
] satisfies CharacteristicKey[]

const parseCharacteristicsPatch = (
  raw: unknown,
  label: string
): Result<CharacterSheetPatch['characteristics'], CommandError> => {
  if (!isObject(raw)) {
    return err(invalidCommand(`${label} must be an object`))
  }

  const patch: CharacterSheetPatch['characteristics'] = {}

  for (const key of characteristicKeys) {
    if (raw[key] === undefined) continue
    const value = parseNullableNumber(raw[key], `${label}.${key}`)
    if (!value.ok) return value
    patch[key] = value.value
  }

  return ok(patch)
}

const parseEquipment = (
  raw: unknown,
  label: string
): Result<CharacterEquipmentItem[], CommandError> => {
  if (!Array.isArray(raw)) {
    return err(invalidCommand(`${label} must be an array`))
  }

  const equipment: CharacterEquipmentItem[] = []
  for (const [index, item] of raw.entries()) {
    if (!isObject(item)) {
      return err(invalidCommand(`${label}[${index}] must be an object`))
    }

    const name = parseString(item.name, `${label}[${index}].name`)
    if (!name.ok) return name
    const quantity = parseNumber(item.quantity, `${label}[${index}].quantity`)
    if (!quantity.ok) return quantity
    const notes = parseOptionalString(item.notes, `${label}[${index}].notes`)
    if (!notes.ok) return notes

    equipment.push({
      name: name.value,
      quantity: quantity.value,
      notes: notes.value ?? ''
    })
  }

  return ok(equipment)
}

const parseCharacterSheetPatch = (
  raw: Record<string, unknown>
): Result<CharacterSheetPatch, CommandError> => {
  const patch: CharacterSheetPatch = {}

  if (raw.notes !== undefined) {
    if (!isString(raw.notes)) {
      return err(invalidCommand('notes must be a string'))
    }
    patch.notes = raw.notes
  }

  if (raw.age !== undefined) {
    const age = parseNullableNumber(raw.age, 'age')
    if (!age.ok) return age
    patch.age = age.value
  }

  if (raw.characteristics !== undefined) {
    const characteristics = parseCharacteristicsPatch(
      raw.characteristics,
      'characteristics'
    )
    if (!characteristics.ok) return characteristics
    patch.characteristics = characteristics.value
  }

  if (raw.skills !== undefined) {
    const skills = parseStringArray(raw.skills, 'skills')
    if (!skills.ok) return skills
    patch.skills = skills.value
  }

  if (raw.equipment !== undefined) {
    const equipment = parseEquipment(raw.equipment, 'equipment')
    if (!equipment.ok) return equipment
    patch.equipment = equipment.value
  }

  if (raw.credits !== undefined) {
    const credits = parseNumber(raw.credits, 'credits')
    if (!credits.ok) return credits
    patch.credits = credits.value
  }

  return ok(patch)
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

    case 'UpdateCharacterSheet': {
      const characterId = parseId(
        raw.characterId,
        'characterId',
        asCharacterId
      )
      if (!characterId.ok) return characterId
      const sheetPatch = parseCharacterSheetPatch(raw)
      if (!sheetPatch.ok) return sheetPatch

      return ok({
        type: 'UpdateCharacterSheet',
        ...base.value,
        characterId: characterId.value,
        ...sheetPatch.value
      })
    }

    case 'CreateBoard': {
      const boardId = parseId(raw.boardId, 'boardId', asBoardId)
      if (!boardId.ok) return boardId
      const name = parseString(raw.name, 'name')
      if (!name.ok) return name
      const imageAssetId = parseOptionalString(raw.imageAssetId, 'imageAssetId')
      if (!imageAssetId.ok) return imageAssetId
      const url = parseOptionalString(raw.url, 'url')
      if (!url.ok) return url
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
        imageAssetId: imageAssetId.value,
        url: url.value,
        width: width.value,
        height: height.value,
        scale: scale.value
      })
    }

    case 'SelectBoard': {
      const boardId = parseId(raw.boardId, 'boardId', asBoardId)
      if (!boardId.ok) return boardId

      return ok({
        type: 'SelectBoard',
        ...base.value,
        boardId: boardId.value
      })
    }

    case 'CreatePiece': {
      const pieceId = parseId(raw.pieceId, 'pieceId', asPieceId)
      if (!pieceId.ok) return pieceId
      const boardId = parseId(raw.boardId, 'boardId', asBoardId)
      if (!boardId.ok) return boardId
      const characterId = parseOptionalId(
        raw.characterId,
        'characterId',
        asCharacterId
      )
      if (!characterId.ok) return characterId
      const name = parseString(raw.name, 'name')
      if (!name.ok) return name
      const imageAssetId = parseOptionalString(raw.imageAssetId, 'imageAssetId')
      if (!imageAssetId.ok) return imageAssetId
      const x = parseNumber(raw.x, 'x')
      if (!x.ok) return x
      const y = parseNumber(raw.y, 'y')
      if (!y.ok) return y
      const width = parseOptionalFinitePositiveNumber(raw.width, 'width')
      if (!width.ok) return width
      const height = parseOptionalFinitePositiveNumber(raw.height, 'height')
      if (!height.ok) return height
      const scale = parseOptionalFinitePositiveNumber(raw.scale, 'scale')
      if (!scale.ok) return scale

      return ok({
        type: 'CreatePiece',
        ...base.value,
        pieceId: pieceId.value,
        boardId: boardId.value,
        characterId: characterId.value,
        name: name.value,
        imageAssetId: imageAssetId.value,
        x: x.value,
        y: y.value,
        ...(width.value === undefined ? {} : {width: width.value}),
        ...(height.value === undefined ? {} : {height: height.value}),
        ...(scale.value === undefined ? {} : {scale: scale.value})
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
