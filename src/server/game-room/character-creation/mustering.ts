import {
  canRollCashBenefit,
  deriveCareerCreationComplete,
  deriveCashBenefitRollModifier,
  deriveCareerTermCashBenefitCount,
  deriveCareerTermMusteringBenefitCount,
  deriveMaterialBenefitRollModifier,
  deriveMaterialBenefitEffect,
  deriveRemainingCareerBenefits,
  resolveCareerBenefit,
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
  requireNoBlockingCharacterCreationDecisions,
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction
} from '../character-creation-command-helpers'
import {
  commandError,
  type CommandContext,
  requireNonEmptyString
} from '../command-helpers'

type CharacterCreationMusteringCommand = Extract<
  GameCommand,
  {
    type:
      | 'CompleteCharacterCreationMustering'
      | 'ContinueCharacterCreationAfterMustering'
      | 'RollCharacterCreationMusteringBenefit'
  }
>

type CharacterCreationMusteringBenefitRolledEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationMusteringBenefitRolled' }
>

const currentCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => {
  let projectedRank: number | null = null
  for (const term of creation.terms) {
    if (term.career !== career) continue
    const advancement = term.facts?.advancement
    if (
      advancement &&
      !advancement.skipped &&
      advancement.rank?.career === career
    ) {
      projectedRank = advancement.rank.newRank
    }
  }

  return (
    projectedRank ??
    creation.careers.find((entry) => entry.name === career)?.rank ??
    0
  )
}

const termsInCareer = (
  creation: CharacterCreationProjection,
  career: string
): number => creation.terms.filter((term) => term.career === career).length

const benefitsReceivedInCareer = (
  creation: CharacterCreationProjection,
  career: string
): number =>
  creation.terms
    .filter((term) => term.career === career)
    .reduce(
      (total, term) => total + deriveCareerTermMusteringBenefitCount(term),
      0
    )

const cashBenefitsReceived = (creation: CharacterCreationProjection): number =>
  creation.terms.reduce(
    (total, term) => total + deriveCareerTermCashBenefitCount(term),
    0
  )

const hasSemanticTermFacts = (
  term: CharacterCreationProjection['terms'][number]
): boolean => Object.keys(term.facts ?? {}).length > 0

const hasGamblingSkill = (character: CharacterState): boolean => {
  const creation = character.creation
  const termSkills = (term: CharacterCreationProjection['terms'][number]) => {
    const factSkills = [
      ...(term.facts?.basicTrainingSkills ?? []),
      ...(term.facts?.termSkillRolls ?? []).flatMap((termSkill) =>
        termSkill.skill ? [termSkill.skill] : []
      )
    ]
    return hasSemanticTermFacts(term) ? factSkills : term.skillsAndTraining
  }
  const creationSkills = [
    ...(creation?.backgroundSkills ?? []),
    ...(creation?.terms.flatMap(termSkills) ?? [])
  ]

  return [...character.skills, ...creationSkills].some((skill) =>
    /^gambling(?:-|$)/i.test(skill.trim())
  )
}

const validateMusteringBenefitRoll = (
  character: CharacterState,
  career: string
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'MUSTERING_OUT',
    'MUSTERING_BENEFIT'
  )
  if (!status.ok) return status

  const decisions = requireNoBlockingCharacterCreationDecisions(
    character.creation,
    'musteringBenefitSelection',
    'MUSTERING_BENEFIT is blocked by unresolved character creation decisions'
  )
  if (!decisions.ok) return decisions

  const remainingInCareer = deriveRemainingCareerBenefits({
    termsInCareer: termsInCareer(character.creation, career),
    currentRank: currentCareerRank(character.creation, career),
    benefitsReceived: benefitsReceivedInCareer(character.creation, career)
  })
  if (remainingInCareer <= 0) {
    return err(
      commandError(
        'invalid_command',
        `No remaining mustering benefits for ${career}`
      )
    )
  }

  return ok(character.creation)
}

const validateMusteringCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'MUSTERING_OUT',
    'FINISH_MUSTERING'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['finishMustering'],
    'FINISH_MUSTERING is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateMusteringContinuation = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'MUSTERING_OUT',
    'CONTINUE_CAREER'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['continueCareer'],
    'CONTINUE_CAREER is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const resolveMusteringBenefitCreationEvent = ({
  character,
  creation,
  career,
  kind,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  career: string
  kind: CharacterCreationMusteringBenefitRolledEvent['musteringBenefit']['kind']
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Result<
  Pick<CharacterCreationMusteringBenefitRolledEvent, 'musteringBenefit'>,
  CommandError
> => {
  if (
    kind === 'cash' &&
    !canRollCashBenefit({
      cashBenefitsReceived: cashBenefitsReceived(creation)
    })
  ) {
    return err(
      commandError(
        'invalid_command',
        'Cash mustering benefit limit has been reached'
      )
    )
  }

  const rank = currentCareerRank(creation, career)
  const modifier =
    kind === 'cash'
      ? deriveCashBenefitRollModifier({
          retired: creation.terms.length >= 7,
          hasGambling: hasGamblingSkill(character)
        })
      : deriveMaterialBenefitRollModifier({ currentRank: rank })
  const tableRoll = roll.total + modifier
  const benefit = resolveCareerBenefit({
    tables: CEPHEUS_SRD_RULESET,
    career,
    kind,
    roll: tableRoll
  })
  const materialEffect =
    kind === 'material' ? deriveMaterialBenefitEffect(benefit.value) : null

  return ok({
    musteringBenefit: {
      career,
      kind,
      roll: {
        expression: roll.expression,
        rolls: [...roll.rolls],
        total: roll.total
      },
      modifier,
      tableRoll,
      value: benefit.value,
      credits: benefit.credits,
      materialItem:
        materialEffect?.kind === 'equipment' ? materialEffect.item : null
    }
  })
}

export const deriveMusteringCommandEvents = (
  command: CharacterCreationMusteringCommand,
  context: CommandContext,
  rollEventId: EventId
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'RollCharacterCreationMusteringBenefit': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const career = requireNonEmptyString(command.career, 'career')
      if (!career.ok) return career
      const creation = validateMusteringBenefitRoll(character, career.value)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveMusteringBenefitCreationEvent({
        character,
        creation: creation.value,
        career: career.value,
        kind: command.kind,
        roll: {
          expression: '2d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'FINISH_MUSTERING',
        musteringBenefit: resolved.value.musteringBenefit
      })

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career.value} ${command.kind} mustering benefit`,
          rolls: [...resolved.value.musteringBenefit.roll.rolls],
          total: resolved.value.musteringBenefit.roll.total
        },
        {
          type: 'CharacterCreationMusteringBenefitRolled',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ContinueCharacterCreationAfterMustering': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateMusteringContinuation(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'CONTINUE_CAREER'
      })

      return ok([
        {
          type: 'CharacterCreationAfterMusteringContinued',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'CompleteCharacterCreationMustering': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateMusteringCompletion(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'FINISH_MUSTERING'
      })

      return ok([
        {
          type: 'CharacterCreationMusteringCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }
  }
}
