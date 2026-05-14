import type { GameCommand } from '../../shared/commands'
import {
  canRollCashBenefit,
  careerSkillWithLevel,
  deriveCashBenefitRollModifier,
  deriveRemainingCareerBenefits,
  deriveMaterialBenefitRollModifier,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  resolveCareerBenefit,
  resolveCareerSkillTableRoll,
  resolveCascadeCareerSkill,
  transitionCareerCreationState,
  deriveCareerCreationComplete
} from '../../shared/characterCreation'
import type { CareerCreationTermSkillTable } from '../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import { rollDiceExpression } from '../../shared/dice'
import type { GameEvent } from '../../shared/events'
import { asEventId } from '../../shared/ids'
import { deriveEventRng } from '../../shared/prng'
import { err, ok, type Result } from '../../shared/result'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../shared/state'
import type { CommandError } from '../../shared/protocol'
import {
  loadCharacterCreationCommandContext,
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction,
  requireNoBlockingCharacterCreationDecisions
} from './character-creation-command-helpers'
import { deriveBoardCommandEvents } from './board-command-handlers'
import { deriveCharacterCommandEvents } from './character-command-handlers'
import { deriveCharacterCreationCommandEvents } from './character-creation-command-handlers'
import {
  canMutateCharacter,
  commandError,
  notAllowed,
  requireNonEmptyString,
  type CommandContext,
  validateExpectedSeq
} from './command-helpers'
import { deriveDiceCommandEvents } from './dice-command-handlers'
import { deriveGameCommandEvents } from './game-command-handlers'

export type { CommandContext } from './command-helpers'

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

const normalizeBackgroundSkill = (
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
    .reduce((total, term) => total + term.benefits.length, 0)

const cashBenefitsReceived = (creation: CharacterCreationProjection): number =>
  (creation.history ?? []).filter(
    (event) =>
      event.type === 'FINISH_MUSTERING' &&
      event.musteringBenefit?.kind === 'cash'
  ).length

const hasGamblingSkill = (character: CharacterState): boolean => {
  const creation = character.creation
  const creationSkills = [
    ...(creation?.backgroundSkills ?? []),
    ...(creation?.terms.flatMap((term) => term.skillsAndTraining) ?? [])
  ]

  return [...character.skills, ...creationSkills].some((skill) =>
    /^gambling(?:-|$)/i.test(skill.trim())
  )
}

const currentCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => creation.careers.find((entry) => entry.name === career)?.rank ?? 0

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

type CharacterCreationTermSkillRolledEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationTermSkillRolled' }
>

type CharacterCreationMusteringBenefitRolledEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationMusteringBenefitRolled' }
>

const termSkillTables = {
  personalDevelopment: CEPHEUS_SRD_RULESET.personalDevelopment,
  serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
  specialistSkills: CEPHEUS_SRD_RULESET.specialistSkills,
  advancedEducation: CEPHEUS_SRD_RULESET.advEducation
} satisfies Record<
  CareerCreationTermSkillTable,
  Record<string, Record<string, string>>
>

const isCareerCreationTermSkillTable = (
  value: string
): value is CareerCreationTermSkillTable =>
  value === 'personalDevelopment' ||
  value === 'serviceSkills' ||
  value === 'specialistSkills' ||
  value === 'advancedEducation'

const termCharacteristicGain = (
  rawSkill: string
): CharacterCreationTermSkillRolledEvent['termSkill']['characteristic'] => {
  const parsed = /^\+1\s+(Str|Dex|End|Int|Edu|Soc)$/i.exec(rawSkill.trim())
  if (!parsed) return null

  return {
    key: parsed[1].toLowerCase() as NonNullable<
      CharacterCreationTermSkillRolledEvent['termSkill']['characteristic']
    >['key'],
    modifier: 1
  }
}

const requiredTermSkillCount = (
  creation: CharacterCreationProjection
): number => {
  const term = creation.terms.at(-1)
  if (!term || term.survival === undefined) return 0

  return !creation.state.context.canCommission &&
    !creation.state.context.canAdvance
    ? 2
    : 1
}

const activeTermSkillCount = (creation: CharacterCreationProjection): number =>
  creation.terms.at(-1)?.skills.length ?? 0

const validateTermSkillRoll = (
  character: CharacterState,
  table: string
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  if (character.creation.state.status !== 'SKILLS_TRAINING') {
    return err(
      commandError(
        'invalid_command',
        `TERM_SKILL is not valid from ${character.creation.state.status}`
      )
    )
  }
  if (!isCareerCreationTermSkillTable(table)) {
    return err(commandError('invalid_command', 'term skill table is not valid'))
  }
  if (
    table === 'advancedEducation' &&
    (character.characteristics.edu ?? 0) < 8
  ) {
    return err(
      commandError(
        'invalid_command',
        'Advanced education requires EDU 8 or higher'
      )
    )
  }
  if ((character.creation.pendingCascadeSkills ?? []).length > 0) {
    return err(
      commandError(
        'invalid_command',
        'Pending cascade skills must be resolved before rolling another term skill'
      )
    )
  }
  if (
    activeTermSkillCount(character.creation) >=
    requiredTermSkillCount(character.creation)
  ) {
    return err(
      commandError('invalid_command', 'Required term skill rolls are complete')
    )
  }

  return ok(character.creation)
}

const validateSkillsCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  if (character.creation.state.status !== 'SKILLS_TRAINING') {
    return err(
      commandError(
        'invalid_command',
        `COMPLETE_SKILLS is not valid from ${character.creation.state.status}`
      )
    )
  }
  if ((character.creation.pendingCascadeSkills ?? []).length > 0) {
    return err(
      commandError(
        'invalid_command',
        'COMPLETE_SKILLS is blocked by unresolved cascade skills'
      )
    )
  }
  if (
    activeTermSkillCount(character.creation) <
    requiredTermSkillCount(character.creation)
  ) {
    return err(
      commandError(
        'invalid_command',
        'COMPLETE_SKILLS is blocked until required term skills are rolled'
      )
    )
  }

  return ok(character.creation)
}

const resolveTermSkillCreationEvent = ({
  creation,
  table,
  roll
}: {
  creation: CharacterCreationProjection
  table: CareerCreationTermSkillTable
  roll: { expression: '1d6'; rolls: number[]; total: number }
}): Result<
  Pick<
    CharacterCreationTermSkillRolledEvent,
    'termSkill' | 'termSkills' | 'skillsAndTraining' | 'pendingCascadeSkills'
  >,
  CommandError
> => {
  const career = creation.terms.at(-1)?.career
  if (!career) {
    return err(
      commandError('missing_entity', 'No active career term is available')
    )
  }

  const rawSkill = resolveCareerSkillTableRoll({
    table: termSkillTables[table],
    career,
    roll: roll.total
  })
  if (!rawSkill) {
    return err(
      commandError(
        'invalid_command',
        `Career ${career} has no ${table} skill table`
      )
    )
  }

  const characteristic = termCharacteristicGain(rawSkill)
  const pendingCascadeSkill = isCascadeCareerSkill(rawSkill)
    ? careerSkillWithLevel(rawSkill, 1)
    : null
  const normalizedSkill =
    characteristic || pendingCascadeSkill
      ? null
      : normalizeCareerSkill(rawSkill, 1)
  if (!characteristic && !pendingCascadeSkill && !normalizedSkill) {
    return err(commandError('invalid_command', 'Rolled skill is not valid'))
  }

  const existingSkills = creation.terms.at(-1)?.skillsAndTraining ?? []
  const existingTermSkills = creation.terms.at(-1)?.skills ?? []
  const nextSkill = characteristic
    ? rawSkill
    : (pendingCascadeSkill ?? normalizedSkill)
  if (!nextSkill) {
    return err(commandError('invalid_command', 'Rolled skill is not valid'))
  }

  return ok({
    termSkill: {
      career,
      table,
      roll: {
        expression: roll.expression,
        rolls: [...roll.rolls],
        total: roll.total
      },
      tableRoll: roll.total,
      rawSkill,
      skill: normalizedSkill,
      characteristic,
      pendingCascadeSkill
    },
    termSkills: uniqueSkills([...existingTermSkills, nextSkill]),
    skillsAndTraining: uniqueSkills([...existingSkills, nextSkill]),
    pendingCascadeSkills: uniqueSkills([
      ...(creation.pendingCascadeSkills ?? []),
      ...(pendingCascadeSkill ? [pendingCascadeSkill] : [])
    ])
  })
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
        kind === 'material' && benefit.value !== '-' ? benefit.value : null
    }
  })
}

export const deriveEventsForCommand = (
  command: GameCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const expectedSeq = validateExpectedSeq(command, context.currentSeq)
  if (!expectedSeq.ok) return expectedSeq
  if (
    context.state &&
    'characterId' in command &&
    command.type !== 'CreateCharacter' &&
    command.characterId !== null &&
    command.characterId !== undefined
  ) {
    const character = context.state.characters[command.characterId]
    if (
      character &&
      !canMutateCharacter(context.state, character, command.actorId)
    ) {
      return notAllowed(
        'Only the character owner or referee can change this character'
      )
    }
  }
  const rollEventId = asEventId(`${command.gameId}:${context.nextSeq}`)

  switch (command.type) {
    case 'CreateGame': {
      return deriveGameCommandEvents(command, context)
    }

    case 'CreateCharacter': {
      return deriveCharacterCommandEvents(command, context)
    }

    case 'UpdateCharacterSheet': {
      return deriveCharacterCommandEvents(command, context)
    }

    case 'FinalizeCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'StartCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'AdvanceCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
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

    case 'CompleteCharacterCreationBasicTraining': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'CompleteCharacterCreationHomeworld': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationQualification':
    case 'ResolveCharacterCreationDraft':
    case 'EnterCharacterCreationDrifter': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationSurvival': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationCommission':
    case 'SkipCharacterCreationCommission':
    case 'ResolveCharacterCreationAdvancement':
    case 'SkipCharacterCreationAdvancement': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationAging':
    case 'ResolveCharacterCreationAgingLosses':
    case 'ResolveCharacterCreationMishap':
    case 'ConfirmCharacterCreationDeath':
    case 'DecideCharacterCreationAnagathics':
    case 'ResolveCharacterCreationReenlistment':
    case 'ReenlistCharacterCreationCareer':
    case 'LeaveCharacterCreationCareer': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'RollCharacterCreationTermSkill': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateTermSkillRoll(character, command.table)
      if (!creation.ok) return creation

      const rolled = rollDiceExpression(
        '1d6',
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      const resolved = resolveTermSkillCreationEvent({
        creation: creation.value,
        table: command.table,
        roll: {
          expression: '1d6',
          rolls: rolled.value.rolls,
          total: rolled.value.total
        }
      })
      if (!resolved.ok) return resolved

      const afterRollCount = activeTermSkillCount(creation.value) + 1
      const nextState =
        afterRollCount >= requiredTermSkillCount(creation.value) &&
        resolved.value.pendingCascadeSkills.length === 0
          ? transitionCareerCreationState(creation.value.state, {
              type: 'COMPLETE_SKILLS'
            })
          : creation.value.state

      return ok([
        {
          type: 'DiceRolled',
          expression: '1d6',
          reason: `${resolved.value.termSkill.career} ${command.table}`,
          rolls: [...resolved.value.termSkill.roll.rolls],
          total: resolved.value.termSkill.roll.total
        },
        {
          type: 'CharacterCreationTermSkillRolled',
          characterId: command.characterId,
          rollEventId,
          ...resolved.value,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'CompleteCharacterCreationSkills': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateSkillsCompletion(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'COMPLETE_SKILLS'
      })

      return ok([
        {
          type: 'CharacterCreationSkillsCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationTermCascadeSkill': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      if (character.creation.state.status !== 'SKILLS_TRAINING') {
        return err(
          commandError(
            'invalid_command',
            `TERM_CASCADE_SKILL is not valid from ${character.creation.state.status}`
          )
        )
      }
      const cascadeSkill = normalizeBackgroundSkill(command.cascadeSkill)
      if (!cascadeSkill.ok) return cascadeSkill
      const selection = requireNonEmptyString(command.selection, 'selection')
      if (!selection.ok) return selection
      if (
        !(character.creation.pendingCascadeSkills ?? []).includes(
          cascadeSkill.value
        )
      ) {
        return err(
          commandError('missing_entity', 'Pending cascade skill does not exist')
        )
      }

      const term = character.creation.terms.at(-1)
      const resolution = resolveCascadeCareerSkill({
        pendingCascadeSkills: character.creation.pendingCascadeSkills ?? [],
        termSkills: [],
        cascadeSkill: cascadeSkill.value,
        selection: selection.value
      })
      const termSkills = uniqueSkills([
        ...(term?.skills ?? []).filter((skill) => skill !== cascadeSkill.value),
        ...resolution.termSkills
      ])
      const skillsAndTraining = uniqueSkills([
        ...(term?.skillsAndTraining ?? []).filter(
          (skill) => skill !== cascadeSkill.value
        ),
        ...resolution.termSkills
      ])

      return ok([
        {
          type: 'CharacterCreationTermCascadeSkillResolved',
          characterId: command.characterId,
          cascadeSkill: cascadeSkill.value,
          selection: selection.value,
          termSkills,
          skillsAndTraining,
          pendingCascadeSkills: uniqueSkills(resolution.pendingCascadeSkills)
        }
      ])
    }

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

    case 'CompleteCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'SetCharacterCreationHomeworld':
    case 'SelectCharacterCreationBackgroundSkill':
    case 'ResolveCharacterCreationCascadeSkill': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'StartCharacterCareerTerm': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'CreateBoard': {
      return deriveBoardCommandEvents(command, context)
    }

    case 'SelectBoard':
    case 'SetDoorOpen':
    case 'CreatePiece':
    case 'MovePiece':
    case 'SetPieceVisibility':
    case 'SetPieceFreedom': {
      return deriveBoardCommandEvents(command, context)
    }

    case 'RollDice': {
      return deriveDiceCommandEvents(command, context)
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
