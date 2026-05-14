import type { GameCommand } from '../../shared/commands'
import {
  canRollCashBenefit,
  careerSkillWithLevel,
  deriveAgingRollModifier,
  availableCareerNames,
  deriveCashBenefitRollModifier,
  deriveBasicTrainingPlan,
  deriveCareerQualificationDm,
  deriveCareerCreationReenlistmentOutcome,
  deriveFailedQualificationOptions,
  deriveRemainingCareerBenefits,
  deriveMaterialBenefitRollModifier,
  deriveSurvivalPromotionOptions,
  evaluateCareerCheck,
  deriveBackgroundSkillPlan,
  deriveTotalBackgroundSkillAllowance,
  hasBackgroundHomeworld,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  parseCareerRankReward,
  resolveCareerBenefit,
  resolveAging,
  resolveAgingLosses,
  resolveCareerSkillTableRoll,
  resolveCascadeCareerSkill,
  resolveDraftCareer,
  resolveAnagathicsUse,
  resolveReenlistment,
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
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  CharacterCreationSheet,
  CharacterState
} from '../../shared/state'
import type { CommandError } from '../../shared/protocol'
import {
  loadCharacterCreationCommandContext,
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction,
  requireNoBlockingCharacterCreationDecisions,
  requireNoPendingCharacterCreationDecisions
} from './character-creation-command-helpers'
import { deriveBoardCommandEvents } from './board-command-handlers'
import { deriveCharacterCommandEvents } from './character-command-handlers'
import { deriveCharacterCreationSetupEvents } from './character-creation-command-handlers'
import {
  canMutateCharacter,
  commandError,
  isReferee,
  notAllowed,
  requireFiniteCoordinate,
  requireFiniteOrNull,
  requireGame,
  requireNonEmptyString,
  type CommandContext,
  validateExpectedSeq
} from './command-helpers'
import { deriveDiceCommandEvents } from './dice-command-handlers'
import { deriveGameCommandEvents } from './game-command-handlers'

export type { CommandContext } from './command-helpers'

const normalizeHomeworld = (
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

const backgroundSelectionCount = (
  creation: CharacterCreationProjection
): number =>
  (creation.backgroundSkills ?? []).length +
  (creation.pendingCascadeSkills ?? []).length

const requiredBackgroundSelectionCount = (character: CharacterState): number =>
  hasBackgroundHomeworld(character.creation?.homeworld)
    ? deriveTotalBackgroundSkillAllowance(character.characteristics.edu)
    : 0

const backgroundSkillAllowance = (character: CharacterState): number =>
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

const requireHomeworldCreation = (
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

const derivedCreationNotes = (character: CharacterState): string => {
  const creation = character.creation
  if (!creation) return character.notes
  const notes = character.notes.trim() ? [character.notes.trim()] : []

  if (creation.history && creation.history.length > 0) {
    notes.push('Rules source: Cepheus Engine SRD.')
    for (const [index, term] of creation.terms.entries()) {
      const survival =
        creation.history.some((event) => event.type === 'SURVIVAL_FAILED') &&
        index === creation.terms.length - 1
          ? 'mishap'
          : 'survived'
      notes.push(`Term ${index + 1}: ${term.career}, ${survival}.`)
    }
  }

  return notes.join('\n')
}

const deriveCharacterCreationSheet = (
  character: CharacterState
): CharacterCreationSheet => {
  const creation = character.creation
  const creationSkills = uniqueSkills([
    ...(creation?.backgroundSkills ?? []),
    ...(creation?.terms.flatMap((term) => term.skillsAndTraining) ?? []),
    ...character.skills
  ])

  return {
    notes: derivedCreationNotes(character),
    age: character.age,
    characteristics: { ...character.characteristics },
    skills: creationSkills,
    equipment: character.equipment.map((item) => ({ ...item })),
    credits: character.credits
  }
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

const validateCharacterCreationSheet = (
  sheet: CharacterCreationSheet
): Result<void, CommandError> => {
  if (typeof sheet.notes !== 'string') {
    return err(commandError('invalid_command', 'notes must be a string'))
  }
  const age = requireFiniteOrNull(sheet.age, 'age')
  if (!age.ok) return age

  for (const [key, value] of Object.entries(sheet.characteristics)) {
    const characteristic = requireFiniteOrNull(value, `characteristics.${key}`)
    if (!characteristic.ok) return characteristic
  }

  for (const [index, skill] of sheet.skills.entries()) {
    const value = requireNonEmptyString(skill, `skills[${index}]`)
    if (!value.ok) return value
  }

  for (const [index, item] of sheet.equipment.entries()) {
    const name = requireNonEmptyString(item.name, `equipment[${index}].name`)
    if (!name.ok) return name
    const quantity = requireFiniteCoordinate(
      item.quantity,
      `equipment[${index}].quantity`
    )
    if (!quantity.ok) return quantity
  }

  const credits = requireFiniteCoordinate(sheet.credits, 'credits')
  if (!credits.ok) return credits

  return ok(undefined)
}

const validateCreationCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }

  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['completeCreation'],
    'CREATION_COMPLETE is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateBasicTrainingCompletion = (
  character: CharacterState
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
    'COMPLETE_BASIC_TRAINING is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const deriveBasicTrainingSkills = (
  creation: CharacterCreationProjection,
  selectedSkill?: string
): Result<string[], CommandError> => {
  const currentTerm = creation.terms.at(-1)
  if (!currentTerm) {
    return err(commandError('invalid_command', 'No active career term exists'))
  }
  if (currentTerm.skillsAndTraining.length > 0) {
    return ok([...currentTerm.skillsAndTraining])
  }

  const previousTerms = creation.terms.slice(0, -1)
  const plan = deriveBasicTrainingPlan({
    career: currentTerm.career,
    serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
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

const validateHomeworldCompletion = (
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

const validateCareerSelection = (
  character: CharacterState
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
    'CAREER_SELECTION is blocked by unresolved character creation decisions'
  )
  if (!decisions.ok) return decisions
  const legalAction = requireLegalCharacterCreationAction(
    character.creation,
    ['selectCareer'],
    'CAREER_SELECTION is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction
  if (character.creation.terms.length >= 7) {
    return err(commandError('invalid_command', 'Maximum terms reached'))
  }

  return ok(character.creation)
}

const validateQualificationResolution = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  const creation = validateCareerSelection(character)
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
  career: string
): Result<void, CommandError> => {
  if (!CEPHEUS_SRD_RULESET.careerBasics[career]) {
    return err(
      commandError('invalid_command', `Career ${career} is not supported`)
    )
  }
  const available = availableCareerNames(
    CEPHEUS_SRD_RULESET.careerBasics,
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

const validateMishapResolution = (
  character: CharacterState
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
    'MISHAP_RESOLVED is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateDeathConfirmation = (
  character: CharacterState
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
    'DEATH_CONFIRMED is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateSurvivalResolution = (
  character: CharacterState
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
    'SURVIVAL is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

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

const validateAgingResolution = (
  character: CharacterState
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
    'AGING is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

const validateAnagathicsDecision = (
  character: CharacterState
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
    'ANAGATHICS_DECISION is blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
}

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

const validateAgingLossResolution = (
  character: CharacterState
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
    'AGING_LOSSES are blocked by unresolved character creation decisions'
  )
  if (!legalAction.ok) return legalAction

  return ok(character.creation)
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

type CharacterCreationSurvivalResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationSurvivalResolved' }
>

type CharacterCreationCommissionResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationCommissionResolved' }
>

type CharacterCreationAdvancementResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationAdvancementResolved' }
>

type CharacterCreationAgingResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationAgingResolved' }
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

type CharacterCreationTermSkillRolledEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationTermSkillRolled' }
>

type CharacterCreationMusteringBenefitRolledEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationMusteringBenefitRolled' }
>

type CharacterCreationQualificationResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationQualificationResolved' }
>

type CharacterCreationDraftResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationDraftResolved' }
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

const resolveSurvivalCreationEvent = ({
  character,
  creation,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
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

  const basics = CEPHEUS_SRD_RULESET.careerBasics[career]
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
        currentCareerRank(creation, career)
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

const resolveQualificationCreationEvent = ({
  character,
  creation,
  career,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
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
  const basics = CEPHEUS_SRD_RULESET.careerBasics[career]
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
  roll
}: {
  roll: { expression: '1d6'; rolls: number[]; total: number }
}): Result<
  Pick<CharacterCreationDraftResolvedEvent, 'draft'>,
  CommandError
> => {
  const draft = resolveDraftCareer({
    table: CEPHEUS_SRD_RULESET.theDraft,
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

  const previousRank = currentCareerRank(creation, career)
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

const currentAgingAge = (
  character: CharacterState,
  creation: CharacterCreationProjection
): number | null => {
  if (character.age !== null) return character.age
  if (creation.terms.length === 0) return character.age

  return 18 + Math.max(0, creation.terms.length - 1) * 4
}

const resolveAgingCreationEvent = ({
  character,
  creation,
  roll
}: {
  character: CharacterState
  creation: CharacterCreationProjection
  roll: { expression: '2d6'; rolls: number[]; total: number }
}): Pick<CharacterCreationAgingResolvedEvent, 'aging'> => {
  const modifier = deriveAgingRollModifier(creation.terms)
  const aging = resolveAging({
    currentAge: currentAgingAge(character, creation),
    table: CEPHEUS_SRD_RULESET.aging,
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
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!character.creation) {
        return err(
          commandError(
            'missing_entity',
            'Character creation has not been started'
          )
        )
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can finalize character creation'
        )
      }
      const creation = validateCreationCompletion(character)
      if (!creation.ok) return creation
      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'CREATION_COMPLETE'
      })
      const serverSheet = deriveCharacterCreationSheet(character)
      const sheet = validateCharacterCreationSheet(serverSheet)
      if (!sheet.ok) return sheet

      return ok([
        {
          type: 'CharacterCreationCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        },
        {
          type: 'CharacterCreationFinalized',
          characterId: command.characterId,
          ...serverSheet
        }
      ])
    }

    case 'StartCharacterCreation': {
      return deriveCharacterCreationSetupEvents(command, context)
    }

    case 'AdvanceCharacterCreation': {
      return deriveCharacterCreationSetupEvents(command, context)
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
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateBasicTrainingCompletion(character)
      if (!creation.ok) return creation
      const trainingSkills = deriveBasicTrainingSkills(
        creation.value,
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

    case 'CompleteCharacterCreationHomeworld': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateHomeworldCompletion(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'COMPLETE_HOMEWORLD'
      })

      return ok([
        {
          type: 'CharacterCreationHomeworldCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        }
      ])
    }

    case 'ResolveCharacterCreationQualification': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateQualificationResolution(character)
      if (!creation.ok) return creation
      const career = requireNonEmptyString(command.career, 'career')
      if (!career.ok) return career
      const selectable = validateCareerCanBeSelected(
        creation.value,
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
      const creation = validateCareerSelection(character)
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
      const creation = validateCareerSelection(character)
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

    case 'ResolveCharacterCreationSurvival': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateSurvivalResolution(character)
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

    case 'ResolveCharacterCreationMishap': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = validateMishapResolution(character)
      if (!creation.ok) return creation
      const creationEvent = { type: 'MISHAP_RESOLVED' } as const

      const nextState = transitionCareerCreationState(
        creation.value.state,
        creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationMishapResolved',
          characterId: command.characterId,
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
      const creation = validateDeathConfirmation(character)
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

      const resolved = resolveAnagathicsUse({
        term: activeTerm,
        survived: command.useAnagathics
      })

      return ok([
        {
          type: 'CharacterCreationAnagathicsDecided',
          characterId: command.characterId,
          useAnagathics: resolved.term.anagathics,
          termIndex,
          state: structuredClone(creation.value.state),
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
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { state, character } = loaded.value
      if (!canMutateCharacter(state, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can complete character creation'
        )
      }
      const creation = validateCreationCompletion(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'CREATION_COMPLETE'
      })
      const serverSheet = deriveCharacterCreationSheet(character)
      const sheet = validateCharacterCreationSheet(serverSheet)
      if (!sheet.ok) return sheet

      return ok([
        {
          type: 'CharacterCreationCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: deriveCareerCreationComplete(nextState)
        },
        {
          type: 'CharacterCreationFinalized',
          characterId: command.characterId,
          ...serverSheet
        }
      ])
    }

    case 'SetCharacterCreationHomeworld': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      if (character.creation.state.status !== 'HOMEWORLD') {
        return notAllowed(
          `Homeworld cannot be set from ${character.creation.state.status}`
        )
      }
      const homeworld = normalizeHomeworld(command.homeworld)
      if (!homeworld.ok) return homeworld
      const backgroundPlan = deriveBackgroundSkillPlan({
        edu: character.characteristics.edu,
        homeworld: homeworld.value,
        rules: CEPHEUS_SRD_RULESET
      })
      const allowance = backgroundSkillAllowance(character)

      return ok([
        {
          type: 'CharacterCreationHomeworldSet',
          characterId: command.characterId,
          homeworld: homeworld.value,
          backgroundSkills: backgroundPlan.backgroundSkills,
          backgroundSkillAllowance: allowance,
          pendingCascadeSkills: backgroundPlan.pendingCascadeSkills
        }
      ])
    }

    case 'SelectCharacterCreationBackgroundSkill': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = requireHomeworldCreation(character)
      if (!creation.ok) return creation
      if (
        backgroundSelectionCount(creation.value) >=
        requiredBackgroundSelectionCount(character)
      ) {
        return err(
          commandError('invalid_command', 'Background skill allowance is full')
        )
      }
      const skill = normalizeBackgroundSkill(command.skill)
      if (!skill.ok) return skill

      const backgroundSkills = [...(creation.value.backgroundSkills ?? [])]
      const pendingCascadeSkills = [
        ...(creation.value.pendingCascadeSkills ?? [])
      ]
      if (isCascadeCareerSkill(command.skill.trim())) {
        pendingCascadeSkills.push(skill.value)
      } else {
        backgroundSkills.push(skill.value)
      }

      return ok([
        {
          type: 'CharacterCreationBackgroundSkillSelected',
          characterId: command.characterId,
          skill: skill.value,
          backgroundSkills: uniqueSkills(backgroundSkills),
          backgroundSkillAllowance:
            creation.value.backgroundSkillAllowance ??
            backgroundSkillAllowance(character),
          pendingCascadeSkills: uniqueSkills(pendingCascadeSkills)
        }
      ])
    }

    case 'ResolveCharacterCreationCascadeSkill': {
      const loaded = loadCharacterCreationCommandContext(
        context.state,
        command.characterId
      )
      if (!loaded.ok) return loaded
      const { character } = loaded.value
      const creation = requireHomeworldCreation(character)
      if (!creation.ok) return creation
      const cascadeSkill = normalizeBackgroundSkill(command.cascadeSkill)
      if (!cascadeSkill.ok) return cascadeSkill
      const selection = requireNonEmptyString(command.selection, 'selection')
      if (!selection.ok) return selection
      if (
        !(creation.value.pendingCascadeSkills ?? []).includes(
          cascadeSkill.value
        )
      ) {
        return err(
          commandError('missing_entity', 'Pending cascade skill does not exist')
        )
      }

      const resolution = resolveCascadeCareerSkill({
        pendingCascadeSkills: creation.value.pendingCascadeSkills ?? [],
        backgroundSkills: creation.value.backgroundSkills ?? [],
        cascadeSkill: cascadeSkill.value,
        selection: selection.value,
        basicTraining: true
      })

      return ok([
        {
          type: 'CharacterCreationCascadeSkillResolved',
          characterId: command.characterId,
          cascadeSkill: cascadeSkill.value,
          selection: selection.value,
          backgroundSkills: uniqueSkills(resolution.backgroundSkills),
          backgroundSkillAllowance:
            creation.value.backgroundSkillAllowance ??
            backgroundSkillAllowance(character),
          pendingCascadeSkills: uniqueSkills(resolution.pendingCascadeSkills)
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
      const creation = validateCareerSelection(character)
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
