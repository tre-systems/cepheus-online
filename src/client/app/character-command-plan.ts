import type { Command } from '../../shared/commands'
import type { CharacterId, PieceId } from '../../shared/ids'
import type {
  BoardState,
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacterType,
  GameState
} from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'
import { uniqueCharacterId, uniquePieceId } from './bootstrap-flow.js'
import {
  createCharacterCreationFlow,
  deriveCharacterCreationCommands
} from './character-creation-flow.js'

export interface CreateCharacterCommandPlanInput {
  identity: ClientIdentity
  state: GameState | null
  board: BoardState | null
  name: string
  characterType: CharacterType
  age: number | null
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
  notes: string
  createLinkedPiece: boolean
  existingPieceCount: number
}

export type CreateCharacterCommandPlan =
  | {
      ok: true
      commands: Command[]
      characterId: CharacterId
      pieceId: PieceId | null
    }
  | {
      ok: false
      error: string
      focus: 'name' | 'skills' | null
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

const playableCreationCommands = (
  identity: ClientIdentity,
  characterId: CharacterId
): Command[] => [
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'COMPLETE_BASIC_TRAINING' }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: {
      type: 'SURVIVAL_PASSED',
      canCommission: false,
      canAdvance: true
    }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'COMPLETE_ADVANCEMENT' }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'COMPLETE_SKILLS' }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'COMPLETE_AGING' }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'LEAVE_CAREER' }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'FINISH_MUSTERING' }
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent: { type: 'CREATION_COMPLETE' }
  }
]

export const planCreatePlayableCharacterCommands = ({
  identity,
  state,
  board,
  name,
  characterType,
  age,
  characteristics,
  skills,
  equipment,
  credits,
  notes,
  createLinkedPiece,
  existingPieceCount
}: CreateCharacterCommandPlanInput): CreateCharacterCommandPlan => {
  if (!state) {
    return {
      ok: false,
      error: 'Open or create a room before creating a character',
      focus: null
    }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return {
      ok: false,
      error: 'Character name is required',
      focus: 'name'
    }
  }
  if (skills.length === 0) {
    return {
      ok: false,
      error: 'At least one skill is required',
      focus: 'skills'
    }
  }

  const characterId = uniqueCharacterId(state, trimmedName)
  const initialCommands = deriveCharacterCreationCommands(
    {
      ...createCharacterCreationFlow(characterId, {
        name: trimmedName,
        characterType,
        age,
        characteristics,
        skills,
        equipment,
        credits,
        notes
      }),
      step: 'review'
    },
    { identity, state }
  )
  if (initialCommands.length === 0) {
    return {
      ok: false,
      error: 'Character details are incomplete',
      focus: null
    }
  }

  const finishCommands = playableCreationCommands(identity, characterId).map(
    (command, index) =>
      sequenceCommandAt(command, state, initialCommands.length + index)
  )

  const pieceId =
    createLinkedPiece && board ? uniquePieceId(state, trimmedName) : null
  const pieceCommand =
    pieceId && board
      ? [
          sequenceCommandAt(
            {
              type: 'CreatePiece',
              gameId: identity.gameId,
              actorId: identity.actorId,
              pieceId,
              boardId: board.id,
              characterId,
              name: trimmedName,
              imageAssetId: null,
              x: Math.max(
                0,
                Math.min(board.width - 50, 160 + (existingPieceCount % 8) * 58)
              ),
              y: Math.max(
                0,
                Math.min(
                  board.height - 50,
                  140 + Math.floor(existingPieceCount / 8) * 58
                )
              ),
              width: 50,
              height: 50,
              scale: 1
            },
            state,
            initialCommands.length + finishCommands.length
          )
        ]
      : []

  return {
    ok: true,
    commands: [...initialCommands, ...finishCommands, ...pieceCommand],
    characterId,
    pieceId
  }
}
