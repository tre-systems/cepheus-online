import type { GameCommand } from '../../../shared/commands'
import type { GameEvent } from '../../../shared/events'
import type { CommandError } from '../../../shared/protocol'
import { err, type Result } from '../../../shared/result'
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireGame
} from '../command-helpers'

export const GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE =
  'AdvanceCharacterCreation is deprecated; use semantic character creation commands'

type DeprecatedCharacterCreationCommand = Extract<
  GameCommand,
  { type: 'AdvanceCharacterCreation' }
>

export const deriveDeprecatedCharacterCreationCommandEvents = (
  command: DeprecatedCharacterCreationCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const state = requireGame(context.state)
  if (!state.ok) return state
  const character = state.value.characters[command.characterId]
  if (!character) {
    return err(commandError('missing_entity', 'Character does not exist'))
  }
  if (!canMutateCharacter(state.value, character, command.actorId)) {
    return notAllowed(
      'Only the character owner or referee can advance character creation'
    )
  }
  if (!isReferee(state.value, command.actorId)) {
    return notAllowed(
      'Only the referee can use generic character creation advance'
    )
  }
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }

  return err(
    commandError(
      'invalid_command',
      GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE
    )
  )
}
