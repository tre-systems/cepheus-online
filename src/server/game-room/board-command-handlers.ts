import type { GameCommand } from '../../shared/commands'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import {
  canMutatePiece,
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireFiniteCoordinate,
  requireFinitePositive,
  requireGame,
  requireNonEmptyString
} from './command-helpers'

type BoardCommand = Extract<
  GameCommand,
  {
    type:
      | 'CreateBoard'
      | 'SelectBoard'
      | 'SetDoorOpen'
      | 'CreatePiece'
      | 'MovePiece'
      | 'SetPieceVisibility'
      | 'SetPieceFreedom'
  }
>

export const deriveBoardCommandEvents = (
  command: BoardCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'CreateBoard': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can create boards')
      }
      if (state.value.boards[command.boardId]) {
        return err(commandError('duplicate_entity', 'Board already exists'))
      }
      const width = requireFinitePositive(command.width, 'width')
      if (!width.ok) return width
      const height = requireFinitePositive(command.height, 'height')
      if (!height.ok) return height
      const scale = requireFinitePositive(command.scale, 'scale')
      if (!scale.ok) return scale

      return ok([
        {
          type: 'BoardCreated',
          boardId: command.boardId,
          name: command.name,
          imageAssetId: command.imageAssetId ?? null,
          url: command.url ?? null,
          width: command.width,
          height: command.height,
          scale: command.scale
        }
      ])
    }

    case 'SelectBoard': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can select the active board')
      }
      if (!state.value.boards[command.boardId]) {
        return err(commandError('missing_entity', 'Board does not exist'))
      }

      return ok([
        {
          type: 'BoardSelected',
          boardId: command.boardId
        }
      ])
    }

    case 'SetDoorOpen': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can open or close map doors')
      }
      if (!state.value.boards[command.boardId]) {
        return err(commandError('missing_entity', 'Board does not exist'))
      }
      const doorId = requireNonEmptyString(command.doorId, 'doorId')
      if (!doorId.ok) return doorId

      return ok([
        {
          type: 'DoorStateChanged',
          boardId: command.boardId,
          doorId: doorId.value,
          open: command.open
        }
      ])
    }

    case 'CreatePiece': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can create pieces')
      }
      if (!state.value.boards[command.boardId]) {
        return err(commandError('missing_entity', 'Board does not exist'))
      }
      if (
        command.characterId !== undefined &&
        command.characterId !== null &&
        !state.value.characters[command.characterId]
      ) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (state.value.pieces[command.pieceId]) {
        return err(commandError('duplicate_entity', 'Piece already exists'))
      }
      const x = requireFiniteCoordinate(command.x, 'x')
      if (!x.ok) return x
      const y = requireFiniteCoordinate(command.y, 'y')
      if (!y.ok) return y
      if (command.width !== undefined) {
        const width = requireFinitePositive(command.width, 'width')
        if (!width.ok) return width
      }
      if (command.height !== undefined) {
        const height = requireFinitePositive(command.height, 'height')
        if (!height.ok) return height
      }
      if (command.scale !== undefined) {
        const scale = requireFinitePositive(command.scale, 'scale')
        if (!scale.ok) return scale
      }

      return ok([
        {
          type: 'PieceCreated',
          pieceId: command.pieceId,
          boardId: command.boardId,
          characterId: command.characterId ?? null,
          name: command.name,
          imageAssetId: command.imageAssetId ?? null,
          x: command.x,
          y: command.y,
          ...(command.width === undefined ? {} : { width: command.width }),
          ...(command.height === undefined ? {} : { height: command.height }),
          ...(command.scale === undefined ? {} : { scale: command.scale })
        }
      ])
    }

    case 'MovePiece': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
      }
      if (!canMutatePiece(state.value, command.pieceId, command.actorId)) {
        return notAllowed('Only a controller or referee can move this piece')
      }
      const x = requireFiniteCoordinate(command.x, 'x')
      if (!x.ok) return x
      const y = requireFiniteCoordinate(command.y, 'y')
      if (!y.ok) return y

      return ok([
        {
          type: 'PieceMoved',
          pieceId: command.pieceId,
          x: command.x,
          y: command.y
        }
      ])
    }

    case 'SetPieceVisibility': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
      }
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can change piece visibility')
      }

      return ok([
        {
          type: 'PieceVisibilityChanged',
          pieceId: command.pieceId,
          visibility: command.visibility
        }
      ])
    }

    case 'SetPieceFreedom': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
      }
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can change piece control')
      }

      return ok([
        {
          type: 'PieceFreedomChanged',
          pieceId: command.pieceId,
          freedom: command.freedom
        }
      ])
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled board command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
