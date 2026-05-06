import { asBoardId, asCharacterId, asGameId, asPieceId, asUserId } from './ids'
import type { CareerCreationEvent } from './characterCreation'
import { err, ok, type Result } from './result'
import type { Command, GameCommand } from './commands'
import type { GameState } from './state'
import type { LiveActivityDescriptor } from './live-activity'
import type {
  CharacterCreationSheet,
  CharacterCreationHomeworld,
  CharacterEquipmentItem,
  CharacteristicKey,
  CharacterSheetPatch,
  CharacterType,
  PieceFreedom,
  PieceVisibility
} from './state'
import { isObject, isString } from './util'

export type CommandErrorCode =
  | 'invalid_message'
  | 'invalid_command'
  | 'wrong_room'
  | 'game_exists'
  | 'game_not_found'
  | 'duplicate_entity'
  | 'missing_entity'
  | 'not_allowed'
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
      liveActivities?: LiveActivityDescriptor[]
    }
  | {
      type: 'commandAccepted'
      requestId: string
      state: GameState
      eventSeq: number
      liveActivities?: LiveActivityDescriptor[]
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

const MAX_STRING_ARRAY_LENGTH = 100
const MAX_STRING_ARRAY_ITEM_LENGTH = 200

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
  if (raw.length > MAX_STRING_ARRAY_LENGTH) {
    return err(
      invalidCommand(
        `${label} cannot contain more than ${MAX_STRING_ARRAY_LENGTH} entries`
      )
    )
  }

  const values: string[] = []
  for (const [index, item] of raw.entries()) {
    const value = parseString(item, `${label}[${index}]`)
    if (!value.ok) return value
    if (value.value.length > MAX_STRING_ARRAY_ITEM_LENGTH) {
      return err(
        invalidCommand(
          `${label}[${index}] cannot exceed ${MAX_STRING_ARRAY_ITEM_LENGTH} characters`
        )
      )
    }
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

const parseCharacteristics = (
  raw: unknown,
  label: string
): Result<CharacterCreationSheet['characteristics'], CommandError> => {
  const patch = parseCharacteristicsPatch(raw, label)
  if (!patch.ok) return patch

  for (const key of characteristicKeys) {
    if (!patch.value || patch.value[key] === undefined) {
      return err(invalidCommand(`${label}.${key} is required`))
    }
  }

  return ok(patch.value as CharacterCreationSheet['characteristics'])
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

const parseCharacterCreationSheet = (
  raw: Record<string, unknown>
): Result<CharacterCreationSheet, CommandError> => {
  if (!isString(raw.notes)) {
    return err(invalidCommand('notes must be a string'))
  }
  const age = parseNullableNumber(raw.age, 'age')
  if (!age.ok) return age
  const characteristics = parseCharacteristics(
    raw.characteristics,
    'characteristics'
  )
  if (!characteristics.ok) return characteristics
  const skills = parseStringArray(raw.skills, 'skills')
  if (!skills.ok) return skills
  const equipment = parseEquipment(raw.equipment, 'equipment')
  if (!equipment.ok) return equipment
  const credits = parseNumber(raw.credits, 'credits')
  if (!credits.ok) return credits

  return ok({
    notes: raw.notes,
    age: age.value,
    characteristics: characteristics.value,
    skills: skills.value,
    equipment: equipment.value,
    credits: credits.value
  })
}

const parseHomeworldTradeCodes = (
  raw: unknown,
  label: string
): Result<string[], CommandError> => {
  if (isString(raw)) {
    const value = raw.trim()
    if (value.length > MAX_STRING_ARRAY_ITEM_LENGTH) {
      return err(
        invalidCommand(
          `${label} cannot exceed ${MAX_STRING_ARRAY_ITEM_LENGTH} characters`
        )
      )
    }
    return ok(value ? [value] : [])
  }

  if (!Array.isArray(raw)) {
    return err(invalidCommand(`${label} must be a string or an array`))
  }
  if (raw.length > MAX_STRING_ARRAY_LENGTH) {
    return err(
      invalidCommand(
        `${label} cannot contain more than ${MAX_STRING_ARRAY_LENGTH} entries`
      )
    )
  }

  const values: string[] = []
  const seen = new Set<string>()
  for (const [index, item] of raw.entries()) {
    const value = parseString(item, `${label}[${index}]`)
    if (!value.ok) return value
    if (value.value.length > MAX_STRING_ARRAY_ITEM_LENGTH) {
      return err(
        invalidCommand(
          `${label}[${index}] cannot exceed ${MAX_STRING_ARRAY_ITEM_LENGTH} characters`
        )
      )
    }
    const key = value.value.toLowerCase()
    if (seen.has(key)) continue
    values.push(value.value)
    seen.add(key)
  }

  return ok(values)
}

const parseCharacterCreationHomeworld = (
  raw: unknown
): Result<CharacterCreationHomeworld, CommandError> => {
  if (!isObject(raw)) {
    return err(invalidCommand('homeworld must be an object'))
  }

  const name = parseOptionalString(raw.name, 'homeworld.name')
  if (!name.ok) return name
  const lawLevel = parseString(raw.lawLevel, 'homeworld.lawLevel')
  if (!lawLevel.ok) return lawLevel
  const tradeCodes = parseHomeworldTradeCodes(
    raw.tradeCodes,
    'homeworld.tradeCodes'
  )
  if (!tradeCodes.ok) return tradeCodes
  if (tradeCodes.value.length === 0) {
    return err(invalidCommand('homeworld.tradeCodes cannot be empty'))
  }

  return ok({
    name: name.value,
    lawLevel: lawLevel.value,
    tradeCodes: tradeCodes.value
  })
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

const parseBoolean = (
  raw: unknown,
  label: string
): Result<boolean, CommandError> => {
  if (typeof raw !== 'boolean') {
    return err(invalidCommand(`${label} must be a boolean`))
  }

  return ok(raw)
}

const parseOptionalBoolean = (
  raw: unknown,
  label: string
): Result<boolean | undefined, CommandError> => {
  if (raw === undefined) return ok(undefined)

  return parseBoolean(raw, label)
}

const parseCareerCreationEvent = (
  raw: unknown
): Result<CareerCreationEvent, CommandError> => {
  if (!isObject(raw) || !isString(raw.type)) {
    return err(invalidCommand('creationEvent must be an object with a type'))
  }

  switch (raw.type) {
    case 'SET_CHARACTERISTICS':
    case 'COMPLETE_HOMEWORLD':
    case 'COMPLETE_BASIC_TRAINING':
    case 'SURVIVAL_FAILED':
    case 'COMPLETE_COMMISSION':
    case 'SKIP_COMMISSION':
    case 'COMPLETE_ADVANCEMENT':
    case 'SKIP_ADVANCEMENT':
    case 'COMPLETE_SKILLS':
    case 'COMPLETE_AGING':
    case 'REENLIST':
    case 'LEAVE_CAREER':
    case 'REENLIST_BLOCKED':
    case 'FORCED_REENLIST':
    case 'CONTINUE_CAREER':
    case 'FINISH_MUSTERING':
    case 'CREATION_COMPLETE':
    case 'DEATH_CONFIRMED':
    case 'MISHAP_RESOLVED':
    case 'RESET':
      return ok({ type: raw.type })

    case 'SELECT_CAREER': {
      const isNewCareer = parseBoolean(raw.isNewCareer, 'isNewCareer')
      if (!isNewCareer.ok) return isNewCareer
      const drafted = parseOptionalBoolean(raw.drafted, 'drafted')
      if (!drafted.ok) return drafted

      return ok({
        type: 'SELECT_CAREER',
        isNewCareer: isNewCareer.value,
        ...(drafted.value === undefined ? {} : { drafted: drafted.value })
      })
    }

    case 'SURVIVAL_PASSED': {
      const canCommission = parseBoolean(raw.canCommission, 'canCommission')
      if (!canCommission.ok) return canCommission
      const canAdvance = parseBoolean(raw.canAdvance, 'canAdvance')
      if (!canAdvance.ok) return canAdvance

      return ok({
        type: 'SURVIVAL_PASSED',
        canCommission: canCommission.value,
        canAdvance: canAdvance.value
      })
    }

    default:
      return err(
        invalidCommand(`Unsupported character creation event ${raw.type}`)
      )
  }
}

const parseBaseCommand = (
  raw: Record<string, unknown>
): Result<
  Pick<GameCommand, 'gameId' | 'actorId' | 'expectedSeq'>,
  CommandError
> => {
  const gameId = parseId(raw.gameId, 'gameId', asGameId)
  if (!gameId.ok) return gameId

  const actorId = parseId(raw.actorId, 'actorId', asUserId)
  if (!actorId.ok) return actorId

  const expectedSeq = parseOptionalSeq(raw.expectedSeq, 'expectedSeq')
  if (!expectedSeq.ok) return expectedSeq

  return ok({
    gameId: gameId.value,
    actorId: actorId.value,
    ...(expectedSeq.value === undefined
      ? {}
      : { expectedSeq: expectedSeq.value })
  })
}

export const decodeCommand = (
  raw: unknown
): Result<GameCommand, CommandError> => {
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
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
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
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
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

    case 'StartCharacterCreation': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId

      return ok({
        type: 'StartCharacterCreation',
        ...base.value,
        characterId: characterId.value
      })
    }

    case 'AdvanceCharacterCreation': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId
      const creationEvent = parseCareerCreationEvent(raw.creationEvent)
      if (!creationEvent.ok) return creationEvent

      return ok({
        type: 'AdvanceCharacterCreation',
        ...base.value,
        characterId: characterId.value,
        creationEvent: creationEvent.value
      })
    }

    case 'CompleteCharacterCreationBasicTraining': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId

      return ok({
        type: 'CompleteCharacterCreationBasicTraining',
        ...base.value,
        characterId: characterId.value
      })
    }

    case 'SetCharacterCreationHomeworld': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId
      const homeworld = parseCharacterCreationHomeworld(raw.homeworld)
      if (!homeworld.ok) return homeworld

      return ok({
        type: 'SetCharacterCreationHomeworld',
        ...base.value,
        characterId: characterId.value,
        homeworld: homeworld.value
      })
    }

    case 'SelectCharacterCreationBackgroundSkill': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId
      const skill = parseString(raw.skill, 'skill')
      if (!skill.ok) return skill

      return ok({
        type: 'SelectCharacterCreationBackgroundSkill',
        ...base.value,
        characterId: characterId.value,
        skill: skill.value
      })
    }

    case 'ResolveCharacterCreationCascadeSkill': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId
      const cascadeSkill = parseString(raw.cascadeSkill, 'cascadeSkill')
      if (!cascadeSkill.ok) return cascadeSkill
      const selection = parseString(raw.selection, 'selection')
      if (!selection.ok) return selection

      return ok({
        type: 'ResolveCharacterCreationCascadeSkill',
        ...base.value,
        characterId: characterId.value,
        cascadeSkill: cascadeSkill.value,
        selection: selection.value
      })
    }

    case 'FinalizeCharacterCreation': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId
      const sheet = parseCharacterCreationSheet(raw)
      if (!sheet.ok) return sheet

      return ok({
        type: 'FinalizeCharacterCreation',
        ...base.value,
        characterId: characterId.value,
        ...sheet.value
      })
    }

    case 'StartCharacterCareerTerm': {
      const characterId = parseId(raw.characterId, 'characterId', asCharacterId)
      if (!characterId.ok) return characterId
      const career = parseString(raw.career, 'career')
      if (!career.ok) return career
      const drafted = parseOptionalBoolean(raw.drafted, 'drafted')
      if (!drafted.ok) return drafted

      return ok({
        type: 'StartCharacterCareerTerm',
        ...base.value,
        characterId: characterId.value,
        career: career.value,
        ...(drafted.value === undefined ? {} : { drafted: drafted.value })
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

    case 'SetDoorOpen': {
      const boardId = parseId(raw.boardId, 'boardId', asBoardId)
      if (!boardId.ok) return boardId
      const doorId = parseString(raw.doorId, 'doorId')
      if (!doorId.ok) return doorId
      const open = parseBoolean(raw.open, 'open')
      if (!open.ok) return open

      return ok({
        type: 'SetDoorOpen',
        ...base.value,
        boardId: boardId.value,
        doorId: doorId.value,
        open: open.value
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
        ...(width.value === undefined ? {} : { width: width.value }),
        ...(height.value === undefined ? {} : { height: height.value }),
        ...(scale.value === undefined ? {} : { scale: scale.value })
      })
    }

    case 'MovePiece': {
      const pieceId = parseId(raw.pieceId, 'pieceId', asPieceId)
      if (!pieceId.ok) return pieceId
      const x = parseNumber(raw.x, 'x')
      if (!x.ok) return x
      const y = parseNumber(raw.y, 'y')
      if (!y.ok) return y

      return ok({
        type: 'MovePiece',
        ...base.value,
        pieceId: pieceId.value,
        x: x.value,
        y: y.value
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
      ...(raw.requestId === undefined ? {} : { requestId: raw.requestId })
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
  } as ClientMessage)
}
