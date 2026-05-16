import type { Command, GameCommand } from '../../shared/commands'
import type { CepheusSrdRuleset } from '../../shared/character-creation/cepheus-srd-ruleset'
import type { PieceId } from '../../shared/ids'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import type { CharacterState, GameState } from '../../shared/state'

export interface CommandContext {
  state: GameState | null
  currentSeq: number
  nextSeq: number
  gameSeed: number
  ruleset: CepheusSrdRuleset
  createdAt?: string
}

export const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

export const notAllowed = (message: string): Result<never, CommandError> =>
  err(commandError('not_allowed', message))

export const requireGame = (
  state: GameState | null
): Result<GameState, CommandError> =>
  state
    ? ok(state)
    : err(commandError('game_not_found', 'Game has not been created'))

export const requireFinitePositive = (
  value: number,
  label: string
): Result<number, CommandError> => {
  if (!Number.isFinite(value) || value <= 0) {
    return err(commandError('invalid_command', `${label} must be positive`))
  }

  return ok(value)
}

export const requireFiniteCoordinate = (
  value: number,
  label: string
): Result<number, CommandError> => {
  if (!Number.isFinite(value)) {
    return err(commandError('invalid_command', `${label} must be finite`))
  }

  return ok(value)
}

export const requireFiniteOrNull = (
  value: number | null,
  label: string
): Result<number | null, CommandError> => {
  if (value !== null && !Number.isFinite(value)) {
    return err(commandError('invalid_command', `${label} must be finite`))
  }

  return ok(value)
}

export const requireNonEmptyString = (
  value: string,
  label: string
): Result<string, CommandError> => {
  if (!value.trim()) {
    return err(commandError('invalid_command', `${label} cannot be empty`))
  }

  return ok(value)
}

export const isReferee = (
  state: GameState,
  actorId: Command['actorId']
): boolean =>
  state.ownerId === actorId || state.players[actorId]?.role === 'REFEREE'

export const canMutateCharacter = (
  state: GameState,
  character: CharacterState,
  actorId: Command['actorId']
): boolean =>
  isReferee(state, actorId) ||
  character.ownerId === null ||
  character.ownerId === actorId

export const canMutatePiece = (
  state: GameState,
  pieceId: PieceId,
  actorId: Command['actorId']
): boolean => {
  if (isReferee(state, actorId)) return true
  const piece = state.pieces[pieceId]
  if (!piece) return false
  if (piece.freedom === 'SHARE') return true
  if (!piece.characterId) return piece.freedom !== 'LOCKED'

  const character = state.characters[piece.characterId]
  return Boolean(character && canMutateCharacter(state, character, actorId))
}

export const validateExpectedSeq = (
  command: GameCommand,
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
