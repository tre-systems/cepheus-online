import type { Command, GameCommand } from '../../shared/commands'
import {
  canTransitionCareerCreationState,
  createCareerCreationState,
  careerSkillWithLevel,
  deriveCareerCreationActionContext,
  deriveLegalCareerCreationActionKeysForProjection,
  deriveSurvivalPromotionOptions,
  evaluateCareerCheck,
  deriveBackgroundSkillPlan,
  deriveTotalBackgroundSkillAllowance,
  hasBackgroundHomeworld,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  parseCareerRankReward,
  resolveCascadeCareerSkill,
  transitionCareerCreationState
} from '../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import { rollDiceExpression } from '../../shared/dice'
import type { GameEvent } from '../../shared/events'
import { deriveEventRng } from '../../shared/prng'
import { err, ok, type Result } from '../../shared/result'
import type {
  CharacterCreationHomeworld,
  CharacterCreationProjection,
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

  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    character.creation
  )
  if (!legalActions.includes('completeBasicTraining')) {
    return err(
      commandError(
        'invalid_command',
        'COMPLETE_BASIC_TRAINING is blocked by unresolved character creation decisions'
      )
    )
  }

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

const currentCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => creation.careers.find((entry) => entry.name === career)?.rank ?? 0

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
      commandError('invalid_command', `Career ${career} has no commission check`)
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

export const deriveEventsForCommand = (
  command: GameCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const expectedSeq = validateExpectedSeq(command, context.currentSeq)
  if (!expectedSeq.ok) return expectedSeq

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
      if (!state.value.characters[command.characterId]) {
        return err(commandError('missing_entity', 'Character does not exist'))
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
      const sheet = validateCharacterCreationSheet(command)
      if (!sheet.ok) return sheet

      return ok([
        {
          type: 'CharacterCreationFinalized',
          characterId: command.characterId,
          age: command.age,
          characteristics: { ...command.characteristics },
          skills: [...command.skills],
          equipment: command.equipment.map((item) => ({ ...item })),
          credits: command.credits,
          notes: command.notes
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
      if (!character.creation) {
        return err(
          commandError(
            'missing_entity',
            'Character creation has not been started'
          )
        )
      }
      if (command.creationEvent.type === 'COMPLETE_HOMEWORLD') {
        const creation = validateHomeworldCompletion(character)
        if (!creation.ok) return creation
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
      if (
        command.creationEvent.type === 'FINISH_MUSTERING' ||
        command.creationEvent.type === 'CREATION_COMPLETE'
      ) {
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

    case 'CompleteCharacterCreationBasicTraining': {
      const state = requireGame(context.state)
      if (!state.ok) return state
      const character = state.value.characters[command.characterId]
      if (!character) {
        return err(commandError('missing_entity', 'Character does not exist'))
      }
      const creation = validateBasicTrainingCompletion(character)
      if (!creation.ok) return creation

      const nextState = transitionCareerCreationState(creation.value.state, {
        type: 'COMPLETE_BASIC_TRAINING'
      })
      const trainingSkills =
        creation.value.terms.at(-1)?.skillsAndTraining.slice() ?? []

      return ok([
        {
          type: 'CharacterCreationBasicTrainingCompleted',
          characterId: command.characterId,
          trainingSkills,
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
