import {
  deriveCareerCreationComplete,
  deriveCareerCreationReenlistmentOutcome,
  evaluateCareerCheck,
  resolveAgingLosses,
  resolveAnagathicsUse,
  resolveReenlistment,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../../shared/character-creation/cepheus-srd-ruleset'
import type { GameCommand } from '../../../shared/commands'
import { rollDiceExpression } from '../../../shared/dice'
import type { GameEvent } from '../../../shared/events'
import { asEventId, type EventId } from '../../../shared/ids'
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
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  notAllowed
} from '../command-helpers'
import {
  resolveAgingCreationEvent,
  validateAgingLossResolution,
  validateAgingResolution,
  validateAnagathicsDecision
} from './aging'

type CharacterCreationLifecycleCommand = Extract<
  GameCommand,
  {
    type:
      | 'DecideCharacterCreationAnagathics'
      | 'LeaveCharacterCreationCareer'
      | 'ReenlistCharacterCreationCareer'
      | 'ResolveCharacterCreationAging'
      | 'ResolveCharacterCreationAgingLosses'
      | 'ResolveCharacterCreationReenlistment'
  }
>

type CharacterCreationReenlistmentResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationReenlistmentResolved' }
>

type CharacterCreationCareerReenlistedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationCareerReenlisted' }
>

type CharacterCreationCareerLeftEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationCareerLeft' }
>

const validateReenlistmentResolution = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'REENLISTMENT',
    'REENLISTMENT'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['rollReenlistment'],
    'REENLISTMENT is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateCareerReenlistment = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'REENLISTMENT',
    'REENLIST'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['reenlist', 'forcedReenlist'],
    'REENLIST is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateCareerLeave = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'REENLISTMENT',
    'LEAVE_CAREER'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['leaveCareer'],
    'LEAVE_CAREER is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const resolveReenlistmentCreationEvent = ({
  character,
  creation,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Result<
  Pick<CharacterCreationReenlistmentResolvedEvent, 'outcome' | 'reenlistment'>,
  CommandError
> => {
  const term = creation.terms.at(-1)
  const career = term?.career
  if (!term || !career) {
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
    check: basics.ReEnlistment,
    characteristics: character.characteristics,
    roll: roll.total
  })
  if (!outcome) {
    return err(
      commandError(
        'invalid_command',
        `Career ${career} has no reenlistment check`
      )
    )
  }

  const resolution = resolveReenlistment({
    term,
    termCount: creation.terms.length,
    roll: roll.total,
    check: basics.ReEnlistment,
    characteristics: character.characteristics
  })
  if (resolution.outcome === 'retire') {
    return err(
      commandError(
        'invalid_command',
        'REENLISTMENT is blocked by unresolved character creation decisions'
      )
    )
  }

  return ok({
    outcome: resolution.outcome,
    reenlistment: {
      expression: roll.expression,
      rolls: [...roll.rolls],
      total: roll.total,
      characteristic: outcome.check.characteristic,
      modifier: outcome.modifier,
      target: outcome.check.target,
      success: outcome.success,
      outcome: resolution.outcome
    }
  })
}

export const deriveLifecycleCommandEvents = (
  command: CharacterCreationLifecycleCommand,
  context: CommandContext,
  rollEventId: EventId
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'ResolveCharacterCreationAging': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateAgingResolution(character)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveAgingCreationEvent({
        character,
        creation: creation.value,
        roll: {
          expression: '2d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'COMPLETE_AGING',
        aging: resolved.aging
      })

      const career = creation.value.terms.at(-1)?.career ?? 'Career'

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career} aging`,
          rolls: [...resolved.aging.roll.rolls],
          total: resolved.aging.roll.total
        },
        {
          type: 'CharacterCreationAgingResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationAgingLosses': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateAgingLossResolution(character)
      if (!creation.ok) return creation

      const resolved = resolveAgingLosses({
        characteristics: character.characteristics,
        pendingLosses: creation.value.characteristicChanges,
        selectedLosses: command.selectedLosses
      })
      if (!resolved.ok) {
        return err(commandError('invalid_command', resolved.error.message))
      }

      return ok([
        {
          type: 'CharacterCreationAgingLossesResolved',
          characterId: command.characterId,
          selectedLosses: resolved.value.selectedLosses,
          characteristicPatch: resolved.value.characteristicPatch,
          state: creation.value.state,
          creationComplete: creation.value.creationComplete
        }
      ])
    }

    case 'DecideCharacterCreationAnagathics': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { state, character } = loaded.value
      if (!canMutateCharacter(state, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can decide anagathics'
        )
      }
      const creation = validateAnagathicsDecision(character)
      if (!creation.ok) return creation
      const termIndex = creation.value.terms.length - 1
      const activeTerm = creation.value.terms[termIndex]
      if (!activeTerm) {
        return err(commandError('missing_entity', 'Career term does not exist'))
      }

      const basics = CEPHEUS_SRD_RULESET.careerBasics[activeTerm.career]
      if (command.useAnagathics && !basics) {
        return err(
          commandError(
            'invalid_command',
            `Career ${activeTerm.career} is not supported`
          )
        )
      }

      const survivalRoll = command.useAnagathics
        ? rollDiceExpression(
            '2d6',
            deriveEventRng(context.gameSeed, context.nextSeq)
          )
        : null
      if (survivalRoll && !survivalRoll.ok) {
        return err(commandError('invalid_command', survivalRoll.error))
      }
      const survivalRollValue = survivalRoll?.ok ? survivalRoll.value : null
      const survivalOutcome =
        command.useAnagathics && basics && survivalRollValue
          ? evaluateCareerCheck({
              check: basics.Survival,
              characteristics: character.characteristics,
              roll: survivalRollValue.total
            })
          : null
      if (command.useAnagathics && !survivalOutcome) {
        return err(
          commandError(
            'invalid_command',
            `Career ${activeTerm.career} has no survival check`
          )
        )
      }
      const survivalFact =
        survivalOutcome && survivalRollValue
          ? {
              expression: '2d6' as const,
              rolls: [...survivalRollValue.rolls],
              total: survivalRollValue.total,
              characteristic: survivalOutcome.check.characteristic,
              modifier: survivalOutcome.modifier,
              target: survivalOutcome.check.target,
              success: survivalOutcome.success
            }
          : undefined

      const survivedAnagathics =
        !command.useAnagathics || survivalOutcome?.success === true
      const resolved = resolveAnagathicsUse({
        term: activeTerm,
        survived: command.useAnagathics && survivedAnagathics
      })
      const costRoll =
        command.useAnagathics && survivedAnagathics
          ? rollDiceExpression(
              '1d6',
              deriveEventRng(context.gameSeed, context.nextSeq + 1)
            )
          : null
      if (costRoll && !costRoll.ok) {
        return err(commandError('invalid_command', costRoll.error))
      }
      const costRollValue = costRoll?.ok ? costRoll.value : null
      const cost = costRollValue ? costRollValue.total * 2500 : undefined
      const nextState =
        command.useAnagathics && survivalOutcome?.success === false
          ? transitionCareerCreationState(creation.value.state, {
              type: 'ANAGATHICS_FAILED',
              survival: survivalFact
            })
          : structuredClone(creation.value.state)
      const pendingDecisions =
        command.useAnagathics && survivalOutcome?.success === false
          ? ([{ key: 'mishapResolution' }] as const)
          : undefined
      const activityRollEventId =
        costRollValue !== null
          ? asEventId(`${command.gameId}:${context.nextSeq + 1}`)
          : survivalRollValue !== null
            ? rollEventId
            : undefined

      return ok([
        ...(survivalRollValue
          ? [
              {
                type: 'DiceRolled' as const,
                expression: '2d6' as const,
                reason: `${activeTerm.career} anagathics survival`,
                rolls: [...survivalRollValue.rolls],
                total: survivalRollValue.total
              }
            ]
          : []),
        ...(costRollValue
          ? [
              {
                type: 'DiceRolled' as const,
                expression: '1d6' as const,
                reason: `${activeTerm.career} anagathics cost`,
                rolls: [...costRollValue.rolls],
                total: costRollValue.total
              }
            ]
          : []),
        {
          type: 'CharacterCreationAnagathicsDecided',
          characterId: command.characterId,
          ...(activityRollEventId ? { rollEventId: activityRollEventId } : {}),
          useAnagathics: command.useAnagathics,
          termIndex,
          ...(command.useAnagathics
            ? {
                passed: resolved.survived,
                ...(survivalFact ? { survival: survivalFact } : {})
              }
            : {}),
          ...(cost !== undefined
            ? {
                cost,
                costRoll: {
                  expression: '1d6' as const,
                  rolls: [...(costRollValue?.rolls ?? [])],
                  total: costRollValue?.total ?? 0
                }
              }
            : {}),
          ...(pendingDecisions
            ? { pendingDecisions: [...pendingDecisions] }
            : {}),
          state: nextState,
          creationComplete: false
        }
      ])
    }

    case 'ResolveCharacterCreationReenlistment': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateReenlistmentResolution(character)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveReenlistmentCreationEvent({
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
        type: 'RESOLVE_REENLISTMENT',
        reenlistment: resolved.value.reenlistment
      })

      const career = creation.value.terms.at(-1)?.career ?? 'Career'

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career} reenlistment`,
          rolls: [...resolved.value.reenlistment.rolls],
          total: resolved.value.reenlistment.total
        },
        {
          type: 'CharacterCreationReenlistmentResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ReenlistCharacterCreationCareer': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateCareerReenlistment(character)
      if (!creation.ok) return creation

      const outcome = deriveCareerCreationReenlistmentOutcome(creation.value)
      if (outcome !== 'forced' && outcome !== 'allowed') {
        return err(
          commandError(
            'invalid_command',
            'REENLIST is blocked by unresolved character creation decisions'
          )
        )
      }
      const career = creation.value.terms.at(-1)?.career
      if (!career) {
        return err(
          commandError('missing_entity', 'No active career term is available')
        )
      }

      const creationEvent =
        outcome === 'forced'
          ? ({ type: 'FORCED_REENLIST' } as const)
          : ({ type: 'REENLIST' } as const)
      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationCareerReenlisted',
          characterId: command.characterId,
          outcome,
          career,
          forced: outcome === 'forced',
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        } satisfies CharacterCreationCareerReenlistedEvent
      ])
    }

    case 'LeaveCharacterCreationCareer': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateCareerLeave(character)
      if (!creation.ok) return creation

      const outcome = deriveCareerCreationReenlistmentOutcome(creation.value)
      if (
        outcome !== 'allowed' &&
        outcome !== 'blocked' &&
        outcome !== 'retire'
      ) {
        return err(
          commandError(
            'invalid_command',
            'LEAVE_CAREER is blocked by unresolved character creation decisions'
          )
        )
      }
      const creationEvent =
        outcome === 'blocked'
          ? ({ type: 'REENLIST_BLOCKED' } as const)
          : ({ type: 'LEAVE_CAREER' } as const)
      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationCareerLeft',
          characterId: command.characterId,
          outcome,
          retirement: outcome === 'retire',
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        } satisfies CharacterCreationCareerLeftEvent
      ])
    }
  }
}
