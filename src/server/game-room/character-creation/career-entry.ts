import {
  availableCareerNames,
  deriveCareerCreationComplete,
  deriveCareerQualificationDm,
  deriveFailedQualificationOptions,
  evaluateCareerCheck,
  resolveDraftCareer,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import type { CepheusSrdRuleset } from '../../../shared/character-creation/cepheus-srd-ruleset'
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
  requireLegalCharacterCreationAction,
  requireNoPendingCharacterCreationDecisions
} from '../character-creation-command-helpers'
import {
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireNonEmptyString
} from '../command-helpers'

type CharacterCreationCareerEntryCommand = Extract<
  GameCommand,
  {
    type:
      | 'EnterCharacterCreationDrifter'
      | 'ResolveCharacterCreationDraft'
      | 'ResolveCharacterCreationQualification'
      | 'StartCharacterCareerTerm'
  }
>

type CharacterCreationQualificationResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationQualificationResolved' }
>

type CharacterCreationDraftResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationDraftResolved' }
>

const validateCareerSelection = (
  character: CharacterState,
  ruleset: CepheusSrdRuleset
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'CAREER_SELECTION',
    'CAREER_SELECTION'
  )
  if (!status.ok) return status
  const decisions = requireNoPendingCharacterCreationDecisions(
    character.creation,
    'CAREER_SELECTION is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!decisions.ok) return decisions
  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['selectCareer'],
    'CAREER_SELECTION is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction
  if (character.creation.terms.length >= 7) {
    return err(commandError('invalid_command', 'Maximum terms reached'))
  }

  return ok(character.creation)
}

const validateQualificationResolution = (
  character: CharacterState,
  ruleset: CepheusSrdRuleset
): Result<CharacterCreationProjection, CommandError> => {
  const creation = validateCareerSelection(character, ruleset)
  if (!creation.ok) return creation
  if (creation.value.failedToQualify) {
    return err(
      commandError(
        'invalid_command',
        'Qualification is not available after failed qualification'
      )
    )
  }

  return creation
}

const previousCareerNames = (creation: CharacterCreationProjection): string[] =>
  creation.careers.map((career) => career.name)

const previousCareerCount = (
  creation: CharacterCreationProjection,
  career: string
): number =>
  previousCareerNames(creation).filter(
    (previousCareer) =>
      previousCareer !== 'Drifter' && previousCareer !== career
  ).length

const validateCareerCanBeSelected = (
  creation: CharacterCreationProjection,
  ruleset: CepheusSrdRuleset,
  career: string
): Result<void, CommandError> => {
  if (!ruleset.careerBasics[career]) {
    return err(
      commandError('invalid_command', `Career ${career} is not supported`)
    )
  }
  const available = availableCareerNames(
    ruleset.careerBasics,
    previousCareerNames(creation)
  )
  if (!available.includes(career)) {
    return err(
      commandError(
        'invalid_command',
        `Career ${career} is not available after prior service`
      )
    )
  }

  return ok(undefined)
}

const resolveQualificationCreationEvent = ({
  character,
  creation,
  ruleset,
  career,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  ruleset: CepheusSrdRuleset
  career: string
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Result<
  Pick<
    CharacterCreationQualificationResolvedEvent,
    | 'career'
    | 'passed'
    | 'qualification'
    | 'previousCareerCount'
    | 'failedQualificationOptions'
  >,
  CommandError
> => {
  const basics = ruleset.careerBasics[career]
  if (!basics) {
    return err(
      commandError('invalid_command', `Career ${career} is not supported`)
    )
  }

  const priorCareerCount = previousCareerCount(creation, career)
  const outcome = evaluateCareerCheck({
    check: basics.Qualifications,
    characteristics: character.characteristics,
    roll: roll.total,
    dm: deriveCareerQualificationDm(priorCareerCount)
  })
  if (!outcome) {
    return err(
      commandError(
        'invalid_command',
        `Career ${career} has no qualification check`
      )
    )
  }

  return ok({
    career,
    passed: outcome.success,
    qualification: {
      expression: roll.expression,
      rolls: [...roll.rolls],
      total: roll.total,
      characteristic: outcome.check.characteristic,
      modifier: outcome.modifier,
      target: outcome.check.target,
      success: outcome.success
    },
    previousCareerCount: priorCareerCount,
    failedQualificationOptions: outcome.success
      ? []
      : deriveFailedQualificationOptions({
          canEnterDraft: creation.canEnterDraft
        })
  })
}

const resolveDraftCreationEvent = ({
  ruleset,
  roll
}: {
  ruleset: CepheusSrdRuleset
  roll: { expression: '1d6'; rolls: number[]; total: number }
}): Result<
  Pick<CharacterCreationDraftResolvedEvent, 'draft'>,
  CommandError
> => {
  const draft = resolveDraftCareer({
    table: ruleset.theDraft,
    roll: roll.total
  })
  if (!draft) {
    return err(commandError('invalid_command', 'Draft roll did not resolve'))
  }

  return ok({
    draft: {
      roll: {
        expression: roll.expression,
        rolls: [...roll.rolls],
        total: roll.total
      },
      tableRoll: draft.roll,
      acceptedCareer: draft.career
    }
  })
}

export const deriveCareerEntryCommandEvents = (
  command: CharacterCreationCareerEntryCommand,
  context: CommandContext,
  rollEventId: EventId
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
    case 'ResolveCharacterCreationQualification': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateQualificationResolution(character, context.ruleset)
      if (!creation.ok) return creation
      const career = requireNonEmptyString(command.career, 'career')
      if (!career.ok) return career
      const selectable = validateCareerCanBeSelected(
        creation.value,
        context.ruleset,
        career.value
      )
      if (!selectable.ok) return selectable

      const rolled = rollDiceExpression(
        '2d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveQualificationCreationEvent({
        character,
        creation: creation.value,
        ruleset: context.ruleset,
        career: career.value,
        roll: {
          expression: '2d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const nextState = resolved.value.passed
        ? transitionCareerCreationState(creation.value.state, {
            type: 'SELECT_CAREER',
            isNewCareer: true,
            qualification: resolved.value.qualification
          })
        : creation.value.state

      return ok([
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${career.value} qualification`,
          rolls: [...resolved.value.qualification.rolls],
          total: resolved.value.qualification.total
        },
        {
          type: 'CharacterCreationQualificationResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationDraft': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateCareerSelection(character, context.ruleset)
      if (!creation.ok) return creation
      if (!creation.value.failedToQualify) {
        return err(
          commandError(
            'invalid_command',
            'Draft is only available after failed qualification'
          )
        )
      }
      if (!creation.value.canEnterDraft) {
        return err(
          commandError('invalid_command', 'Draft has already been used')
        )
      }

      const rolled = rollDiceExpression(
        '1d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveDraftCreationEvent({
        ruleset: context.ruleset,
        roll: {
          expression: '1d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'SELECT_CAREER',
        isNewCareer: true,
        drafted: true
      })

      return ok([
        {
          type: 'DiceRolled',
          expression: '1d6',
          reason: 'Draft',
          rolls: [...resolved.value.draft.roll.rolls],
          total: resolved.value.draft.roll.total
        },
        {
          type: 'CharacterCreationDraftResolved',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'EnterCharacterCreationDrifter': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateCareerSelection(character, context.ruleset)
      if (!creation.ok) return creation
      if (!creation.value.failedToQualify) {
        return err(
          commandError(
            'invalid_command',
            'Drifter fallback is only available after failed qualification'
          )
        )
      }
      if (command.option !== 'Drifter') {
        return err(commandError('invalid_command', 'option must be Drifter'))
      }

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'SELECT_CAREER',
        isNewCareer: true
      })

      return ok([
        {
          type: 'CharacterCreationDrifterEntered',
          characterId: command.characterId,
          acceptedCareer: 'Drifter',
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'StartCharacterCareerTerm': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { state, character } = loaded.value
      if (!isReferee(state, command.actorId)) {
        return notAllowed(
          'Only the referee can start character career terms directly'
        )
      }
      const creation = validateCareerSelection(character, context.ruleset)
      if (!creation.ok) return creation
      const career = requireNonEmptyString(command.career, 'career')
      if (!career.ok) return career
      const acceptedCareer = career.value.trim()
      const requestedCareer = command.drafted ? 'Draft' : acceptedCareer
      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'SELECT_CAREER',
        isNewCareer: true,
        drafted: command.drafted ?? false
      })

      return ok([
        {
          type: 'CharacterCareerTermStarted',
          characterId: command.characterId,
          requestedCareer,
          acceptedCareer,
          career: acceptedCareer,
          drafted: command.drafted ?? false,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }
  }
}
