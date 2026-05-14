import {
  createCareerCreationState,
  deriveCareerCreationComplete,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import type { GameCommand } from '../../../shared/commands'
import { rollDiceExpression } from '../../../shared/dice'
import type { GameEvent } from '../../../shared/events'
import type { EventId } from '../../../shared/ids'
import { deriveEventRng } from '../../../shared/prng'
import type { CommandError } from '../../../shared/protocol'
import { err, ok, type Result } from '../../../shared/result'
import { loadCharacterCreationCommandContext } from '../character-creation-command-helpers'
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  notAllowed,
  requireGame
} from '../command-helpers'
import { deriveCompletionEvents } from './finalization'

type CharacterCreationSetupCommand = Extract<
  GameCommand,
  { type: 'StartCharacterCreation' | 'RollCharacterCreationCharacteristic' }
>

type CharacterCreationFinalizationCommand = Extract<
  GameCommand,
  { type: 'FinalizeCharacterCreation' | 'CompleteCharacterCreation' }
>

export const deriveCreationSetupCommandEvents = (
  command: CharacterCreationSetupCommand,
  context: CommandContext,
  rollEventId: EventId
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
            timeline: [],
            history: []
          }
        }
      ])
    }

    case 'RollCharacterCreationCharacteristic': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { state, character } = loaded.value
      if (!canMutateCharacter(state, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can roll character creation'
        )
      }
      if (character.creation.state.status !== 'CHARACTERISTICS') {
        return err(
          commandError(
            'invalid_command',
            `CHARACTERISTIC_ROLL is not valid from ${character.creation.state.status}`
          )
        )
      }
      if (character.characteristics[command.characteristic] !== null) {
        return err(
          commandError(
            'invalid_command',
            `${command.characteristic.toUpperCase()} has already been rolled`
          )
        )
      }

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const characteristics = {
        ...character.characteristics,
        [command.characteristic]: rolled.value.total
      }
      const complete = Object.values(characteristics).every(
        (value) => value !== null
      )
      const nextState = complete
        ? transitionCareerCreationState(character.creation.state, {
            type: 'SET_CHARACTERISTICS'
          })
        : character.creation.state
      const events: GameEvent[] = [
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${command.characteristic.toUpperCase()} characteristic`,
          rolls: [...rolled.value.rolls],
          total: rolled.value.total
        },
        {
          type: 'CharacterCreationCharacteristicRolled',
          characterId: command.characterId,
          rollEventId,
          characteristic: command.characteristic,
          value: rolled.value.total,
          characteristicsComplete: complete,
          state: nextState,
          creationComplete: complete && deriveCareerCreationComplete(nextState)
        }
      ]

      if (complete) {
        events.push({
          type: 'CharacterCreationCharacteristicsCompleted',
          characterId: command.characterId,
          rollEventId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        })
      }

      return ok(events)
    }
  }
}

export const deriveCreationFinalizationCommandEvents = (
  command: CharacterCreationFinalizationCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'FinalizeCharacterCreation': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!character.creation) {
        return err(
          commandError(
            'missing_entity',
            'Character creation has not been started'
          )
        )
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can finalize character creation'
        )
      }

      return deriveCompletionEvents(command.characterId, character)
    }

    case 'CompleteCharacterCreation': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { state, character } = loaded.value
      if (!canMutateCharacter(state, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can complete character creation'
        )
      }

      return deriveCompletionEvents(command.characterId, character)
    }
  }
}
