import { deriveMaterialBenefitEffect } from '../characterCreation'
import {
  appendCharacterCreationTimeline,
  applyCharacterSheetPatch,
  recordMusteringBenefit
} from './character-creation-helpers'
import { requireState } from './state'
import type { EventHandlerMap } from './types'

export type CharacterCreationMusteringEventType =
  | 'CharacterCreationMusteringBenefitRolled'
  | 'CharacterCreationAfterMusteringContinued'
  | 'CharacterCreationMusteringCompleted'
  | 'CharacterCreationCompleted'
  | 'CharacterCreationFinalized'

export const characterCreationMusteringEventHandlers = {
  CharacterCreationMusteringBenefitRolled: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordMusteringBenefit(
        character.creation.terms,
        event.musteringBenefit.career,
        event.musteringBenefit.value,
        {
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          ...event.musteringBenefit
        }
      ),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    if (event.musteringBenefit.kind === 'cash') {
      character.credits += event.musteringBenefit.credits
    } else {
      const effect = deriveMaterialBenefitEffect(event.musteringBenefit.value)
      if (effect.kind === 'characteristic') {
        character.characteristics = {
          ...character.characteristics,
          [effect.characteristic]:
            (character.characteristics[effect.characteristic] ?? 0) +
            effect.modifier
        }
      } else if (effect.kind === 'equipment') {
        character.equipment = [
          ...character.equipment,
          {
            name: effect.item,
            quantity: 1,
            notes: `Mustering benefit: ${event.musteringBenefit.career}`
          }
        ]
      }
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAfterMusteringContinued: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationMusteringCompleted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCompleted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationFinalized: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    applyCharacterSheetPatch(character, event)
    character.creation = {
      ...character.creation,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterCreationMusteringEventType>
