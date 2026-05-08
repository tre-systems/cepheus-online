import type { Command, GameCommand } from '../../shared/commands'
import {
  canRollCashBenefit,
  canTransitionCareerCreationState,
  createCareerCreationState,
  careerSkillWithLevel,
  deriveAgingRollModifier,
  availableCareerNames,
  deriveCashBenefitRollModifier,
  deriveBasicTrainingPlan,
  deriveCareerQualificationDm,
  deriveCareerCreationActionContext,
  deriveCareerCreationReenlistmentOutcome,
  deriveFailedQualificationOptions,
  deriveRemainingCareerBenefits,
  deriveMaterialBenefitRollModifier,
  deriveLegalCareerCreationActionKeysForProjection,
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
  transitionCareerCreationState
} from '../../shared/characterCreation'
import type { CareerCreationTermSkillTable } from '../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import { rollDiceExpression } from '../../shared/dice'
import type { GameEvent } from '../../shared/events'
import type { PieceId } from '../../shared/ids'
import { deriveEventRng } from '../../shared/prng'
import { err, ok, type Result } from '../../shared/result'
import type {
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  CharacterCreationSheet,
  CharacterState,
  GameState
} from '../../shared/state'
import type { CommandError } from '../../shared/protocol'

export interface CommandContext {
  state: GameState | null
  currentSeq: number
  nextSeq: number
  gameSeed: number
}

const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

const notAllowed = (message: string): Result<never, CommandError> =>
  err(commandError('not_allowed', message))

const requireGame = (
  state: GameState | null
): Result<GameState, CommandError> =>
  state
    ? ok(state)
    : err(commandError('game_not_found', 'Game has not been created'))

const requireFinitePositive = (
  value: number,
  label: string
): Result<number, CommandError> => {
  if (!Number.isFinite(value) || value <= 0) {
    return err(commandError('invalid_command', `${label} must be positive`))
  }

  return ok(value)
}

const requireFiniteCoordinate = (
  value: number,
  label: string
): Result<number, CommandError> => {
  if (!Number.isFinite(value)) {
    return err(commandError('invalid_command', `${label} must be finite`))
  }

  return ok(value)
}

const requireFiniteOrNull = (
  value: number | null,
  label: string
): Result<number | null, CommandError> => {
  if (value !== null && !Number.isFinite(value)) {
    return err(commandError('invalid_command', `${label} must be finite`))
  }

  return ok(value)
}

const requireNonEmptyString = (
  value: string,
  label: string
): Result<string, CommandError> => {
  if (!value.trim()) {
    return err(commandError('invalid_command', `${label} cannot be empty`))
  }

  return ok(value)
}

const isReferee = (state: GameState, actorId: Command['actorId']): boolean =>
  state.ownerId === actorId || state.players[actorId]?.role === 'REFEREE'

const canMutateCharacter = (
  state: GameState,
  character: CharacterState,
  actorId: Command['actorId']
): boolean =>
  isReferee(state, actorId) ||
  character.ownerId === null ||
  character.ownerId === actorId

const canMutatePiece = (
  state: GameState,
  pieceId: PieceId,
  actorId: Command['actorId']
): boolean => {
  if (isReferee(state, actorId)) return true
  const piece = state.pieces[pieceId]
  if (!piece) return false
  if (piece.freedom === 'SHARE') return true
  if (!piece.characterId) return piece.freedom !== 'LOCKED'

  const character = state.characters[piece.characterId]
  return Boolean(character && canMutateCharacter(state, character, actorId))
}

const validateExpectedSeq = (
  command: GameCommand,
  currentSeq: number
): Result<void, CommandError> => {
  if (!('expectedSeq' in command) || command.expectedSeq === undefined) {
    return ok(undefined)
  }

  if (command.expectedSeq !== currentSeq) {
    return err(
      commandError(
        'stale_command',
        `Expected sequence ${command.expectedSeq}, current sequence is ${currentSeq}`
      )
    )
  }

  return ok(undefined)
}

const validateCharacterSheetPatch = (
  command: Extract<Command, { type: 'UpdateCharacterSheet' }>
): Result<void, CommandError> => {
  if (command.notes !== undefined && typeof command.notes !== 'string') {
    return err(commandError('invalid_command', 'notes must be a string'))
  }
  if (command.age !== undefined) {
    const age = requireFiniteOrNull(command.age, 'age')
    if (!age.ok) return age
  }
  if (command.characteristics !== undefined) {
    for (const [key, value] of Object.entries(command.characteristics)) {
      const characteristic = requireFiniteOrNull(
        value,
        `characteristics.${key}`
      )
      if (!characteristic.ok) return characteristic
    }
  }
  if (command.skills !== undefined) {
    for (const [index, skill] of command.skills.entries()) {
      const value = requireNonEmptyString(skill, `skills[${index}]`)
      if (!value.ok) return value
    }
  }
  if (command.equipment !== undefined) {
    for (const [index, item] of command.equipment.entries()) {
      const name = requireNonEmptyString(item.name, `equipment[${index}].name`)
      if (!name.ok) return name
      const quantity = requireFiniteCoordinate(
        item.quantity,
        `equipment[${index}].quantity`
      )
      if (!quantity.ok) return quantity
    }
  }
  if (command.credits !== undefined) {
    const credits = requireFiniteCoordinate(command.credits, 'credits')
    if (!credits.ok) return credits
  }

  return ok(undefined)
}

const characterSheetPatchFields = (
  command: Extract<Command, { type: 'UpdateCharacterSheet' }>
) => ({
  ...(command.notes === undefined ? {} : { notes: command.notes }),
  ...(command.age === undefined ? {} : { age: command.age }),
  ...(command.characteristics === undefined
    ? {}
    : { characteristics: command.characteristics }),
  ...(command.skills === undefined ? {} : { skills: command.skills }),
  ...(command.equipment === undefined ? {} : { equipment: command.equipment }),
  ...(command.credits === undefined ? {} : { credits: command.credits })
})

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
  command: Extract<Command, { type: 'FinalizeCharacterCreation' }>
): Result<void, CommandError> => {
  if (typeof command.notes !== 'string') {
    return err(commandError('invalid_command', 'notes must be a string'))
  }
  const age = requireFiniteOrNull(command.age, 'age')
  if (!age.ok) return age

  for (const [key, value] of Object.entries(command.characteristics)) {
    const characteristic = requireFiniteOrNull(value, `characteristics.${key}`)
    if (!characteristic.ok) return characteristic
  }

  for (const [index, skill] of command.skills.entries()) {
    const value = requireNonEmptyString(skill, `skills[${index}]`)
    if (!value.ok) return value
  }

  for (const [index, item] of command.equipment.entries()) {
    const name = requireNonEmptyString(item.name, `equipment[${index}].name`)
    if (!name.ok) return name
    const quantity = requireFiniteCoordinate(
      item.quantity,
      `equipment[${index}].quantity`
    )
    if (!quantity.ok) return quantity
  }

  const credits = requireFiniteCoordinate(command.credits, 'credits')
  if (!credits.ok) return credits

  return ok(undefined)
}

const validateCharacterCreationAction = (
  character: CharacterState,
  command: Extract<Command, { type: 'AdvanceCharacterCreation' }>
): Result<void, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  const actionContext = deriveCareerCreationActionContext(character.creation)
  const event = command.creationEvent
  const legal =
    (event.type === 'FINISH_MUSTERING' &&
      event.musteringBenefit !== undefined &&
      character.creation.state.status === 'MUSTERING_OUT' &&
      actionContext.remainingMusteringBenefits !== undefined &&
      actionContext.remainingMusteringBenefits > 0) ||
    (event.type === 'FINISH_MUSTERING' &&
      event.musteringBenefit === undefined &&
      legalActions.includes('finishMustering')) ||
    (event.type === 'CREATION_COMPLETE' &&
      legalActions.includes('completeCreation'))

  if (!legal) {
    return err(
      commandError(
        'invalid_command',
        `${event.type} is blocked by unresolved character creation decisions`
      )
    )
  }

  return ok(undefined)
}

const semanticCommandForGenericCreationEvent = (
  event: Extract<Command, { type: 'AdvanceCharacterCreation' }>['creationEvent']
): string | null => {
  switch (event.type) {
    case 'SET_CHARACTERISTICS':
      return 'RollCharacterCreationCharacteristic'
    case 'SELECT_CAREER':
      return 'ResolveCharacterCreationQualification, ResolveCharacterCreationDraft, or EnterCharacterCreationDrifter'
    case 'SURVIVAL_PASSED':
    case 'SURVIVAL_FAILED':
      return 'ResolveCharacterCreationSurvival'
    case 'COMPLETE_COMMISSION':
      return 'ResolveCharacterCreationCommission'
    case 'COMPLETE_ADVANCEMENT':
      return 'ResolveCharacterCreationAdvancement'
    case 'DEATH_CONFIRMED':
      return 'ConfirmCharacterCreationDeath'
    case 'MISHAP_RESOLVED':
      return 'ResolveCharacterCreationMishap'
    case 'RESOLVE_REENLISTMENT':
      return 'ResolveCharacterCreationReenlistment'
    case 'REENLIST':
    case 'FORCED_REENLIST':
      return 'ReenlistCharacterCreationCareer'
    case 'LEAVE_CAREER':
    case 'REENLIST_BLOCKED':
      return 'LeaveCharacterCreationCareer'
    case 'CONTINUE_CAREER':
      return 'ContinueCharacterCreationAfterMustering'
    case 'FINISH_MUSTERING':
      return event.musteringBenefit
        ? 'RollCharacterCreationMusteringBenefit'
        : 'CompleteCharacterCreationMustering'
    default:
      return null
  }
}

const validateCreationCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('completeCreation')) {
    return err(
      commandError(
        'invalid_command',
        'CREATION_COMPLETE is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'BASIC_TRAINING') {
    return err(
      commandError(
        'invalid_command',
        `COMPLETE_BASIC_TRAINING is not valid from ${character.creation.state.status}`
      )
    )
  }

  const actionContext = deriveCareerCreationActionContext(character.creation)
  const blockingDecision = actionContext.pendingDecisions?.find(
    (decision) => decision.key !== 'basicTrainingSkillSelection'
  )
  if (blockingDecision) {
    return err(
      commandError(
        'invalid_command',
        'COMPLETE_BASIC_TRAINING is blocked by unresolved character creation decisions'
      )
    )
  }

  return ok(character.creation)
}

const deriveBasicTrainingSkills = (
  creation: CharacterCreationProjection
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
    return ok(
      plan.skills
        .map((skill) => normalizeCareerSkill(skill, 0))
        .filter((skill): skill is string => skill !== null)
    )
  }
  if (plan.kind === 'none') {
    return ok([])
  }

  return err(
    commandError(
      'invalid_command',
      'COMPLETE_BASIC_TRAINING is blocked by unresolved character creation decisions'
    )
  )
}

const validateHomeworldCompletion = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  if (character.creation.state.status !== 'HOMEWORLD') {
    return err(
      commandError(
        'invalid_command',
        `COMPLETE_HOMEWORLD is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('completeHomeworld')) {
    return err(
      commandError(
        'invalid_command',
        'COMPLETE_HOMEWORLD is blocked by unresolved character creation decisions'
      )
    )
  }
  if (!hasCompleteBackgroundChoices(character)) {
    return err(
      commandError(
        'invalid_command',
        'Background choices must be complete before career selection'
      )
    )
  }

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
  if (character.creation.state.status !== 'CAREER_SELECTION') {
    return err(
      commandError(
        'invalid_command',
        `CAREER_SELECTION is not valid from ${character.creation.state.status}`
      )
    )
  }
  const actionContext = deriveCareerCreationActionContext(character.creation)
  if ((actionContext.pendingDecisions?.length ?? 0) > 0) {
    return err(
      commandError(
        'invalid_command',
        'CAREER_SELECTION is blocked by unresolved character creation decisions'
      )
    )
  }
  if (character.creation.terms.length >= 7) {
    return err(commandError('invalid_command', 'Maximum terms reached'))
  }

  return ok(character.creation)
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

const validateSurvivalResolution = (
  character: CharacterState
): Result<CharacterCreationProjection, CommandError> => {
  if (!character.creation) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }
  if (character.creation.state.status !== 'SURVIVAL') {
    return err(
      commandError(
        'invalid_command',
        `SURVIVAL is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('rollSurvival')) {
    return err(
      commandError(
        'invalid_command',
        'SURVIVAL is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'COMMISSION') {
    return err(
      commandError(
        'invalid_command',
        `COMMISSION is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('rollCommission')) {
    return err(
      commandError(
        'invalid_command',
        'COMMISSION is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'COMMISSION') {
    return err(
      commandError(
        'invalid_command',
        `SKIP_COMMISSION is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('skipCommission')) {
    return err(
      commandError(
        'invalid_command',
        'SKIP_COMMISSION is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'ADVANCEMENT') {
    return err(
      commandError(
        'invalid_command',
        `ADVANCEMENT is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('rollAdvancement')) {
    return err(
      commandError(
        'invalid_command',
        'ADVANCEMENT is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'ADVANCEMENT') {
    return err(
      commandError(
        'invalid_command',
        `SKIP_ADVANCEMENT is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('skipAdvancement')) {
    return err(
      commandError(
        'invalid_command',
        'SKIP_ADVANCEMENT is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'AGING') {
    return err(
      commandError(
        'invalid_command',
        `AGING is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('resolveAging')) {
    return err(
      commandError(
        'invalid_command',
        'AGING is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'AGING') {
    return err(
      commandError(
        'invalid_command',
        `ANAGATHICS_DECISION is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('decideAnagathics')) {
    return err(
      commandError(
        'invalid_command',
        'ANAGATHICS_DECISION is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'REENLISTMENT') {
    return err(
      commandError(
        'invalid_command',
        `REENLISTMENT is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('rollReenlistment')) {
    return err(
      commandError(
        'invalid_command',
        'REENLISTMENT is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'REENLISTMENT') {
    return err(
      commandError(
        'invalid_command',
        `REENLIST is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (
    !legalActions.includes('reenlist') &&
    !legalActions.includes('forcedReenlist')
  ) {
    return err(
      commandError(
        'invalid_command',
        'REENLIST is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'REENLISTMENT') {
    return err(
      commandError(
        'invalid_command',
        `LEAVE_CAREER is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('leaveCareer')) {
    return err(
      commandError(
        'invalid_command',
        'LEAVE_CAREER is blocked by unresolved character creation decisions'
      )
    )
  }

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

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('resolveAging')) {
    return err(
      commandError(
        'invalid_command',
        'AGING_LOSSES are blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'MUSTERING_OUT') {
    return err(
      commandError(
        'invalid_command',
        `MUSTERING_BENEFIT is not valid from ${character.creation.state.status}`
      )
    )
  }

  const actionContext = deriveCareerCreationActionContext(character.creation)
  const blockingDecision = actionContext.pendingDecisions?.find(
    (decision) => decision.key !== 'musteringBenefitSelection'
  )
  if (blockingDecision) {
    return err(
      commandError(
        'invalid_command',
        'MUSTERING_BENEFIT is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'MUSTERING_OUT') {
    return err(
      commandError(
        'invalid_command',
        `FINISH_MUSTERING is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('finishMustering')) {
    return err(
      commandError(
        'invalid_command',
        'FINISH_MUSTERING is blocked by unresolved character creation decisions'
      )
    )
  }

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
  if (character.creation.state.status !== 'MUSTERING_OUT') {
    return err(
      commandError(
        'invalid_command',
        `CONTINUE_CAREER is not valid from ${character.creation.state.status}`
      )
    )
  }

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('continueCareer')) {
    return err(
      commandError(
        'invalid_command',
        'CONTINUE_CAREER is blocked by unresolved character creation decisions'
      )
    )
  }

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
    'passed' | 'survival' | 'canCommission' | 'canAdvance'
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

  switch (command.type) {
    case 'CreateGame': {
      if (context.state) {
        return err(commandError('game_exists', 'Game already exists'))
      }

      return ok([
        {
          type: 'GameCreated',
          slug: command.slug,
          name: command.name,
          ownerId: command.actorId
        }
      ])
    }

    case 'CreateCharacter': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (state.value.characters[command.characterId]) {
        return err(commandError('duplicate_entity', 'Character already exists'))
      }

      return ok([
        {
          type: 'CharacterCreated',
          characterId: command.characterId,
          ownerId: command.actorId,
          characterType: command.characterType,
          name: command.name
        }
      ])
    }

    case 'UpdateCharacterSheet': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can edit a sheet'
        )
      }
      const patch = validateCharacterSheetPatch(command)
      if (!patch.ok) return patch

      return ok([
        {
          type: 'CharacterSheetUpdated',
          characterId: command.characterId,
          ...characterSheetPatchFields(command)
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
      if (character.creation.state.status !== 'PLAYABLE') {
        return err(
          commandError(
            'invalid_command',
            `Character creation cannot finalize from ${character.creation.state.status}`
          )
        )
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can finalize character creation'
        )
      }
      const serverSheet = deriveCharacterCreationSheet(character)
      const sheet = validateCharacterCreationSheet({
        ...command,
        ...serverSheet
      })
      if (!sheet.ok) return sheet

      return ok([
        {
          type: 'CharacterCreationFinalized',
          characterId: command.characterId,
          ...serverSheet
        }
      ])
    }

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
      const semanticCommand = semanticCommandForGenericCreationEvent(
        command.creationEvent
      )
      if (semanticCommand) {
        return err(
          commandError(
            'invalid_command',
            `${command.creationEvent.type} must use ${semanticCommand}`
          )
        )
      }
      if (command.creationEvent.type === 'COMPLETE_HOMEWORLD') {
        return err(
          commandError(
            'invalid_command',
            'COMPLETE_HOMEWORLD must use CompleteCharacterCreationHomeworld'
          )
        )
      }
      if (command.creationEvent.type === 'COMPLETE_BASIC_TRAINING') {
        return err(
          commandError(
            'invalid_command',
            'COMPLETE_BASIC_TRAINING must use CompleteCharacterCreationBasicTraining'
          )
        )
      }
      if (command.creationEvent.type === 'COMPLETE_SKILLS') {
        return err(
          commandError(
            'invalid_command',
            'COMPLETE_SKILLS must use CompleteCharacterCreationSkills'
          )
        )
      }
      if (command.creationEvent.type === 'COMPLETE_AGING') {
        return err(
          commandError(
            'invalid_command',
            'COMPLETE_AGING must use ResolveCharacterCreationAging'
          )
        )
      }
      if (command.creationEvent.type === 'CREATION_COMPLETE') {
        return err(
          commandError(
            'invalid_command',
            'CREATION_COMPLETE must use CompleteCharacterCreation'
          )
        )
      }
      if (command.creationEvent.type === 'SKIP_COMMISSION') {
        return err(
          commandError(
            'invalid_command',
            'SKIP_COMMISSION must use SkipCharacterCreationCommission'
          )
        )
      }
      if (command.creationEvent.type === 'SKIP_ADVANCEMENT') {
        return err(
          commandError(
            'invalid_command',
            'SKIP_ADVANCEMENT must use SkipCharacterCreationAdvancement'
          )
        )
      }
      if (
        !canTransitionCareerCreationState(
          character.creation.state,
          command.creationEvent
        )
      ) {
        if (
          character.creation.state.status === 'PLAYABLE' ||
          character.creation.state.status === 'DECEASED'
        ) {
          return notAllowed(
            `${command.creationEvent.type} is not valid from ${character.creation.state.status}`
          )
        }

        return err(
          commandError(
            'invalid_command',
            `${command.creationEvent.type} is not valid from ${character.creation.state.status}`
          )
        )
      }
      if (command.creationEvent.type === 'FINISH_MUSTERING') {
        const action = validateCharacterCreationAction(character, command)
        if (!action.ok) return action
      }

      const nextState = transitionCareerCreationState(
        character.creation.state,
        command.creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationTransitioned',
          characterId: command.characterId,
          creationEvent: command.creationEvent,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'RollCharacterCreationCharacteristic': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can roll character creation'
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
      const events: GameEvent[] = [
        {
          type: 'DiceRolled',
          expression: '2d6',
          reason: `${command.characteristic.toUpperCase()} characteristic`,
          rolls: [...rolled.value.rolls],
          total: rolled.value.total
        },
        {
          type: 'CharacterSheetUpdated',
          characterId: command.characterId,
          characteristics: {
            [command.characteristic]: rolled.value.total
          }
        }
      ]

      if (complete) {
        const nextState = transitionCareerCreationState(
          character.creation.state,
          { type: 'SET_CHARACTERISTICS' }
        )
        events.push({
          type: 'CharacterCreationCharacteristicsCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        })
      }

      return ok(events)
    }

    case 'CompleteCharacterCreationBasicTraining': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      const creation = validateBasicTrainingCompletion(character)
      if (!creation.ok) return creation
      const trainingSkills = deriveBasicTrainingSkills(creation.value)
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'CompleteCharacterCreationHomeworld': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationQualification': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      const creation = validateCareerSelection(character)
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationDraft': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'EnterCharacterCreationDrifter': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationSurvival': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationCommission': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'SkipCharacterCreationCommission': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationAdvancement': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'SkipCharacterCreationAdvancement': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationAging': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationAgingLosses': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
      const creationEvent = { type: 'MISHAP_RESOLVED' } as const
      if (
        !canTransitionCareerCreationState(
          character.creation.state,
          creationEvent
        )
      ) {
        return err(
          commandError(
            'invalid_command',
            `MISHAP_RESOLVED is not valid from ${character.creation.state.status}`
          )
        )
      }

      const nextState = transitionCareerCreationState(
        character.creation.state,
        creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationMishapResolved',
          characterId: command.characterId,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ConfirmCharacterCreationDeath': {
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
      const creationEvent = { type: 'DEATH_CONFIRMED' } as const
      if (
        !canTransitionCareerCreationState(
          character.creation.state,
          creationEvent
        )
      ) {
        return err(
          commandError(
            'invalid_command',
            `DEATH_CONFIRMED is not valid from ${character.creation.state.status}`
          )
        )
      }

      const nextState = transitionCareerCreationState(
        character.creation.state,
        creationEvent
      )

      return ok([
        {
          type: 'CharacterCreationDeathConfirmed',
          characterId: command.characterId,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'DecideCharacterCreationAnagathics': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
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
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ReenlistCharacterCreationCareer': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        } satisfies CharacterCreationCareerReenlistedEvent
      ])
    }

    case 'LeaveCharacterCreationCareer': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        } satisfies CharacterCreationCareerLeftEvent
      ])
    }

    case 'RollCharacterCreationTermSkill': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'CompleteCharacterCreationSkills': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ResolveCharacterCreationTermCascadeSkill': {
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
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          ...resolved.value,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'ContinueCharacterCreationAfterMustering': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'CompleteCharacterCreationMustering': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'CompleteCharacterCreation': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!canMutateCharacter(state.value, character, command.actorId)) {
        return notAllowed(
          'Only the character owner or referee can complete character creation'
        )
      }
      const creation = validateCreationCompletion(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'CREATION_COMPLETE'
      })

      return ok([
        {
          type: 'CharacterCreationCompleted',
          characterId: command.characterId,
          state: nextState,
          creationComplete: nextState.status === 'PLAYABLE'
        }
      ])
    }

    case 'SetCharacterCreationHomeworld': {
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

      return ok([
        {
          type: 'CharacterCreationHomeworldSet',
          characterId: command.characterId,
          homeworld: homeworld.value,
          backgroundSkills: backgroundPlan.backgroundSkills,
          pendingCascadeSkills: backgroundPlan.pendingCascadeSkills
        }
      ])
    }

    case 'SelectCharacterCreationBackgroundSkill': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          pendingCascadeSkills: uniqueSkills(pendingCascadeSkills)
        }
      ])
    }

    case 'ResolveCharacterCreationCascadeSkill': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
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
          pendingCascadeSkills: uniqueSkills(resolution.pendingCascadeSkills)
        }
      ])
    }

    case 'StartCharacterCareerTerm': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed(
          'Only the referee can start character career terms directly'
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
      if (character.creation.state.status !== 'CAREER_SELECTION') {
        return err(
          commandError(
            'invalid_command',
            `Career terms cannot start from ${character.creation.state.status}`
          )
        )
      }
      const career = requireNonEmptyString(command.career, 'career')
      if (!career.ok) return career
      const acceptedCareer = career.value.trim()
      const requestedCareer = command.drafted ? 'Draft' : acceptedCareer

      return ok([
        {
          type: 'CharacterCareerTermStarted',
          characterId: command.characterId,
          requestedCareer,
          acceptedCareer,
          career: acceptedCareer,
          drafted: command.drafted ?? false
        }
      ])
    }

    case 'CreateBoard': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can create boards')
      }
      if (state.value.boards[command.boardId]) {
        return err(commandError('duplicate_entity', 'Board already exists'))
      }
      const width = requireFinitePositive(command.width, 'width')
      if (!width.ok) return width
      const height = requireFinitePositive(command.height, 'height')
      if (!height.ok) return height
      const scale = requireFinitePositive(command.scale, 'scale')
      if (!scale.ok) return scale

      return ok([
        {
          type: 'BoardCreated',
          boardId: command.boardId,
          name: command.name,
          imageAssetId: command.imageAssetId ?? null,
          url: command.url ?? null,
          width: command.width,
          height: command.height,
          scale: command.scale
        }
      ])
    }

    case 'SelectBoard': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can select the active board')
      }
      if (!state.value.boards[command.boardId]) {
        return err(commandError('missing_entity', 'Board does not exist'))
      }

      return ok([
        {
          type: 'BoardSelected',
          boardId: command.boardId
        }
      ])
    }

    case 'SetDoorOpen': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can open or close map doors')
      }
      if (!state.value.boards[command.boardId]) {
        return err(commandError('missing_entity', 'Board does not exist'))
      }
      const doorId = requireNonEmptyString(command.doorId, 'doorId')
      if (!doorId.ok) return doorId

      return ok([
        {
          type: 'DoorStateChanged',
          boardId: command.boardId,
          doorId: doorId.value,
          open: command.open
        }
      ])
    }

    case 'CreatePiece': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can create pieces')
      }
      if (!state.value.boards[command.boardId]) {
        return err(commandError('missing_entity', 'Board does not exist'))
      }
      if (
        command.characterId !== undefined &&
        command.characterId !== null &&
        !state.value.characters[command.characterId]
      ) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      if (state.value.pieces[command.pieceId]) {
        return err(commandError('duplicate_entity', 'Piece already exists'))
      }
      const x = requireFiniteCoordinate(command.x, 'x')
      if (!x.ok) return x
      const y = requireFiniteCoordinate(command.y, 'y')
      if (!y.ok) return y
      if (command.width !== undefined) {
        const width = requireFinitePositive(command.width, 'width')
        if (!width.ok) return width
      }
      if (command.height !== undefined) {
        const height = requireFinitePositive(command.height, 'height')
        if (!height.ok) return height
      }
      if (command.scale !== undefined) {
        const scale = requireFinitePositive(command.scale, 'scale')
        if (!scale.ok) return scale
      }

      return ok([
        {
          type: 'PieceCreated',
          pieceId: command.pieceId,
          boardId: command.boardId,
          characterId: command.characterId ?? null,
          name: command.name,
          imageAssetId: command.imageAssetId ?? null,
          x: command.x,
          y: command.y,
          ...(command.width === undefined ? {} : { width: command.width }),
          ...(command.height === undefined ? {} : { height: command.height }),
          ...(command.scale === undefined ? {} : { scale: command.scale })
        }
      ])
    }

    case 'MovePiece': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
      }
      if (!canMutatePiece(state.value, command.pieceId, command.actorId)) {
        return notAllowed('Only a controller or referee can move this piece')
      }
      const x = requireFiniteCoordinate(command.x, 'x')
      if (!x.ok) return x
      const y = requireFiniteCoordinate(command.y, 'y')
      if (!y.ok) return y

      return ok([
        {
          type: 'PieceMoved',
          pieceId: command.pieceId,
          x: command.x,
          y: command.y
        }
      ])
    }

    case 'SetPieceVisibility': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
      }
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can change piece visibility')
      }

      return ok([
        {
          type: 'PieceVisibilityChanged',
          pieceId: command.pieceId,
          visibility: command.visibility
        }
      ])
    }

    case 'SetPieceFreedom': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      if (!state.value.pieces[command.pieceId]) {
        return err(commandError('missing_entity', 'Piece does not exist'))
      }
      if (!isReferee(state.value, command.actorId)) {
        return notAllowed('Only a referee can change piece control')
      }

      return ok([
        {
          type: 'PieceFreedomChanged',
          pieceId: command.pieceId,
          freedom: command.freedom
        }
      ])
    }

    case 'RollDice': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const rolled = rollDiceExpression(
        command.expression,
        deriveEventRng(context.gameSeed, context.nextSeq)
      )
      if (!rolled.ok) {
        return err(commandError('invalid_command', rolled.error))
      }

      return ok([
        {
          type: 'DiceRolled',
          expression: rolled.value.expression,
          reason: command.reason,
          total: rolled.value.total,
          rolls: rolled.value.rolls
        }
      ])
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
