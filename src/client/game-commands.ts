import type { Command } from '../shared/commands'
import {
  asBoardId,
  asCharacterId,
  asGameId,
  asPieceId,
  asUserId,
  type BoardId,
  type CharacterId,
  type GameId,
  type PieceId,
  type UserId
} from '../shared/ids'
import type { ClientMessage, ServerMessage } from '../shared/protocol'
import type { LiveActivityDescriptor } from '../shared/live-activity'
import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacteristicKey,
  CharacterSheetPatch,
  CharacterState,
  GameState
} from '../shared/state'

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
  shouldApplyState: boolean
  shouldReload: boolean
  error: string | null
  liveActivities: readonly LiveActivityDescriptor[]
  diceRollActivities: readonly ClientDiceRollActivity[]
}

export interface ClientDiceRollActivity {
  id: string
  revealAt: string
  rolls: readonly number[]
  total: number
}

export const DEFAULT_GAME_ID = 'demo-room'
export const DEFAULT_ACTOR_ID = 'local-user'
export const DEFAULT_BOARD_ID = asBoardId('main-board')
export const DEFAULT_CHARACTER_ID = asCharacterId('scout')
export const DEFAULT_PIECE_ID = asPieceId('scout-1')

type UpdateCharacterSheetCommand = Extract<
  Command,
  { type: 'UpdateCharacterSheet' }
>
type AdvanceCharacterCreationCommand = Extract<
  Command,
  { type: 'AdvanceCharacterCreation' }
>
type StartCharacterCareerTermCommand = Extract<
  Command,
  { type: 'StartCharacterCareerTerm' }
>
type CharacterSheetPatchInput = CharacterSheetPatch & {
  skillsText?: string
  equipmentText?: string
}
type CreatePieceCommand = Extract<Command, { type: 'CreatePiece' }>
type SetDoorOpenCommand = Extract<Command, { type: 'SetDoorOpen' }>
type CreatePieceDimensions = {
  width: number
  height: number
  scale: number
}
type CreatePieceCommandWithDimensions = CreatePieceCommand &
  Partial<CreatePieceDimensions>
type CharacteristicFormValue =
  | string
  | number
  | null
  | undefined
  | { value: string | number | null | undefined }

const CHARACTERISTIC_KEYS = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
] satisfies CharacteristicKey[]

export const resolveClientIdentity = (
  searchParams: URLSearchParams
): ClientIdentity => ({
  gameId: asGameId(searchParams.get('game') ?? DEFAULT_GAME_ID),
  actorId: asUserId(searchParams.get('user') ?? DEFAULT_ACTOR_ID)
})

export const buildCommandMessage = (
  requestId: string,
  command: Command
): Extract<ClientMessage, { type: 'command' }> => ({
  type: 'command',
  requestId,
  command
})

export const buildSequencedCommand = (
  command: Command,
  state: Pick<GameState, 'eventSeq'> | null
): Command => {
  if (!state || command.expectedSeq !== undefined) return command
  if (command.type === 'CreateGame') return command

  return {
    ...command,
    expectedSeq: state.eventSeq
  }
}

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
  boardId: DEFAULT_BOARD_ID,
  name: 'Downport Skirmish',
  width: 1200,
  height: 800,
  scale: 50
})

export const buildCreateCharacterCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID
}: ClientCommandOptions & {
  characterId?: CharacterId
}): Command => ({
  type: 'CreateCharacter',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  characterType: 'PLAYER',
  name: 'Scout'
})

export const normalizeCharacterSkillList = (
  value: string | readonly string[]
): string[] => {
  const rawSkills =
    typeof value === 'string' ? value.split(/[\n,]/) : Array.from(value)
  const skills: string[] = []
  const seen = new Set<string>()

  for (const rawSkill of rawSkills) {
    const skill = rawSkill.trim()
    const key = skill.toLowerCase()
    if (!skill || seen.has(key)) continue
    skills.push(skill)
    seen.add(key)
  }

  return skills
}

export const normalizeCharacterEquipmentText = (
  value: string
): CharacterEquipmentItem[] => {
  const equipment: CharacterEquipmentItem[] = []

  for (const line of value.split('\n')) {
    const [rawName = '', rawQuantity = '1', ...rawNotes] = line
      .split('|')
      .map((part) => part.trim())
    const name = rawName.trim()
    if (!name) continue

    const quantity = Number.parseInt(rawQuantity, 10)
    equipment.push({
      name,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      notes: rawNotes.join(' | ').trim()
    })
  }

  return equipment
}

export const formatCharacterEquipmentText = (
  equipment: readonly CharacterEquipmentItem[]
): string =>
  equipment
    .map((item) => [item.name, item.quantity, item.notes].join(' | '))
    .join('\n')

const formValue = (value: CharacteristicFormValue): string | number | null => {
  if (value === undefined) return null
  if (value && typeof value === 'object' && 'value' in value) {
    return formValue(value.value)
  }
  return value
}

const parseNullableFormNumber = (
  value: CharacteristicFormValue
): number | null => {
  const rawValue = formValue(value)
  if (rawValue === null) return null
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null
  }

  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const number = Number.parseInt(trimmed, 10)
  return Number.isFinite(number) ? number : null
}

export const parseCharacterCharacteristicsPatch = (
  values: Partial<
    Record<
      CharacteristicKey | Uppercase<CharacteristicKey>,
      CharacteristicFormValue
    >
  >
): Partial<CharacterCharacteristics> => {
  const characteristics: Partial<CharacterCharacteristics> = {}

  for (const key of CHARACTERISTIC_KEYS) {
    const upperKey = key.toUpperCase() as Uppercase<CharacteristicKey>
    if (values[key] === undefined && values[upperKey] === undefined) continue
    characteristics[key] = parseNullableFormNumber(
      values[key] ?? values[upperKey]
    )
  }

  return characteristics
}

export const buildCharacterSkillRollReason = ({
  character,
  skill,
  fallbackName = 'Character'
}: {
  character: Pick<CharacterState, 'name'> | null | undefined
  skill: string
  fallbackName?: string
}): string => {
  const characterName = character?.name.trim() || fallbackName
  const skillName = skill.trim() || 'Skill'
  return `${characterName}: ${skillName}`
}

const hasCharacterSheetPatch = (patch: CharacterSheetPatch): boolean =>
  patch.notes !== undefined ||
  patch.age !== undefined ||
  patch.characteristics !== undefined ||
  patch.skills !== undefined ||
  patch.equipment !== undefined ||
  patch.credits !== undefined

const normalizeCharacterSheetPatch = (
  patch: CharacterSheetPatchInput
): CharacterSheetPatch => {
  const normalized: CharacterSheetPatch = {}

  if (patch.notes !== undefined) normalized.notes = patch.notes
  if (patch.age !== undefined) normalized.age = patch.age
  if (patch.characteristics !== undefined) {
    normalized.characteristics = { ...patch.characteristics }
  }
  if (patch.skillsText !== undefined) {
    normalized.skills = normalizeCharacterSkillList(patch.skillsText)
  } else if (patch.skills !== undefined) {
    normalized.skills = normalizeCharacterSkillList(patch.skills)
  }
  if (patch.equipmentText !== undefined) {
    normalized.equipment = normalizeCharacterEquipmentText(patch.equipmentText)
  } else if (patch.equipment !== undefined) {
    normalized.equipment = patch.equipment.map((item) => ({ ...item }))
  }
  if (patch.credits !== undefined) normalized.credits = patch.credits

  return normalized
}

export const buildCharacterSheetPatchCommand = ({
  identity,
  character,
  patch
}: ClientCommandOptions & {
  character: Pick<CharacterState, 'id'> | null
  patch: CharacterSheetPatchInput
}): UpdateCharacterSheetCommand | null => {
  if (!character) return null

  const normalizedPatch = normalizeCharacterSheetPatch(patch)
  if (!hasCharacterSheetPatch(normalizedPatch)) return null

  return {
    type: 'UpdateCharacterSheet',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: character.id,
    ...normalizedPatch
  }
}

export const buildDefaultCharacterSheetUpdateCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID
}: ClientCommandOptions & {
  characterId?: CharacterId
}): UpdateCharacterSheetCommand => ({
  type: 'UpdateCharacterSheet',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  age: 34,
  characteristics: {
    str: 7,
    dex: 8,
    end: 8,
    int: 7,
    edu: 9,
    soc: 6
  },
  skills: ['Vacc Suit-0', 'Gun Combat-0', 'Mechanic-0', 'Recon-0'],
  equipment: [
    { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
    {
      name: 'Laser Carbine',
      quantity: 1,
      notes: 'Carried'
    },
    {
      name: 'Medkit',
      quantity: 1,
      notes: 'Stowed'
    }
  ],
  credits: 1200
})

export const buildStartCharacterCreationCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID
}: ClientCommandOptions & {
  characterId?: CharacterId
}): Command => ({
  type: 'StartCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId
})

export const buildSetCharacterCharacteristicsCreationCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID
}: ClientCommandOptions & {
  characterId?: CharacterId
}): AdvanceCharacterCreationCommand => ({
  type: 'AdvanceCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  creationEvent: { type: 'SET_CHARACTERISTICS' }
})

export const buildCompleteCharacterHomeworldCreationCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID
}: ClientCommandOptions & {
  characterId?: CharacterId
}): AdvanceCharacterCreationCommand => ({
  type: 'AdvanceCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  creationEvent: { type: 'COMPLETE_HOMEWORLD' }
})

export const buildStartCharacterCareerTermCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID,
  career = 'Scout'
}: ClientCommandOptions & {
  characterId?: CharacterId
  career?: string
}): StartCharacterCareerTermCommand => ({
  type: 'StartCharacterCareerTerm',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  career
})

export const buildSelectCharacterCareerCreationCommand = ({
  identity,
  characterId = DEFAULT_CHARACTER_ID
}: ClientCommandOptions & {
  characterId?: CharacterId
}): AdvanceCharacterCreationCommand => ({
  type: 'AdvanceCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  creationEvent: {
    type: 'SELECT_CAREER',
    isNewCareer: true
  }
})

export const buildCreatePieceCommand = ({
  identity,
  boardId = DEFAULT_BOARD_ID,
  characterId = null,
  imageAssetId = null,
  width = 50,
  height = 50,
  scale = 1
}: ClientCommandOptions & {
  boardId?: BoardId
  characterId?: CharacterId | null
  imageAssetId?: string | null
} & Partial<CreatePieceDimensions>): CreatePieceCommandWithDimensions => ({
  type: 'CreatePiece',
  gameId: identity.gameId,
  actorId: identity.actorId,
  pieceId: DEFAULT_PIECE_ID,
  boardId,
  characterId,
  name: 'Scout',
  imageAssetId,
  x: 220,
  y: 180,
  width,
  height,
  scale
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

export const buildSetDoorOpenCommand = ({
  identity,
  state,
  boardId,
  doorId,
  open
}: {
  identity: ClientIdentity
  state: Pick<GameState, 'eventSeq'>
  boardId: BoardId
  doorId: string
  open: boolean
}): SetDoorOpenCommand => ({
  type: 'SetDoorOpen',
  gameId: identity.gameId,
  actorId: identity.actorId,
  boardId,
  doorId,
  open,
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
    return [buildCreateGameCommand({ requestId: 'bootstrap-game', identity })]
  }

  if (Object.keys(state.boards).length === 0) {
    return [
      buildSequencedCommand(
        buildCreateBoardCommand({ requestId: 'bootstrap-board', identity }),
        state
      )
    ]
  }

  const scout = state.characters[DEFAULT_CHARACTER_ID]
  if (!scout) {
    return [
      buildSequencedCommand(
        buildCreateCharacterCommand({
          requestId: 'bootstrap-character',
          identity
        }),
        state
      )
    ]
  }

  if (!scout.creation) {
    return [
      buildSequencedCommand(
        buildStartCharacterCreationCommand({
          requestId: 'bootstrap-character-creation',
          identity
        }),
        state
      )
    ]
  }

  if (scout.creation.state.status === 'CHARACTERISTICS') {
    return [
      buildSequencedCommand(
        buildSetCharacterCharacteristicsCreationCommand({
          requestId: 'bootstrap-characteristics',
          identity
        }),
        state
      )
    ]
  }

  if (scout.creation.state.status === 'HOMEWORLD') {
    return [
      buildSequencedCommand(
        buildCompleteCharacterHomeworldCreationCommand({
          requestId: 'bootstrap-homeworld',
          identity
        }),
        state
      )
    ]
  }

  if (scout.creation.terms.length === 0) {
    return [
      buildSequencedCommand(
        buildStartCharacterCareerTermCommand({
          requestId: 'bootstrap-career-term',
          identity
        }),
        state
      )
    ]
  }

  if (scout.creation.state.status === 'CAREER_SELECTION') {
    return [
      buildSequencedCommand(
        buildSelectCharacterCareerCreationCommand({
          requestId: 'bootstrap-career-selection',
          identity
        }),
        state
      )
    ]
  }

  if ((scout.skills || []).length === 0) {
    return [
      buildSequencedCommand(
        buildDefaultCharacterSheetUpdateCommand({
          requestId: 'bootstrap-character-sheet',
          identity
        }),
        state
      )
    ]
  }

  if (Object.keys(state.pieces).length === 0) {
    const boardId = (state.selectedBoardId ??
      Object.keys(state.boards)[0]) as BoardId
    const characterId = (
      state.characters[DEFAULT_CHARACTER_ID]
        ? DEFAULT_CHARACTER_ID
        : Object.keys(state.characters)[0]
    ) as CharacterId

    return [
      buildSequencedCommand(
        buildCreatePieceCommand({
          requestId: 'bootstrap-piece',
          identity,
          boardId,
          characterId
        }),
        state
      )
    ]
  }

  return []
}

export const deriveServerMessageLiveActivities = (
  message: ServerMessage
): readonly LiveActivityDescriptor[] => {
  switch (message.type) {
    case 'roomState':
    case 'commandAccepted':
      return message.liveActivities ?? []

    default:
      return []
  }
}

export const deriveServerMessageDiceRollActivities = (
  message: ServerMessage
): ClientDiceRollActivity[] => {
  const diceRolls: ClientDiceRollActivity[] = []

  for (const activity of deriveServerMessageLiveActivities(message)) {
    if (activity.type !== 'diceRoll') continue
    diceRolls.push({
      id: activity.id,
      revealAt: activity.reveal.revealAt,
      rolls: activity.rolls,
      total: activity.total
    })
  }

  return diceRolls
}

export const applyServerMessage = (
  currentState: GameState | null,
  message: ServerMessage
): ClientMessageApplication => {
  const liveActivities = deriveServerMessageLiveActivities(message)
  const diceRollActivities = deriveServerMessageDiceRollActivities(message)

  switch (message.type) {
    case 'roomState':
      return {
        state: message.state,
        shouldApplyState: true,
        shouldReload: false,
        error: null,
        liveActivities,
        diceRollActivities
      }

    case 'commandAccepted':
      return {
        state: message.state,
        shouldApplyState: true,
        shouldReload: false,
        error: null,
        liveActivities,
        diceRollActivities
      }

    case 'commandRejected':
      return {
        state: currentState,
        shouldApplyState: false,
        shouldReload: message.error.code === 'stale_command',
        error: message.error.message,
        liveActivities,
        diceRollActivities
      }

    case 'error':
      return {
        state: currentState,
        shouldApplyState: false,
        shouldReload: false,
        error: message.error.message,
        liveActivities,
        diceRollActivities
      }

    case 'pong':
      return {
        state: currentState,
        shouldApplyState: false,
        shouldReload: false,
        error: null,
        liveActivities,
        diceRollActivities
      }

    default: {
      const exhaustive: never = message
      return {
        state: currentState,
        shouldApplyState: false,
        shouldReload: false,
        error: `Unhandled message ${(exhaustive as { type: string }).type}`,
        liveActivities,
        diceRollActivities
      }
    }
  }
}
