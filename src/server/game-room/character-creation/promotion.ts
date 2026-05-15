import {
  deriveCareerCreationComplete,
  evaluateCareerCheck,
  parseCareerRankReward,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../../shared/character-creation/cepheus-srd-ruleset'
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

type CharacterCreationPromotionCommand = Extract<
  GameCommand,
  {
    type:
      | 'ResolveCharacterCreationAdvancement'
      | 'ResolveCharacterCreationCommission'
      | 'SkipCharacterCreationAdvancement'
      | 'SkipCharacterCreationCommission'
  }
>

type CharacterCreationCommissionResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationCommissionResolved' }
>

type CharacterCreationAdvancementResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationAdvancementResolved' }
>

const validateCommissionResolution = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'COMMISSION',
    'COMMISSION'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['rollCommission'],
    'COMMISSION is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateCommissionSkip = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'COMMISSION',
    'SKIP_COMMISSION'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['skipCommission'],
    'SKIP_COMMISSION is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateAdvancementResolution = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'ADVANCEMENT',
    'ADVANCEMENT'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['rollAdvancement'],
    'ADVANCEMENT is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateAdvancementSkip = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'ADVANCEMENT',
    'SKIP_ADVANCEMENT'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['skipAdvancement'],
    'SKIP_ADVANCEMENT is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const resolveCommissionCreationEvent = ({
  character,
  creation,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Result<
  Pick<CharacterCreationCommissionResolvedEvent, 'passed' | 'commission'>,
  CommandError
> => {
  const career = creation.terms.at(-1)?.career
  if (!career) {
    return err(
      commandError('missing_entity', 'No active career term is available')
    )
  }

  const basics = CEPHEUS_SRD_RULESET.careerBasics[career]
  if (!basics) {
    return err(
      commandError('invalid_command', `Career ${career} is not supported`)
    )
  }

  const outcome = evaluateCareerCheck({
    check: basics.Commission,
    characteristics: character.characteristics,
    roll: roll.total
  })
  if (!outcome) {
    return err(
      commandError(
        'invalid_command',
        `Career ${career} has no commission check`
      )
    )
  }

  return ok({
    passed: outcome.success,
    commission: {
      expression: roll.expression,
      rolls: [...roll.rolls],
      total: roll.total,
      characteristic: outcome.check.characteristic,
      modifier: outcome.modifier,
      target: outcome.check.target,
      success: outcome.success
    }
  })
}

const resolveAdvancementCreationEvent = ({
  character,
  creation,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Result<
  Pick<
    CharacterCreationAdvancementResolvedEvent,
    'passed' | 'advancement' | 'rank'
  >,
  CommandError
> => {
  const career = creation.terms.at(-1)?.career
  if (!career) {
    return err(
      commandError('missing_entity', 'No active career term is available')
    )
  }

  const basics = CEPHEUS_SRD_RULESET.careerBasics[career]
  if (!basics) {
    return err(
      commandError('invalid_command', `Career ${career} is not supported`)
    )
  }

  const outcome = evaluateCareerCheck({
    check: basics.Advancement,
    characteristics: character.characteristics,
    roll: roll.total
  })
  if (!outcome) {
    return err(
      commandError(
        'invalid_command',
        `Career ${career} has no advancement check`
      )
    )
  }

  const previousRank = deriveProjectedCareerRank(creation, career)
  const newRank = outcome.success ? Math.min(previousRank + 1, 6) : previousRank
  const reward = parseCareerRankReward({
    ranksAndSkills: CEPHEUS_SRD_RULESET.ranksAndSkills,
    career,
    rank: newRank
  })

  return ok({
    passed: outcome.success,
    advancement: {
      expression: roll.expression,
      rolls: [...roll.rolls],
      total: roll.total,
      characteristic: outcome.check.characteristic,
      modifier: outcome.modifier,
      target: outcome.check.target,
      success: outcome.success
    },
    rank: outcome.success
      ? {
          career,
          previousRank,
          newRank,
          title: reward.title,
          bonusSkill: reward.bonusSkill
        }
      : null
  })
}

export const derivePromotionCommandEvents = (
  command: CharacterCreationPromotionCommand,
  context: CommandContext,
  rollEventId: EventId
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'ResolveCharacterCreationCommission': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateCommissionResolution(character)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveCommissionCreationEvent({
        character,
        creation: creation.value,
        roll: {
          expression: '2d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'COMPLETE_COMMISSION',
        commission: resolved.value.commission
      })

      const career = creation.value.terms.at(-1)?.career ?? 'Career'

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career} commission`,
          rolls: [...resolved.value.commission.rolls],
          total: resolved.value.commission.total
        },
        {
          type: 'CharacterCreationCommissionResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'SkipCharacterCreationCommission': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateCommissionSkip(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'SKIP_COMMISSION'
      })

      return ok([
        {
          type: 'CharacterCreationCommissionSkipped',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationAdvancement': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateAdvancementResolution(character)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveAdvancementCreationEvent({
        character,
        creation: creation.value,
        roll: {
          expression: '2d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'COMPLETE_ADVANCEMENT',
        advancement: resolved.value.advancement,
        rank: resolved.value.rank
      })

      const career = creation.value.terms.at(-1)?.career ?? 'Career'

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career} advancement`,
          rolls: [...resolved.value.advancement.rolls],
          total: resolved.value.advancement.total
        },
        {
          type: 'CharacterCreationAdvancementResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'SkipCharacterCreationAdvancement': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateAdvancementSkip(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'SKIP_ADVANCEMENT'
      })

      return ok([
        {
          type: 'CharacterCreationAdvancementSkipped',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }
  }
}
