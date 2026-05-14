import {
  careerSkillWithLevel,
  deriveTotalBackgroundSkillAllowance,
  hasBackgroundHomeworld,
  isCascadeCareerSkill,
  normalizeCareerSkill
} from '../../../shared/characterCreation'
import type { CommandError } from '../../../shared/protocol'
import { err, ok, type Result } from '../../../shared/result'
import type {
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  CharacterState
} from '../../../shared/state'
import {
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction
} from '../character-creation-command-helpers'
import { commandError, notAllowed } from '../command-helpers'

export const normalizeHomeworld = (
  homeworld: CharacterCreationHomeworld
): Result<CharacterCreationHomeworld, CommandError> => {
  if (homeworld.name !== null && typeof homeworld.name !== 'string') {
    return err(
      commandError('invalid_command', 'homeworld.name must be a string')
    )
  }
  if (typeof homeworld.lawLevel !== 'string') {
    return err(
      commandError('invalid_command', 'homeworld.lawLevel must be a string')
    )
  }
  if (!Array.isArray(homeworld.tradeCodes)) {
    return err(
      commandError('invalid_command', 'homeworld.tradeCodes must be an array')
    )
  }

  const name = homeworld.name?.trim() || null
  const lawLevel = homeworld.lawLevel.trim() || null
  const tradeCodes: string[] = []
  const seen = new Set<string>()

  for (const rawTradeCode of homeworld.tradeCodes) {
    if (typeof rawTradeCode !== 'string') {
      return err(
        commandError('invalid_command', 'homeworld.tradeCodes must be strings')
      )
    }
    const tradeCode = rawTradeCode.trim()
    const key = tradeCode.toLowerCase()
    if (!tradeCode || seen.has(key)) continue
    tradeCodes.push(tradeCode)
    seen.add(key)
  }

  if (!lawLevel) {
    return err(
      commandError('invalid_command', 'Homeworld law level is required')
    )
  }
  if (tradeCodes.length === 0) {
    return err(
      commandError('invalid_command', 'Homeworld trade code is required')
    )
  }

  return ok({ name, lawLevel, tradeCodes })
}

export const backgroundSelectionCount = (
  creation: CharacterCreationProjection
): number =>
  (creation.backgroundSkills ?? []).length +
  (creation.pendingCascadeSkills ?? []).length

export const requiredBackgroundSelectionCount = (
  character: CharacterState
): number =>
  hasBackgroundHomeworld(character.creation?.homeworld)
    ? deriveTotalBackgroundSkillAllowance(character.characteristics.edu)
    : 0

export const backgroundSkillAllowance = (character: CharacterState): number =>
  deriveTotalBackgroundSkillAllowance(character.characteristics.edu)

const hasCompleteBackgroundChoices = (character: CharacterState): boolean => {
  const creation = character.creation
  if (!creation?.homeworld || !hasBackgroundHomeworld(creation.homeworld)) {
    return false
  }

  return (
    (creation.pendingCascadeSkills ?? []).length === 0 &&
    backgroundSelectionCount(creation) >=
      requiredBackgroundSelectionCount(character)
  )
}

export const requireHomeworldCreation = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  if (character.creation.state.status !== 'HOMEWORLD') {
    return notAllowed(
      `Background choices cannot change from ${character.creation.state.status}`
    )
  }
  if (!character.creation.homeworld) {
    return notAllowed('Homeworld must be set before background choices')
  }

  return ok(character.creation)
}

export const normalizeBackgroundSkill = (
  skill: string
): Result<string, CommandError> => {
  const trimmed = skill.trim()
  if (!trimmed) {
    return err(commandError('invalid_command', 'skill cannot be empty'))
  }

  const normalized = isCascadeCareerSkill(trimmed)
    ? careerSkillWithLevel(trimmed, 0)
    : normalizeCareerSkill(trimmed, 0)
  if (!normalized) {
    return err(commandError('invalid_command', 'skill is not valid'))
  }

  return ok(normalized)
}

export const validateHomeworldCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'HOMEWORLD',
    'COMPLETE_HOMEWORLD'
  )
  if (!status.ok) return status

  if (!hasCompleteBackgroundChoices(character)) {
    return err(
      commandError(
        'invalid_command',
        'Background choices must be complete before career selection'
      )
    )
  }

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['completeHomeworld'],
    'COMPLETE_HOMEWORLD is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}
