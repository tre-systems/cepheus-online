import type { Command, GameCommand } from '../../shared/commands'
import type { CharacterId, PieceId } from '../../shared/ids'
import type { BoardState, GameState } from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'
import { uniqueCharacterId, uniquePieceId } from './bootstrap-flow.js'
import {
  createCharacterCreationFlow,
  deriveCharacterCreationCommands,
  selectCharacterCreationCareerPlan
} from './character-creation-flow.js'

type CreatePieceCommand = Extract<Command, { type: 'CreatePiece' }>

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

export interface CreateCharacterTokenCommandPlanInput {
  identity: ClientIdentity
  state: GameState | null
  board: BoardState | null
  characterId: CharacterId
  name: string
  existingPieceCount: number
}

export type CreatePieceCommandPlan =
  | {
      ok: true
      commands: GameCommand[]
      pieceId: PieceId
      characterId: CharacterId | null
    }
  | {
      ok: false
      error: string
      focus: 'name' | null
    }

export type CreateCharacterTokenCommandPlan =
  | {
      ok: true
      command: CreatePieceCommand
      pieceId: PieceId
    }
  | {
      ok: false
      error: string
    }

const planPiecePlacement = ({
  board,
  width,
  height,
  scale,
  existingPieceCount
}: {
  board: BoardState
  width: number
  height: number
  scale: number
  existingPieceCount: number
}): { x: number; y: number } => ({
  x: Math.max(
    0,
    Math.min(board.width - width * scale, 160 + (existingPieceCount % 8) * 58)
  ),
  y: Math.max(
    0,
    Math.min(
      board.height - height * scale,
      140 + Math.floor(existingPieceCount / 8) * 58
    )
  )
})

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
    homeworld: {
      lawLevel: 'Low Law',
      tradeCodes: ['Industrial']
    },
    backgroundSkills: ['Broker-0', 'Slug Pistol-0', 'Admin-0'],
    pendingCascadeSkills: [],
    careerPlan: selectCharacterCreationCareerPlan('Scout'),
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
  const { x, y } = planPiecePlacement({
    board,
    width,
    height,
    scale,
    existingPieceCount
  })

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

  const createPieceCommand: Command = {
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
  }

  return {
    ok: true,
    commands: [...characterCommands, createPieceCommand],
    pieceId,
    characterId
  }
}

export const planCreateCharacterTokenCommand = ({
  identity,
  state,
  board,
  characterId,
  name,
  existingPieceCount
}: CreateCharacterTokenCommandPlanInput): CreateCharacterTokenCommandPlan => {
  if (!state || !board) {
    return {
      ok: false,
      error: 'Bootstrap a board before creating a character token'
    }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return {
      ok: false,
      error: 'Character token name is required'
    }
  }

  const width = 50
  const height = 50
  const scale = 1
  const pieceId = uniquePieceId(state, trimmedName)
  const { x, y } = planPiecePlacement({
    board,
    width,
    height,
    scale,
    existingPieceCount
  })

  return {
    ok: true,
    pieceId,
    command: {
      type: 'CreatePiece',
      gameId: identity.gameId,
      actorId: identity.actorId,
      pieceId,
      boardId: board.id,
      name: trimmedName,
      characterId,
      imageAssetId: null,
      x,
      y,
      width,
      height,
      scale
    }
  }
}
