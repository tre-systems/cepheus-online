import type { GameCommand } from '../../shared/commands'
import {
  isDeprecatedGameCommand,
  metadataForCommand
} from '../../shared/command-metadata'
import type { GameEvent } from '../../shared/events'
import { err, type Result } from '../../shared/result'
import type { CommandError } from '../../shared/protocol'
import { deriveBoardCommandEvents } from './board-command-handlers'
import { deriveCharacterCommandEvents } from './character-command-handlers'
import { deriveCharacterCreationCommandEvents } from './character-creation-command-handlers'
import {
  canMutateCharacter,
  commandError,
  notAllowed,
  type CommandContext,
  validateExpectedSeq
} from './command-helpers'
import { deriveDiceCommandEvents } from './dice-command-handlers'
import { deriveGameCommandEvents } from './game-command-handlers'
import { deriveNoteCommandEvents } from './note-command-handlers'

export type { CommandContext } from './command-helpers'

type BoardCommand = Parameters<typeof deriveBoardCommandEvents>[0]
type CharacterCommand = Parameters<typeof deriveCharacterCommandEvents>[0]
type CharacterCreationCommand = Parameters<
  typeof deriveCharacterCreationCommandEvents
>[0]
type DiceCommand = Parameters<typeof deriveDiceCommandEvents>[0]
type GameOnlyCommand = Parameters<typeof deriveGameCommandEvents>[0]
type NoteCommand = Parameters<typeof deriveNoteCommandEvents>[0]

export const deriveEventsForCommand = (
  command: GameCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const expectedSeq = validateExpectedSeq(command, context.currentSeq)
  if (!expectedSeq.ok) return expectedSeq
  if (
    context.state &&
    'characterId' in command &&
    command.type !== 'CreateCharacter' &&
    command.characterId !== null &&
    command.characterId !== undefined
  ) {
    const character = context.state.characters[command.characterId]
    if (
      character &&
      !canMutateCharacter(context.state, character, command.actorId)
    ) {
      return notAllowed(
        'Only the character owner or referee can change this character'
      )
    }
  }

  if (isDeprecatedGameCommand(command)) {
    return deriveCharacterCreationCommandEvents(command, context)
  }

  const handlerDomain = metadataForCommand(command).handlerDomain

  switch (handlerDomain) {
    case 'game':
      return deriveGameCommandEvents(command as GameOnlyCommand, context)
    case 'character':
      return deriveCharacterCommandEvents(command as CharacterCommand, context)
    case 'characterCreation':
      return deriveCharacterCreationCommandEvents(
        command as CharacterCreationCommand,
        context
      )
    case 'board':
      return deriveBoardCommandEvents(command as BoardCommand, context)
    case 'note':
      return deriveNoteCommandEvents(command as NoteCommand, context)
    case 'dice':
      return deriveDiceCommandEvents(command as DiceCommand, context)
    default: {
      const exhaustive: never = handlerDomain
      return err(
        commandError(
          'invalid_command',
          `Unhandled command domain ${exhaustive}`
        )
      )
    }
  }
}
