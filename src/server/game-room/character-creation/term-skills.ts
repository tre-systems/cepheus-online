import {
  careerSkillWithLevel,
  deriveCareerCreationActionContext,
  deriveCareerCreationComplete,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  resolveCascadeCareerSkill,
  resolveCareerSkillTableRoll,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import type { CareerCreationTermSkillTable } from '../../../shared/characterCreation'
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
  requireLegalCharacterCreationAction,
  requireCharacterCreationStatus,
  loadCharacterCreationCommandContext
} from '../character-creation-command-helpers'
import {
  commandError,
  type CommandContext,
  requireNonEmptyString
} from '../command-helpers'
import { normalizeBackgroundSkill } from './homeworld'
import { uniqueSkills } from './utils'

type CharacterCreationTermSkillRolledEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationTermSkillRolled' }
>

type CharacterCreationSkillCommand = Extract<
  GameCommand,
  {
    type:
      | 'CompleteCharacterCreationSkills'
      | 'ResolveCharacterCreationTermCascadeSkill'
      | 'RollCharacterCreationTermSkill'
  }
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

const hasSemanticTermFacts = (
  term: CharacterCreationProjection['terms'][number]
): boolean => Object.keys(term.facts ?? {}).length > 0

const termSkillFactValue = (
  termSkill: NonNullable<
    NonNullable<
      CharacterCreationProjection['terms'][number]['facts']
    >['termSkillRolls']
  >[number]
): string | null =>
  termSkill.characteristic
    ? termSkill.rawSkill
    : (termSkill.pendingCascadeSkill ?? termSkill.skill)

const deriveTermSkillFacts = (
  term: CharacterCreationProjection['terms'][number]
): string[] => {
  const skills = (term.facts?.termSkillRolls ?? []).flatMap((termSkill) => {
    const skill = termSkillFactValue(termSkill)
    return skill ? [skill] : []
  })

  for (const selection of term.facts?.termCascadeSelections ?? []) {
    const index = skills.indexOf(selection.cascadeSkill)
    if (index >= 0) {
      skills[index] = selection.selection
      continue
    }
    skills.push(selection.selection)
  }

  return uniqueSkills(skills)
}

const deriveTrainingSkillsFromFacts = (
  term: CharacterCreationProjection['terms'][number]
): string[] =>
  uniqueSkills([
    ...(term.facts?.basicTrainingSkills ?? []),
    ...deriveTermSkillFacts(term)
  ])

export const requiredTermSkillCount = (
  creation: CharacterCreationProjection
): number => {
  if (creation.requiredTermSkillCount !== undefined) {
    return creation.requiredTermSkillCount
  }

  const term = creation.terms.at(-1)
  if (
    !term ||
    (term.facts?.survival === undefined && term.survival === undefined)
  ) {
    return 0
  }

  return !creation.state.context.canCommission &&
    !creation.state.context.canAdvance
    ? 2
    : 1
}

export const activeTermSkillCount = (
  creation: CharacterCreationProjection
): number => {
  const term = creation.terms.at(-1)
  if (!term) return 0

  return hasSemanticTermFacts(term)
    ? (term.facts?.termSkillRolls?.length ?? 0)
    : term.skills.length
}

const requireNoUnrelatedTermCascadeDecisions = (
  creation: CharacterCreationProjection
): Result<void, CommandError> => {
  const actionContext = deriveCareerCreationActionContext(creation)
  const blockingDecision = actionContext.pendingDecisions?.find(
    (decision) =>
      decision.key !== 'cascadeSkillResolution' &&
      decision.key !== 'skillTrainingSelection'
  )
  if (blockingDecision) {
    return err(
      commandError(
        'invalid_command',
        'TERM_CASCADE_SKILL is blocked by unresolved character creation decisions'
      )
    )
  }

  return ok(undefined)
}

export const validateTermSkillRoll = (
  character: CharacterState,
  table: string
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'SKILLS_TRAINING',
    'TERM_SKILL'
  )
  if (!status.ok) return status

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
  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['rollTermSkill'],
    'TERM_SKILL is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

export const validateSkillsCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  const status = requireCharacterCreationStatus(
    character.creation,
    'SKILLS_TRAINING',
    'COMPLETE_SKILLS'
  )
  if (!status.ok) return status

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
  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['completeSkills'],
    'COMPLETE_SKILLS is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

export const resolveTermSkillCreationEvent = ({
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

  const term = creation.terms.at(-1)
  const existingSkills = term
    ? hasSemanticTermFacts(term)
      ? deriveTrainingSkillsFromFacts(term)
      : term.skillsAndTraining
    : []
  const existingTermSkills = term
    ? hasSemanticTermFacts(term)
      ? deriveTermSkillFacts(term)
      : term.skills
    : []
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

export const deriveSkillCommandEvents = (
  command: CharacterCreationSkillCommand,
  context: CommandContext,
  rollEventId: EventId
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
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
      const noBlockingDecision = requireNoUnrelatedTermCascadeDecisions(
        character.creation
      )
      if (!noBlockingDecision.ok) return noBlockingDecision

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
      const existingTermSkills = term
        ? hasSemanticTermFacts(term)
          ? deriveTermSkillFacts(term)
          : term.skills
        : []
      const existingTrainingSkills = term
        ? hasSemanticTermFacts(term)
          ? deriveTrainingSkillsFromFacts(term)
          : term.skillsAndTraining
        : []
      const termSkills = uniqueSkills([
        ...existingTermSkills.filter((skill) => skill !== cascadeSkill.value),
        ...resolution.termSkills
      ])
      const skillsAndTraining = uniqueSkills([
        ...existingTrainingSkills.filter((skill) => skill !== cascadeSkill.value),
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
  }
}
