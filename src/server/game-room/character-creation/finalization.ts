import {
  deriveCareerCreationComplete,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import type { GameEvent } from '../../../shared/events'
import type { CharacterId } from '../../../shared/ids'
import type { CommandError } from '../../../shared/protocol'
import { err, ok, type Result } from '../../../shared/result'
import type {
  CharacterCreationProjection,
  CharacterCreationSheet,
  CharacterState
} from '../../../shared/state'
import { requireLegalCharacterCreationAction } from '../character-creation-command-helpers'
import {
  commandError,
  requireFiniteCoordinate,
  requireFiniteOrNull,
  requireNonEmptyString
} from '../command-helpers'
import { uniqueSkills } from './utils'

const deriveTermSurvivalSummary = (
  term: CharacterCreationProjection['terms'][number]
): 'survived' | 'mishap' => {
  if (term.facts?.survival) {
    return term.facts.survival.passed ? 'survived' : 'mishap'
  }

  return term.survival !== undefined && !term.complete && !term.musteringOut
    ? 'mishap'
    : 'survived'
}

const derivedCreationNotes = (character: CharacterState): string => {
  const creation = character.creation
  if (!creation) return character.notes
  const notes = character.notes.trim() ? [character.notes.trim()] : []

  if (creation.terms.length > 0) {
    notes.push('Rules source: Cepheus Engine SRD.')
    for (const [index, term] of creation.terms.entries()) {
      const survival = deriveTermSurvivalSummary(term)
      notes.push(`Term ${index + 1}: ${term.career}, ${survival}.`)
    }
  }

  return notes.join('\n')
}

const hasSemanticTermFacts = (
  term: CharacterCreationProjection['terms'][number]
): boolean => Object.keys(term.facts ?? {}).length > 0

const deriveTermSkillsFromFacts = (
  term: CharacterCreationProjection['terms'][number]
): string[] => [
  ...(term.facts?.basicTrainingSkills ?? []),
  ...(term.facts?.termSkillRolls ?? []).flatMap((termSkill) =>
    termSkill.skill ? [termSkill.skill] : []
  )
]

const deriveTermCreationSkills = (
  term: CharacterCreationProjection['terms'][number]
): string[] => {
  const factSkills = deriveTermSkillsFromFacts(term)
  if (hasSemanticTermFacts(term) && factSkills.length > 0) {
    return factSkills
  }

  return term.skillsAndTraining
}

const deriveCharacterCreationSheet = (
  character: CharacterState
): CharacterCreationSheet => {
  const creation = character.creation
  const creationSkills = uniqueSkills([
    ...(creation?.backgroundSkills ?? []),
    ...(creation?.terms.flatMap(deriveTermCreationSkills) ?? []),
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

export const deriveCompletionEvents = (
  characterId: CharacterId,
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
