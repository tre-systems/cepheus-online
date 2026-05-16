import {
  deriveBasicTrainingPlan,
  deriveCareerCreationComplete,
  normalizeCareerSkill,
  transitionCareerCreationState
} from '../../../shared/characterCreation'
import type { CepheusSrdRuleset } from '../../../shared/character-creation/cepheus-srd-ruleset'
import type { GameCommand } from '../../../shared/commands'
import type { GameEvent } from '../../../shared/events'
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

type CharacterCreationBasicTrainingCommand = Extract<
  GameCommand,
  { type: 'CompleteCharacterCreationBasicTraining' }
>

const validateBasicTrainingCompletion = (
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
    'BASIC_TRAINING',
    'COMPLETE_BASIC_TRAINING'
  )
  if (!status.ok) return status

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['completeBasicTraining'],
    'COMPLETE_BASIC_TRAINING is blocked by unresolved character creation decisions',
    ruleset
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const deriveBasicTrainingSkills = (
  creation: CharacterCreationProjection,
  ruleset: CepheusSrdRuleset,
  selectedSkill?: string
): Result<string[], CommandError> => {
  const currentTerm = creation.terms.at(-1)
  if (!currentTerm) {
    return err(commandError('invalid_command', 'No active career term exists'))
  }
  const hasSemanticTermFacts = Object.keys(currentTerm.facts ?? {}).length > 0
  if (hasSemanticTermFacts) {
    const trainingSkills = currentTerm.facts?.basicTrainingSkills
    if (trainingSkills && trainingSkills.length > 0) {
      return ok([...trainingSkills])
    }
  } else if (currentTerm.skillsAndTraining.length > 0) {
    return ok([...currentTerm.skillsAndTraining])
  }

  const previousTerms = creation.terms.slice(0, -1)
  const plan = deriveBasicTrainingPlan({
    career: currentTerm.career,
    serviceSkills: ruleset.serviceSkills,
    completedTermCount: previousTerms.length,
    previousCareerNames: previousTerms.map((term) => term.career)
  })

  if (plan.kind === 'all') {
    if (selectedSkill) {
      return err(
        commandError(
          'invalid_command',
          'Basic training skill choices are only valid for later career terms'
        )
      )
    }
    return ok(
      plan.skills
        .map((skill) => normalizeCareerSkill(skill, 0))
        .filter((skill): skill is string => skill !== null)
    )
  }
  if (plan.kind === 'none') {
    if (selectedSkill) {
      return err(
        commandError(
          'invalid_command',
          'This career term does not grant basic training'
        )
      )
    }
    return ok([])
  }

  const normalizedChoices = plan.skills
    .map((skill) => normalizeCareerSkill(skill, 0))
    .filter((skill): skill is string => skill !== null)
  const normalizedSelection = selectedSkill
    ? normalizeCareerSkill(selectedSkill, 0)
    : null
  if (
    !normalizedSelection ||
    !normalizedChoices.includes(normalizedSelection)
  ) {
    return err(
      commandError(
        'invalid_command',
        'Choose one valid basic training skill for this career term'
      )
    )
  }

  return ok([normalizedSelection])
}

export const deriveBasicTrainingCommandEvents = (
  command: CharacterCreationBasicTrainingCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const loaded = loadCharacterCreationCommandContext(
    context.state,
    command.characterId
  )
  if (!loaded.ok) return loaded
  const { character } = loaded.value
  const creation = validateBasicTrainingCompletion(character, context.ruleset)
  if (!creation.ok) return creation
  const trainingSkills = deriveBasicTrainingSkills(
    creation.value,
    context.ruleset,
    command.skill
  )
  if (!trainingSkills.ok) return trainingSkills

  const nextState = transitionCareerCreationState(creation.value.state, {
    type: 'COMPLETE_BASIC_TRAINING'
  })

  return ok([
    {
      type: 'CharacterCreationBasicTrainingCompleted',
      characterId: command.characterId,
      trainingSkills: trainingSkills.value,
      state: nextState,
      creationComplete: deriveCareerCreationComplete(nextState)
    }
  ])
}
