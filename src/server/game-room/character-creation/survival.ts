import {
  deriveCareerCreationComplete,
  deriveSurvivalPromotionOptions,
  evaluateCareerCheck,
  type InjuryResolutionMethod,
  resolveInjuryLosses,
  resolveInjuryOutcome,
  resolveSurvivalMishapOutcome,
  type SurvivalMishapInjuryRequirement,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import type { CepheusRuleset } from '../../../shared/character-creation/cepheus-srd-ruleset'
import type { GameCommand } from '../../../shared/commands'
import { rollDiceExpression } from '../../../shared/dice'
import type { GameEvent } from '../../../shared/events'
import type { EventId } from '../../../shared/ids'
import { deriveEventRng } from '../../../shared/prng'
import type { CommandError } from '../../../shared/protocol'
import { err, ok, type Result } from '../../../shared/result'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../shared/state'
import {
  loadCharacterCreationCommandContext,
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction
} from '../character-creation-command-helpers'
import { commandError, type CommandContext } from '../command-helpers'
import { deriveProjectedCareerRank } from './utils'

type CharacterCreationSurvivalCommand = Extract<
  GameCommand,
  {
    type:
      | 'ConfirmCharacterCreationDeath'
      | 'ResolveCharacterCreationInjury'
      | 'ResolveCharacterCreationMishap'
      | 'ResolveCharacterCreationSurvival'
  }
>

type CharacterCreationSurvivalResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationSurvivalResolved' }
>

const validateMishapResolution = (
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
    'MISHAP',
    'MISHAP_RESOLVED'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['resolveMishap'],
    'MISHAP_RESOLVED is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateInjuryResolution = (
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
    'MISHAP',
    'INJURY_RESOLVED'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['resolveInjury'],
    'INJURY_RESOLVED is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateDeathConfirmation = (
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
    'MISHAP',
    'DEATH_CONFIRMED'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['confirmDeath'],
    'DEATH_CONFIRMED is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateSurvivalResolution = (
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
    'SURVIVAL',
    'SURVIVAL'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['rollSurvival'],
    'SURVIVAL is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const resolveSurvivalCreationEvent = ({
  character,
  creation,
  ruleset,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  ruleset: CepheusRuleset
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Result<
  Pick<
    CharacterCreationSurvivalResolvedEvent,
    'passed' | 'survival' | 'canCommission' | 'canAdvance' | 'pendingDecisions'
  >,
  CommandError
> => {
  const career = creation.terms.at(-1)?.career
  if (!career) {
    return err(
      commandError('missing_entity', 'No active career term is available')
    )
  }

  const basics = ruleset.careerBasics[career]
  if (!basics) {
    return err(
      commandError('invalid_command', `Career ${career} is not supported`)
    )
  }

  const outcome = evaluateCareerCheck({
    check: basics.Survival,
    characteristics: character.characteristics,
    roll: roll.total
  })
  if (!outcome) {
    return err(
      commandError('invalid_command', `Career ${career} has no survival check`)
    )
  }

  const promotionOptions = outcome.success
    ? deriveSurvivalPromotionOptions(
        basics,
        deriveProjectedCareerRank(creation, career)
      )
    : { canCommission: false, canAdvance: false }

  return ok({
    passed: outcome.success,
    survival: {
      expression: roll.expression,
      rolls: [...roll.rolls],
      total: roll.total,
      characteristic: outcome.check.characteristic,
      modifier: outcome.modifier,
      target: outcome.check.target,
      success: outcome.success
    },
    canCommission: promotionOptions.canCommission,
    canAdvance: promotionOptions.canAdvance
  })
}

const rollD6 = (
  context: CommandContext,
  sequenceOffset = 0
): Result<
  { expression: '1d6'; rolls: number[]; total: number },
  CommandError
> => {
  const rolled = rollDiceExpression(
    '1d6',
    deriveEventRng(context.gameSeed, context.nextSeq + sequenceOffset)
  )
  if (!rolled.ok) {
    return err(commandError('invalid_command', rolled.error))
  }

  return ok({
    expression: '1d6',
    rolls: rolled.value.rolls,
    total: rolled.value.total
  })
}

const rollTwiceTakeLower = (
  context: CommandContext
): Result<
  { expression: '2d6'; rolls: number[]; total: number },
  CommandError
> => {
  const first = rollD6(context)
  if (!first.ok) return first
  const second = rollD6(context, 1)
  if (!second.ok) return second

  return ok({
    expression: '2d6',
    rolls: [first.value.rolls[0] ?? 1, second.value.rolls[0] ?? 1],
    total: Math.min(first.value.total, second.value.total)
  })
}

const resolveInjuryMethod = ({
  requirement,
  method
}: {
  requirement: SurvivalMishapInjuryRequirement | null
  method?: InjuryResolutionMethod
}): Result<InjuryResolutionMethod, CommandError> => {
  if (!requirement) {
    return err(commandError('missing_entity', 'No pending injury exists'))
  }
  if (requirement.type === 'roll') {
    if (method && method !== 'roll_table') {
      return err(
        commandError(
          'invalid_command',
          'This injury must roll on the injury table'
        )
      )
    }
    return ok('roll_table')
  }
  if (!method || method === 'fixed_result') return ok('fixed_result')
  if (
    method === 'roll_twice_take_lower' &&
    requirement.alternative === 'roll_twice_take_lower'
  ) {
    return ok(method)
  }

  return err(
    commandError(
      'invalid_command',
      'This injury resolution method is not legal'
    )
  )
}

export const deriveSurvivalCommandEvents = (
  command: CharacterCreationSurvivalCommand,
  context: CommandContext,
  rollEventId: EventId
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'ResolveCharacterCreationSurvival': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateSurvivalResolution(character, context.ruleset)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveSurvivalCreationEvent({
        character,
        creation: creation.value,
        ruleset: context.ruleset,
        roll: {
          expression: '2d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const creationEvent = resolved.value.passed
        ? {
            type: 'SURVIVAL_PASSED' as const,
            canCommission: resolved.value.canCommission,
            canAdvance: resolved.value.canAdvance,
            survival: resolved.value.survival
          }
        : {
            type: 'SURVIVAL_FAILED' as const,
            survival: resolved.value.survival
          }
      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )

      const career = creation.value.terms.at(-1)?.career ?? 'Career'

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career} survival`,
          rolls: [...resolved.value.survival.rolls],
          total: resolved.value.survival.total
        },
        {
          type: 'CharacterCreationSurvivalResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationMishap': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateMishapResolution(character, context.ruleset)
      if (!creation.ok) return creation
      const activeTerm = creation.value.terms.at(-1)
      if (!activeTerm) {
        return err(commandError('missing_entity', 'Career term does not exist'))
      }

      const rolled = rollDiceExpression(
        '1d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }
      const mishap = {
        roll: {
          expression: '1d6' as const,
          rolls: [...rolled.value.rolls],
          total: rolled.value.total
        },
        outcome: resolveSurvivalMishapOutcome({
          career: activeTerm.career,
          roll: { total: rolled.value.total }
        })
      }
      const creationEvent = { type: 'MISHAP_RESOLVED', mishap } as const

      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )

      return ok([
        {
          type: 'DiceRolled',
          expression: '1d6',
          reason: `${activeTerm.career} mishap`,
          rolls: [...rolled.value.rolls],
          total: rolled.value.total
        },
        {
          type: 'CharacterCreationMishapResolved',
          characterId: command.characterId,
          rollEventId,
          mishap,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationInjury': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateInjuryResolution(character, context.ruleset)
      if (!creation.ok) return creation

      const activeTerm = creation.value.terms.at(-1)
      const injuryRequirement = activeTerm?.facts?.mishap?.outcome.injury
      if (!activeTerm || !injuryRequirement) {
        return err(commandError('missing_entity', 'No pending injury exists'))
      }
      const injuryMethod = resolveInjuryMethod({
        requirement: injuryRequirement,
        method: command.method
      })
      if (!injuryMethod.ok) return injuryMethod

      let injuryRoll:
        | { expression: '1d6' | '2d6'; rolls: number[]; total: number }
        | undefined
      let severityRoll:
        | { expression: '1d6'; rolls: number[]; total: number }
        | undefined
      if (injuryMethod.value === 'roll_table') {
        const rolled = rollD6(context)
        if (!rolled.ok) return rolled
        injuryRoll = rolled.value
      } else if (injuryMethod.value === 'roll_twice_take_lower') {
        const rolled = rollTwiceTakeLower(context)
        if (!rolled.ok) return rolled
        injuryRoll = rolled.value
      }
      const injury = resolveInjuryOutcome({
        career: activeTerm.career,
        roll: {
          total:
            injuryMethod.value === 'fixed_result'
              ? injuryRequirement.type === 'fixed'
                ? injuryRequirement.injuryRoll
                : 1
              : (injuryRoll?.total ?? 1)
        }
      })
      if (injury.id === 'nearly_killed' || injury.id === 'severely_injured') {
        const rolled = rollD6(context, injuryRoll?.rolls.length ?? 0)
        if (!rolled.ok) return rolled
        severityRoll = rolled.value
      }

      const resolution = resolveInjuryLosses({
        characteristics: character.characteristics,
        injury,
        primaryCharacteristic: command.primaryCharacteristic,
        secondaryChoice: command.secondaryChoice,
        severityRoll: severityRoll?.total
      })
      if (!resolution.ok) {
        return err(commandError('invalid_command', resolution.error.message))
      }

      const creationEvent = { type: 'INJURY_RESOLVED' as const }
      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )
      const rolls = [
        ...(injuryRoll?.rolls ?? []),
        ...(severityRoll?.rolls ?? [])
      ]
      const expression = `${Math.max(1, rolls.length)}d6`

      return ok([
        {
          type: 'DiceRolled',
          expression,
          reason: `${activeTerm.career} injury`,
          rolls,
          total: rolls.reduce((total, roll) => total + roll, 0)
        },
        {
          type: 'CharacterCreationInjuryResolved',
          characterId: command.characterId,
          rollEventId,
          method: injuryMethod.value,
          ...(injuryRoll ? { injuryRoll } : {}),
          ...(severityRoll ? { severityRoll } : {}),
          outcome: injury,
          selectedLosses: resolution.value.selectedLosses,
          characteristicPatch: resolution.value.characteristicPatch,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ConfirmCharacterCreationDeath': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateDeathConfirmation(character, context.ruleset)
      if (!creation.ok) return creation
      const creationEvent = { type: 'DEATH_CONFIRMED' } as const

      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationDeathConfirmed',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }
  }
}
