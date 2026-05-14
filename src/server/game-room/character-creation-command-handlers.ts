import {
  createCareerCreationState,
  deriveCareerCreationComplete,
  transitionCareerCreationState
} from '../../shared/characterCreation'
import type { GameCommand } from '../../shared/commands'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import type {
  CharacterCreationProjection,
  CharacterCreationSheet,
  CharacterState
} from '../../shared/state'
import {
  loadCharacterCreationCommandContext,
  requireLegalCharacterCreationAction
} from './character-creation-command-helpers'
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireFiniteCoordinate,
  requireFiniteOrNull,
  requireGame,
  requireNonEmptyString
} from './command-helpers'

export const GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE =
  'AdvanceCharacterCreation is deprecated; use semantic character creation commands'

type CharacterCreationSetupCommand = Extract<
  GameCommand,
  { type: 'StartCharacterCreation' | 'AdvanceCharacterCreation' }
>

type CharacterCreationFinalizationCommand = Extract<
  GameCommand,
  { type: 'FinalizeCharacterCreation' | 'CompleteCharacterCreation' }
>

type CharacterCreationCommand =
  | CharacterCreationSetupCommand
  | CharacterCreationFinalizationCommand

const uniqueSkills = (skills: readonly string[]): string[] => {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const skill of skills) {
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(skill)
  }

  return unique
}

const derivedCreationNotes = (character: CharacterState): string => {
  const creation = character.creation
  if (!creation) return character.notes
  const notes = character.notes.trim() ? [character.notes.trim()] : []

  if (creation.history && creation.history.length > 0) {
    notes.push('Rules source: Cepheus Engine SRD.')
    for (const [index, term] of creation.terms.entries()) {
      const survival =
        creation.history.some((event) => event.type === 'SURVIVAL_FAILED') &&
        index === creation.terms.length - 1
          ? 'mishap'
          : 'survived'
      notes.push(`Term ${index + 1}: ${term.career}, ${survival}.`)
    }
  }

  return notes.join('\n')
}

const deriveCharacterCreationSheet = (
  character: CharacterState
): CharacterCreationSheet => {
  const creation = character.creation
  const creationSkills = uniqueSkills([
    ...(creation?.backgroundSkills ?? []),
    ...(creation?.terms.flatMap((term) => term.skillsAndTraining) ?? []),
    ...character.skills
  ])

  return {
    notes: derivedCreationNotes(character),
    age: character.age,
    characteristics: { ...character.characteristics },
    skills: creationSkills,
    equipment: character.equipment.map((item) => ({ ...item })),
    credits: character.credits
  }
}

const validateCharacterCreationSheet = (
  sheet: CharacterCreationSheet
): Result<void, CommandError> => {
  if (typeof sheet.notes !== 'string') {
    return err(commandError('invalid_command', 'notes must be a string'))
  }
  const age = requireFiniteOrNull(sheet.age, 'age')
  if (!age.ok) return age

  for (const [key, value] of Object.entries(sheet.characteristics)) {
    const characteristic = requireFiniteOrNull(value, `characteristics.${key}`)
    if (!characteristic.ok) return characteristic
  }

  for (const [index, skill] of sheet.skills.entries()) {
    const value = requireNonEmptyString(skill, `skills[${index}]`)
    if (!value.ok) return value
  }

  for (const [index, item] of sheet.equipment.entries()) {
    const name = requireNonEmptyString(item.name, `equipment[${index}].name`)
    if (!name.ok) return name
    const quantity = requireFiniteCoordinate(
      item.quantity,
      `equipment[${index}].quantity`
    )
    if (!quantity.ok) return quantity
  }

  const credits = requireFiniteCoordinate(sheet.credits, 'credits')
  if (!credits.ok) return credits

  return ok(undefined)
}

const validateCreationCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['completeCreation'],
    'CREATION_COMPLETE is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const deriveCompletionEvents = (
  characterId: CharacterCreationFinalizationCommand['characterId'],
  character: CharacterState
): Result<GameEvent[], CommandError> => {
  const creation = validateCreationCompletion(character)
  if (!creation.ok) return creation

  const nextState = transitionCareerCreationState(creation.value.state, {
    type: 'CREATION_COMPLETE'
  })
  const serverSheet = deriveCharacterCreationSheet(character)
  const sheet = validateCharacterCreationSheet(serverSheet)
  if (!sheet.ok) return sheet

  return ok([
    {
      type: 'CharacterCreationCompleted',
      characterId,
      state: nextState,
      creationComplete: deriveCareerCreationComplete(nextState)
    },
    {
      type: 'CharacterCreationFinalized',
      characterId,
      ...serverSheet
    }
  ])
}

export const deriveCharacterCreationCommandEvents = (
  command: CharacterCreationCommand,
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
          `Unhandled character creation command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
