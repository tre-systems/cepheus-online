import {
  applyCharacterSheetPatch,
  applyEquipmentPatch,
  cloneEquipmentItem,
  defaultCharacteristics,
  itemMatchesId
} from './character-creation-helpers'
import { requireState } from './state'
import type { EventHandlerMap } from './types'

export type CharacterSheetEventType =
  | 'CharacterCreated'
  | 'CharacterSheetUpdated'
  | 'CharacterEquipmentItemAdded'
  | 'CharacterEquipmentItemUpdated'
  | 'CharacterEquipmentItemRemoved'
  | 'CharacterCreditsAdjusted'

export const characterSheetEventHandlers = {
  CharacterCreated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.characters[event.characterId] = {
      id: event.characterId,
      ownerId: event.ownerId,
      type: event.characterType,
      name: event.name,
      active: true,
      notes: '',
      age: null,
      characteristics: defaultCharacteristics(),
      skills: [],
      equipment: [],
      credits: 0,
      ledger: [],
      creation: null
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterSheetUpdated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    applyCharacterSheetPatch(character, event)
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterEquipmentItemAdded: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    character.equipment = [
      ...character.equipment.map(cloneEquipmentItem),
      cloneEquipmentItem(event.item)
    ]
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterEquipmentItemUpdated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    character.equipment = character.equipment.map((item) =>
      itemMatchesId(item, event.itemId)
        ? applyEquipmentPatch(item, event.patch)
        : cloneEquipmentItem(item)
    )
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterEquipmentItemRemoved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    character.equipment = character.equipment
      .filter((item) => !itemMatchesId(item, event.itemId))
      .map(cloneEquipmentItem)
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreditsAdjusted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    character.credits = event.balance
    character.ledger = [
      ...(character.ledger ?? []),
      {
        id: event.ledgerEntryId,
        actorId: envelope.actorId,
        createdAt: envelope.createdAt,
        amount: event.amount,
        balance: event.balance,
        reason: event.reason
      }
    ]
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterSheetEventType>
