import type { Command } from '../../shared/commands'
import type { CharacterId, PieceId } from '../../shared/ids'
import type { BoardState, GameState } from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'
import { uniqueCharacterId, uniquePieceId } from './bootstrap-flow.js'
import {
  createCharacterCreationFlow,
  deriveCharacterCreationCommands
} from './character-creation-flow.js'

export interface CreatePieceCommandPlanInput {
  identity: ClientIdentity
  state: GameState | null
  board: BoardState | null
  name: string
  imageAssetId: string | null
  width: number
  height: number
  scale: number
  existingPieceCount: number
  withCharacterSheet: boolean
}

export type CreatePieceCommandPlan =
  | {
      ok: true
      commands: Command[]
      pieceId: PieceId
      characterId: CharacterId | null
    }
  | {
      ok: false
      error: string
      focus: 'name' | null
    }

const sequenceCommandAt = <T extends Command>(
  command: T,
  state: Pick<GameState, 'eventSeq'>,
  offset: number
): T => {
  if (command.expectedSeq !== undefined || command.type === 'CreateGame') {
    return command
  }

  return {
    ...command,
    expectedSeq: state.eventSeq + offset
  }
}

export const createDefaultPieceCharacterCreationFlow = (
  characterId: CharacterId,
  name: string
) => ({
  ...createCharacterCreationFlow(characterId, {
    name,
    age: 30,
    characteristics: {
      str: 7,
      dex: 7,
      end: 7,
      int: 7,
      edu: 7,
      soc: 7
    },
    skills: ['Athletics-0', 'Gun Combat-0'],
    equipment: [],
    credits: 0
  }),
  step: 'review' as const
})

export const planCreatePieceCommands = ({
  identity,
  state,
  board,
  name,
  imageAssetId,
  width,
  height,
  scale,
  existingPieceCount,
  withCharacterSheet
}: CreatePieceCommandPlanInput): CreatePieceCommandPlan => {
  if (!state || !board) {
    return {
      ok: false,
      error: 'Bootstrap a board before creating a piece',
      focus: null
    }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return {
      ok: false,
      error: 'Piece name is required',
      focus: 'name'
    }
  }

  const pieceId = uniquePieceId(state, trimmedName)
  const characterId = withCharacterSheet
    ? uniqueCharacterId(state, trimmedName)
    : null
  const x = Math.max(
    0,
    Math.min(board.width - width * scale, 160 + (existingPieceCount % 8) * 58)
  )
  const y = Math.max(
    0,
    Math.min(
      board.height - height * scale,
      140 + Math.floor(existingPieceCount / 8) * 58
    )
  )

  const characterCommands = characterId
    ? deriveCharacterCreationCommands(
        createDefaultPieceCharacterCreationFlow(characterId, trimmedName),
        { identity, state }
      )
    : []

  if (characterId && characterCommands.length === 0) {
    return {
      ok: false,
      error: 'Character creation needs the current room state',
      focus: null
    }
  }

  const createPieceCommand = sequenceCommandAt(
    {
      type: 'CreatePiece',
      gameId: identity.gameId,
      actorId: identity.actorId,
      pieceId,
      boardId: board.id,
      name: trimmedName,
      characterId,
      imageAssetId,
      x,
      y,
      width,
      height,
      scale
    },
    state,
    characterCommands.length
  )

  return {
    ok: true,
    commands: [...characterCommands, createPieceCommand],
    pieceId,
    characterId
  }
}
