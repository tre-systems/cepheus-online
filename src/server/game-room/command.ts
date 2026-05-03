import type {Command} from '../../shared/commands'
import {rollDiceExpression} from '../../shared/dice'
import type {GameEvent} from '../../shared/events'
import {deriveEventRng} from '../../shared/prng'
import {err, ok, type Result} from '../../shared/result'
import type {GameState} from '../../shared/state'
import type {CommandError} from '../../shared/protocol'

export interface CommandContext {
  state: GameState | null
  currentSeq: number
  nextSeq: number
  gameSeed: number
}

const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

const requireGame = (state: GameState | null): Result<GameState, CommandError> =>
  state
    ? ok(state)
    : err(commandError('game_not_found', 'Game has not been created'))

const requireFinitePositive = (
  value: number,
  label: string
): Result<number, CommandError> => {
  if (!Number.isFinite(value) || value <= 0) {
    return err(commandError('invalid_command', `${label} must be positive`))
  }

  return ok(value)
}

const requireFiniteCoordinate = (
  value: number,
  label: string
): Result<number, CommandError> => {
  if (!Number.isFinite(value)) {
    return err(commandError('invalid_command', `${label} must be finite`))
  }

  return ok(value)
}

const requireFiniteOrNull = (
  value: number | null,
  label: string
): Result<number | null, CommandError> => {
  if (value !== null && !Number.isFinite(value)) {
    return err(commandError('invalid_command', `${label} must be finite`))
  }

  return ok(value)
}

const requireNonEmptyString = (
  value: string,
  label: string
): Result<string, CommandError> => {
  if (!value.trim()) {
    return err(commandError('invalid_command', `${label} cannot be empty`))
  }

  return ok(value)
}

const validateExpectedSeq = (
  command: Command,
  currentSeq: number
): Result<void, CommandError> => {
  if (!('expectedSeq' in command) || command.expectedSeq === undefined) {
    return ok(undefined)
  }

  if (command.expectedSeq !== currentSeq) {
    return err(
      commandError(
        'stale_command',
        `Expected sequence ${command.expectedSeq}, current sequence is ${currentSeq}`
      )
    )
  }

  return ok(undefined)
}

export const deriveEventsForCommand = (
  command: Command,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const expectedSeq = validateExpectedSeq(command, context.currentSeq)
  if (!expectedSeq.ok) return expectedSeq

  switch (command.type) {
    case 'CreateGame': {
      if (context.state) {
        return err(commandError('game_exists', 'Game already exists'))
      }

      return ok([
        {
          type: 'GameCreated',
          slug: command.slug,
          name: command.name,
          ownerId: command.actorId
        }
      ])
    }

    case 'CreateCharacter': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (state.value.characters[command.characterId]) {
        return err(commandError('duplicate_entity', 'Character already exists'))
      }

      return ok([
        {
          type: 'CharacterCreated',
          characterId: command.characterId,
          ownerId: command.actorId,
          characterType: command.characterType,
          name: command.name
        }
      ])
    }

    case 'UpdateCharacterSheet': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.characters[command.characterId]) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (command.age !== undefined) {
        const age = requireFiniteOrNull(command.age, 'age')
        if (!age.ok) return age
      }
      if (command.characteristics !== undefined) {
        for (const [key, value] of Object.entries(command.characteristics)) {
          const characteristic = requireFiniteOrNull(
            value,
            `characteristics.${key}`
          )
          if (!characteristic.ok) return characteristic
        }
      }
      if (command.skills !== undefined) {
        for (const [index, skill] of command.skills.entries()) {
          const value = requireNonEmptyString(skill, `skills[${index}]`)
          if (!value.ok) return value
        }
      }
      if (command.equipment !== undefined) {
        for (const [index, item] of command.equipment.entries()) {
          const name = requireNonEmptyString(
            item.name,
            `equipment[${index}].name`
          )
          if (!name.ok) return name
          const quantity = requireFiniteCoordinate(
            item.quantity,
            `equipment[${index}].quantity`
          )
          if (!quantity.ok) return quantity
        }
      }
      if (command.credits !== undefined) {
        const credits = requireFiniteCoordinate(command.credits, 'credits')
        if (!credits.ok) return credits
      }

      return ok([
        {
          type: 'CharacterSheetUpdated',
          characterId: command.characterId,
          ...(command.age === undefined ? {} : {age: command.age}),
          ...(command.characteristics === undefined
            ? {}
            : {characteristics: command.characteristics}),
          ...(command.skills === undefined ? {} : {skills: command.skills}),
          ...(command.equipment === undefined
            ? {}
            : {equipment: command.equipment}),
          ...(command.credits === undefined
            ? {}
            : {credits: command.credits})
        }
      ])
    }

    case 'CreateBoard': {
      const state = requireGame(context.state)
      if (!state.ok) return state
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

    case 'CreatePiece': {
      const state = requireGame(context.state)
      if (!state.ok) return state
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

      return ok([
        {
          type: 'PieceCreated',
          pieceId: command.pieceId,
          boardId: command.boardId,
          characterId: command.characterId ?? null,
          name: command.name,
          imageAssetId: command.imageAssetId ?? null,
          x: command.x,
          y: command.y
        }
      ])
    }

    case 'MovePiece': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
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

      return ok([
        {
          type: 'PieceFreedomChanged',
          pieceId: command.pieceId,
          freedom: command.freedom
        }
      ])
    }

    case 'RollDice': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const rolled = rollDiceExpression(
        command.expression,
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      return ok([
        {
          type: 'DiceRolled',
          expression: rolled.value.expression,
          reason: command.reason,
          total: rolled.value.total,
          rolls: rolled.value.rolls
        }
      ])
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled command ${(exhaustive as {type: string}).type}`
        )
      )
    }
  }
}
