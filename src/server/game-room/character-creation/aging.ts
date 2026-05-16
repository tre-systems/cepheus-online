import {
  deriveAgingRollModifier,
  resolveAging
} from '../../../shared/characterCreation'
import type { CepheusRuleset } from '../../../shared/character-creation/cepheus-srd-ruleset'
import type { GameEvent } from '../../../shared/events'
import type { CommandError } from '../../../shared/protocol'
import { err, ok, type Result } from '../../../shared/result'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../shared/state'
import {
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction
} from '../character-creation-command-helpers'
import { commandError } from '../command-helpers'

type CharacterCreationAgingResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationAgingResolved' }
>

export const validateAgingResolution = (
  character: CharacterState,
  ruleset: CepheusRuleset
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'AGING',
    'AGING'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['resolveAging'],
    'AGING is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

export const validateAgingLossResolution = (
  character: CharacterState,
  ruleset: CepheusRuleset
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  if (character.creation.characteristicChanges.length === 0) {
    return err(
      commandError('invalid_command', 'No pending aging losses to resolve')
    )
  }

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['resolveAging'],
    'AGING_LOSSES are blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

export const validateAnagathicsDecision = (
  character: CharacterState,
  ruleset: CepheusRuleset
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'AGING',
    'ANAGATHICS_DECISION'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['decideAnagathics'],
    'ANAGATHICS_DECISION is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const currentAgingAge = (
  character: CharacterState,
  creation: CharacterCreationProjection
): number | null => {
  if (character.age !== null) return character.age
  if (creation.terms.length === 0) return character.age

  return 18 + Math.max(0, creation.terms.length - 1) * 4
}

export const resolveAgingCreationEvent = ({
  character,
  creation,
  ruleset,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  ruleset: CepheusRuleset
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Pick<CharacterCreationAgingResolvedEvent, 'aging'> => {
  const modifier = deriveAgingRollModifier(creation.terms)
  const aging = resolveAging({
    currentAge: currentAgingAge(character, creation),
    table: ruleset.aging,
    roll: roll.total + modifier,
    years: 4
  })

  return {
    aging: {
      roll: {
        expression: roll.expression,
        rolls: [...roll.rolls],
        total: roll.total
      },
      modifier,
      age: aging.age,
      characteristicChanges: aging.characteristicChanges.map((change) => ({
        ...change
      }))
    }
  }
}
