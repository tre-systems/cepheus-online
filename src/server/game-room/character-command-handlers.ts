import type { GameCommand } from '../../shared/commands'
import type { CommandTypeForHandlerDomain } from '../../shared/command-metadata'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import type { GameState } from '../../shared/state'
import {
  canMutateCharacter,
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireFiniteCoordinate,
  requireFinitePositive,
  requireFiniteOrNull,
  requireGame,
  requireNonEmptyString
} from './command-helpers'

type UpdateCharacterSheetCommand = Extract<
  GameCommand,
  { type: 'UpdateCharacterSheet' }
>

type AddCharacterEquipmentItemCommand = Extract<
  GameCommand,
  { type: 'AddCharacterEquipmentItem' }
>

type UpdateCharacterEquipmentItemCommand = Extract<
  GameCommand,
  { type: 'UpdateCharacterEquipmentItem' }
>

type AdjustCharacterCreditsCommand = Extract<
  GameCommand,
  { type: 'AdjustCharacterCredits' }
>

type CharacterCommand = Extract<
  GameCommand,
  { type: CommandTypeForHandlerDomain<'character'> }
>

const validateCharacterSheetPatch = (
  command: UpdateCharacterSheetCommand
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

const characterSheetPatchFields = (command: UpdateCharacterSheetCommand) => ({
  ...(command.notes === undefined ? {} : { notes: command.notes }),
  ...(command.age === undefined ? {} : { age: command.age }),
  ...(command.characteristics === undefined
    ? {}
    : { characteristics: command.characteristics }),
  ...(command.skills === undefined ? {} : { skills: command.skills }),
  ...(command.equipment === undefined ? {} : { equipment: command.equipment }),
  ...(command.credits === undefined ? {} : { credits: command.credits })
})

const hasAuthoritativeSheetFieldPatch = (
  command: UpdateCharacterSheetCommand
): boolean =>
  command.age !== undefined ||
  command.characteristics !== undefined ||
  command.skills !== undefined ||
  command.equipment !== undefined ||
  command.credits !== undefined

const validateCharacterSheetAuthority = (
  state: GameState,
  command: UpdateCharacterSheetCommand
): Result<void, CommandError> => {
  if (
    !isReferee(state, command.actorId) &&
    hasAuthoritativeSheetFieldPatch(command)
  ) {
    return notAllowed(
      'Server-authored character creation fields can only be corrected by a referee'
    )
  }

  return ok(undefined)
}

const validateResourceAuthority = (
  state: GameState,
  actorId: CharacterCommand['actorId']
): Result<void, CommandError> =>
  isReferee(state, actorId)
    ? ok(undefined)
    : notAllowed(
        'Only the room referee can change character equipment or credits'
      )

const equipmentItemId = (item: { id?: string; name: string }) =>
  item.id ?? item.name

const hasEquipmentItem = (
  character: GameState['characters'][keyof GameState['characters']],
  itemId: string
) => character.equipment.some((item) => equipmentItemId(item) === itemId)

const validateAddEquipmentItem = (
  command: AddCharacterEquipmentItemCommand
): Result<void, CommandError> => {
  const itemId = requireNonEmptyString(command.item.id, 'item.id')
  if (!itemId.ok) return itemId
  const name = requireNonEmptyString(command.item.name, 'item.name')
  if (!name.ok) return name
  const quantity = requireFinitePositive(command.item.quantity, 'item.quantity')
  if (!quantity.ok) return quantity
  if (typeof command.item.notes !== 'string') {
    return err(commandError('invalid_command', 'item.notes must be a string'))
  }

  return ok(undefined)
}

const validateUpdateEquipmentItem = (
  command: UpdateCharacterEquipmentItemCommand
): Result<void, CommandError> => {
  const itemId = requireNonEmptyString(command.itemId, 'itemId')
  if (!itemId.ok) return itemId
  if (Object.keys(command.patch).length === 0) {
    return err(commandError('invalid_command', 'patch cannot be empty'))
  }
  if (command.patch.name !== undefined) {
    const name = requireNonEmptyString(command.patch.name, 'patch.name')
    if (!name.ok) return name
  }
  if (command.patch.quantity !== undefined) {
    const quantity = requireFinitePositive(
      command.patch.quantity,
      'patch.quantity'
    )
    if (!quantity.ok) return quantity
  }
  if (
    command.patch.notes !== undefined &&
    typeof command.patch.notes !== 'string'
  ) {
    return err(commandError('invalid_command', 'patch.notes must be a string'))
  }

  return ok(undefined)
}

const validateCreditAdjustment = (
  command: AdjustCharacterCreditsCommand
): Result<void, CommandError> => {
  const ledgerEntryId = requireNonEmptyString(
    command.ledgerEntryId,
    'ledgerEntryId'
  )
  if (!ledgerEntryId.ok) return ledgerEntryId
  const amount = requireFiniteCoordinate(command.amount, 'amount')
  if (!amount.ok) return amount
  if (command.amount === 0) {
    return err(commandError('invalid_command', 'amount cannot be zero'))
  }
  const reason = requireNonEmptyString(command.reason, 'reason')
  if (!reason.ok) return reason

  return ok(undefined)
}

export const deriveCharacterCommandEvents = (
  command: CharacterCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  switch (command.type) {
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
      const authority = validateCharacterSheetAuthority(state.value, command)
      if (!authority.ok) return authority
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

    case 'AddCharacterEquipmentItem': {
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
      const authority = validateResourceAuthority(state.value, command.actorId)
      if (!authority.ok) return authority
      const valid = validateAddEquipmentItem(command)
      if (!valid.ok) return valid
      if (hasEquipmentItem(character, command.item.id)) {
        return err(
          commandError('duplicate_entity', 'Equipment item already exists')
        )
      }

      return ok([
        {
          type: 'CharacterEquipmentItemAdded',
          characterId: command.characterId,
          item: { ...command.item }
        }
      ])
    }

    case 'UpdateCharacterEquipmentItem': {
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
      const authority = validateResourceAuthority(state.value, command.actorId)
      if (!authority.ok) return authority
      const valid = validateUpdateEquipmentItem(command)
      if (!valid.ok) return valid
      if (!hasEquipmentItem(character, command.itemId)) {
        return err(
          commandError('missing_entity', 'Equipment item does not exist')
        )
      }

      return ok([
        {
          type: 'CharacterEquipmentItemUpdated',
          characterId: command.characterId,
          itemId: command.itemId,
          patch: { ...command.patch }
        }
      ])
    }

    case 'RemoveCharacterEquipmentItem': {
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
      const authority = validateResourceAuthority(state.value, command.actorId)
      if (!authority.ok) return authority
      const itemId = requireNonEmptyString(command.itemId, 'itemId')
      if (!itemId.ok) return itemId
      if (!hasEquipmentItem(character, command.itemId)) {
        return err(
          commandError('missing_entity', 'Equipment item does not exist')
        )
      }

      return ok([
        {
          type: 'CharacterEquipmentItemRemoved',
          characterId: command.characterId,
          itemId: command.itemId
        }
      ])
    }

    case 'AdjustCharacterCredits': {
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
      const authority = validateResourceAuthority(state.value, command.actorId)
      if (!authority.ok) return authority
      const valid = validateCreditAdjustment(command)
      if (!valid.ok) return valid

      return ok([
        {
          type: 'CharacterCreditsAdjusted',
          characterId: command.characterId,
          ledgerEntryId: command.ledgerEntryId,
          amount: command.amount,
          balance: character.credits + command.amount,
          reason: command.reason
        }
      ])
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled character command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
