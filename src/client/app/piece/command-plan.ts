import type { Command, GameCommand } from '../../../shared/commands'
import type { CharacterId, PieceId } from '../../../shared/ids'
import type { BoardState, GameState } from '../../../shared/state'
import type { ClientIdentity } from '../../game-commands.js'
import { uniqueCharacterId, uniquePieceId } from '../room/bootstrap-flow.js'

type CreateCharacterCommand = Extract<Command, { type: 'CreateCharacter' }>
type CreatePieceCommand = Extract<Command, { type: 'CreatePiece' }>

export interface CreatePieceCommandPlanInput {
  identity: ClientIdentity
  state: GameState | null
  board: BoardState | null
  name: string
  linkedCharacterId?: CharacterId | null
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

const planDefaultPieceCharacterCommands = ({
  identity,
  characterId,
  name
}: {
  identity: ClientIdentity
  characterId: CharacterId
  name: string
}): GameCommand[] => {
  const createCharacterCommand: CreateCharacterCommand = {
    type: 'CreateCharacter',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    characterType: 'NPC',
    name: name.trim()
  }

  return [createCharacterCommand]
}

export const planCreatePieceCommands = ({
  identity,
  state,
  board,
  name,
  linkedCharacterId = null,
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

  if (linkedCharacterId && !state.characters[linkedCharacterId]) {
    return {
      ok: false,
      error: 'Selected character is not available',
      focus: null
    }
  }

  const pieceId = uniquePieceId(state, trimmedName)
  const characterId = linkedCharacterId
    ? linkedCharacterId
    : withCharacterSheet
      ? uniqueCharacterId(state, trimmedName)
      : null
  const { x, y } = planPiecePlacement({
    board,
    width,
    height,
    scale,
    existingPieceCount
  })

  const characterCommands =
    characterId && !linkedCharacterId
      ? planDefaultPieceCharacterCommands({
          identity,
          characterId,
          name: trimmedName
        })
      : []

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
