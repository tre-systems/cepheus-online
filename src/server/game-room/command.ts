import type { Command } from '../../shared/commands'
import {
  canTransitionCareerCreationState,
  createCareerCreationState,
  careerSkillWithLevel,
  deriveBackgroundSkillPlan,
  deriveTotalBackgroundSkillAllowance,
  hasBackgroundHomeworld,
  isCascadeCareerSkill,
  normalizeCareerSkill,
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
  command: Command,
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

export const deriveEventsForCommand = (
  command: Command,
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
      if (
        command.creationEvent.type === 'COMPLETE_HOMEWORLD' &&
        character.creation.homeworld &&
        !hasCompleteBackgroundChoices(character)
      ) {
        return err(
          commandError(
            'invalid_command',
            'Background choices must be complete before career selection'
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

      return ok([
        {
          type: 'CharacterCareerTermStarted',
          characterId: command.characterId,
          career: career.value,
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
