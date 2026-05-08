import type { Command, GameCommand } from '../../shared/commands'
import type {
  BoardId,
  CharacterId,
  GameId,
  PieceId,
  UserId
} from '../../shared/ids'
import type { CharacteristicKey, GameState } from '../../shared/state'

export interface BootstrapCommandContext {
  roomId: GameId
  actorId: UserId
}

export interface BootstrapFlowContext extends BootstrapCommandContext {
  state: GameState | null
}

const idFromName = (name: string, fallback: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback

const scoutCharacterId = 'scout' as CharacterId
const bootstrapCharacteristicKeys = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
] satisfies CharacteristicKey[]

export const createGameCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): Command => ({
  type: 'CreateGame',
  gameId: roomId,
  actorId,
  slug: roomId,
  name: `Cepheus Room ${roomId}`
})

export const createBoardCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): Command => ({
  type: 'CreateBoard',
  gameId: roomId,
  actorId,
  boardId: 'main-board' as BoardId,
  name: 'Downport Skirmish',
  width: 1200,
  height: 800,
  scale: 50
})

export const createCharacterCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): Command => ({
  type: 'CreateCharacter',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId,
  characterType: 'PLAYER',
  name: 'Scout'
})

export const updateScoutSheetCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): Command => ({
  type: 'UpdateCharacterSheet',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId,
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
    { name: 'Laser Carbine', quantity: 1, notes: 'Carried' },
    { name: 'Medkit', quantity: 1, notes: 'Stowed' }
  ],
  credits: 1200
})

export const startScoutCreationCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): Command => ({
  type: 'StartCharacterCreation',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId
})

const nextUnrolledScoutCharacteristic = (
  state: GameState
): CharacteristicKey | null => {
  const scout = state.characters[scoutCharacterId]
  if (!scout) return null

  for (const characteristic of bootstrapCharacteristicKeys) {
    if (scout.characteristics[characteristic] === null) return characteristic
  }

  return null
}

export const rollScoutCharacteristicCreationCommand = ({
  roomId,
  actorId,
  characteristic
}: BootstrapCommandContext & {
  characteristic: CharacteristicKey
}): GameCommand => ({
  type: 'RollCharacterCreationCharacteristic',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId,
  characteristic
})

export const completeScoutHomeworldCreationCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): GameCommand => ({
  type: 'CompleteCharacterCreationHomeworld',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId
})

export const startScoutCareerTermDevCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): Command => ({
  type: 'StartCharacterCareerTerm',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId,
  career: 'Scout'
})

export const resolveScoutCareerQualificationCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): GameCommand => ({
  type: 'ResolveCharacterCreationQualification',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId,
  career: 'Scout'
})

export const enterScoutDrifterCreationCommand = ({
  roomId,
  actorId
}: BootstrapCommandContext): GameCommand => ({
  type: 'EnterCharacterCreationDrifter',
  gameId: roomId,
  actorId,
  characterId: scoutCharacterId,
  option: 'Drifter'
})

export const createPieceCommand = (
  { roomId, actorId }: BootstrapCommandContext,
  boardId: BoardId
): Command => ({
  type: 'CreatePiece',
  gameId: roomId,
  actorId,
  pieceId: 'scout-1' as PieceId,
  boardId,
  name: 'Scout',
  characterId: scoutCharacterId,
  imageAssetId: null,
  x: 220,
  y: 180
})

export const uniqueBoardId = (
  state: Pick<GameState, 'boards'> | null | undefined,
  name: string
): BoardId => {
  const base = idFromName(name, 'board')
  let index = Object.keys(state?.boards || {}).length + 1
  let boardId = `${base}-${index}`
  while (state?.boards?.[boardId as BoardId]) {
    index += 1
    boardId = `${base}-${index}`
  }
  return boardId as BoardId
}

export const uniquePieceId = (
  state: Pick<GameState, 'pieces'> | null | undefined,
  name: string
): PieceId => {
  const base = idFromName(name, 'piece')
  let index = Object.keys(state?.pieces || {}).length + 1
  let pieceId = `${base}-${index}`
  while (state?.pieces?.[pieceId as PieceId]) {
    index += 1
    pieceId = `${base}-${index}`
  }
  return pieceId as PieceId
}

export const uniqueCharacterId = (
  state: Pick<GameState, 'characters'> | null | undefined,
  name: string
): CharacterId => {
  const base = idFromName(name, 'character')
  let index = Object.keys(state?.characters || {}).length + 1
  let characterId = `${base}-${index}`
  while (state?.characters?.[characterId as CharacterId]) {
    index += 1
    characterId = `${base}-${index}`
  }
  return characterId as CharacterId
}

export const parsePositiveIntegerValue = (
  value: string,
  fallback: number
): number => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const parsePositiveNumberValue = (
  value: string,
  fallback: number
): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const parseNonNegativeIntegerValue = (
  value: string,
  fallback: number
): number => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const nextBootstrapCommand = ({
  roomId,
  actorId,
  state
}: BootstrapFlowContext): GameCommand | null => {
  const commandContext = { roomId, actorId }
  if (!state) return createGameCommand(commandContext)
  const boardIds = Object.keys(state.boards || {}) as BoardId[]
  if (boardIds.length === 0) return createBoardCommand(commandContext)
  const scout = state.characters[scoutCharacterId]
  if (!scout) return createCharacterCommand(commandContext)
  if (!scout.creation) return startScoutCreationCommand(commandContext)
  if (scout.creation.state.status === 'CHARACTERISTICS') {
    const characteristic = nextUnrolledScoutCharacteristic(state)
    return characteristic
      ? rollScoutCharacteristicCreationCommand({
          ...commandContext,
          characteristic
        })
      : null
  }
  if (scout.creation.state.status === 'HOMEWORLD') {
    return completeScoutHomeworldCreationCommand(commandContext)
  }
  if (scout.creation.state.status === 'CAREER_SELECTION') {
    return scout.creation.failedToQualify
      ? enterScoutDrifterCreationCommand(commandContext)
      : resolveScoutCareerQualificationCommand(commandContext)
  }
  if ((scout.skills || []).length === 0) {
    return updateScoutSheetCommand(commandContext)
  }
  if (Object.keys(state.pieces || {}).length === 0) {
    return createPieceCommand(
      commandContext,
      state.selectedBoardId && state.boards[state.selectedBoardId]
        ? state.selectedBoardId
        : boardIds[0]
    )
  }
  return null
}
