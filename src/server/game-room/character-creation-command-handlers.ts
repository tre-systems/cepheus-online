import {
  availableCareerNames,
  careerSkillWithLevel,
  createCareerCreationState,
  deriveBackgroundSkillPlan,
  deriveBasicTrainingPlan,
  deriveCareerCreationComplete,
  deriveCareerQualificationDm,
  deriveFailedQualificationOptions,
  deriveTotalBackgroundSkillAllowance,
  deriveSurvivalPromotionOptions,
  evaluateCareerCheck,
  hasBackgroundHomeworld,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  parseCareerRankReward,
  resolveCascadeCareerSkill,
  resolveDraftCareer,
  transitionCareerCreationState
} from '../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import type { GameCommand } from '../../shared/commands'
import { rollDiceExpression } from '../../shared/dice'
import type { GameEvent } from '../../shared/events'
import { asEventId } from '../../shared/ids'
import { deriveEventRng } from '../../shared/prng'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import type {
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  CharacterCreationSheet,
  CharacterState
} from '../../shared/state'
import {
  loadCharacterCreationCommandContext,
  requireCharacterCreationStatus,
  requireLegalCharacterCreationAction,
  requireNoPendingCharacterCreationDecisions
} from './character-creation-command-helpers'
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireFiniteCoordinate,
  requireFiniteOrNull,
  requireGame,
  requireNonEmptyString
} from './command-helpers'

export const GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE =
  'AdvanceCharacterCreation is deprecated; use semantic character creation commands'

type CharacterCreationSetupCommand = Extract<
  GameCommand,
  { type: 'StartCharacterCreation' | 'AdvanceCharacterCreation' }
>

type CharacterCreationFinalizationCommand = Extract<
  GameCommand,
  { type: 'FinalizeCharacterCreation' | 'CompleteCharacterCreation' }
>

type CharacterCreationHomeworldCommand = Extract<
  GameCommand,
  {
    type:
      | 'CompleteCharacterCreationHomeworld'
      | 'ResolveCharacterCreationCascadeSkill'
      | 'SelectCharacterCreationBackgroundSkill'
      | 'SetCharacterCreationHomeworld'
  }
>

type CharacterCreationBasicTrainingCommand = Extract<
  GameCommand,
  { type: 'CompleteCharacterCreationBasicTraining' }
>

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

type CharacterCreationSurvivalCommand = Extract<
  GameCommand,
  {
    type:
      | 'ConfirmCharacterCreationDeath'
      | 'ResolveCharacterCreationMishap'
      | 'ResolveCharacterCreationSurvival'
  }
>

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

type CharacterCreationCommand =
  | CharacterCreationSetupCommand
  | CharacterCreationFinalizationCommand
  | CharacterCreationHomeworldCommand
  | CharacterCreationBasicTrainingCommand
  | CharacterCreationCareerEntryCommand
  | CharacterCreationSurvivalCommand
  | CharacterCreationPromotionCommand

type CharacterCreationQualificationResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationQualificationResolved' }
>

type CharacterCreationDraftResolvedEvent = Extract<
  GameEvent,
  { type: 'CharacterCreationDraftResolved' }
>

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

const currentCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => creation.careers.find((entry) => entry.name === career)?.rank ?? 0

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

const deriveCompletionEvents = (
  characterId: CharacterCreationFinalizationCommand['characterId'],
  character: CharacterState
): Result<GameEvent[], CommandError> => {
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
      characterId,
      state: nextState,
      creationComplete: deriveCareerCreationComplete(nextState)
    },
    {
      type: 'CharacterCreationFinalized',
      characterId,
      ...serverSheet
    }
  ])
}

export const deriveCharacterCreationCommandEvents = (
  command: CharacterCreationCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const rollEventId = asEventId(`${command.gameId}:${context.nextSeq}`)

  switch (command.type) {
    case 'StartCharacterCreation': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can start character creation'
        )
      }
      if (character.creation) {
        return err(
          commandError(
            'duplicate_entity',
            'Character creation has already started'
          )
        )
      }

      return ok([
        {
          type: 'CharacterCreationStarted',
          characterId: command.characterId,
          creation: {
            state: createCareerCreationState(),
            terms: [],
            careers: [],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ])
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

      return deriveCompletionEvents(command.characterId, character)
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

      return deriveCompletionEvents(command.characterId, character)
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

    case 'AdvanceCharacterCreation': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can advance character creation'
        )
      }
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed(
          'Only the referee can use generic character creation advance'
        )
      }
      if (!character.creation) {
        return err(
          commandError(
            'missing_entity',
            'Character creation has not been started'
          )
        )
      }
      return err(
        commandError(
          'invalid_command',
          GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE
        )
      )
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled character creation command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
