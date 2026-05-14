import { createCareerCreationState } from '../../shared/characterCreation'
import type { GameCommand } from '../../shared/commands'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireGame
} from './command-helpers'

export const GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE =
  'AdvanceCharacterCreation is deprecated; use semantic character creation commands'

type CharacterCreationSetupCommand = Extract<
  GameCommand,
  { type: 'StartCharacterCreation' | 'AdvanceCharacterCreation' }
>

export const deriveCharacterCreationSetupEvents = (
  command: CharacterCreationSetupCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'StartCharacterCreation': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can start character creation'
        )
      }
      if (character.creation) {
        return err(
          commandError(
            'duplicate_entity',
            'Character creation has already started'
          )
        )
      }

      return ok([
        {
          type: 'CharacterCreationStarted',
          characterId: command.characterId,
          creation: {
            state: createCareerCreationState(),
            terms: [],
            careers: [],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ])
    }

    case 'AdvanceCharacterCreation': {
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
          commandError(
            'missing_entity',
            'Character creation has not been started'
          )
        )
      }
      return err(
        commandError(
          'invalid_command',
          GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE
        )
      )
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled character creation setup command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
