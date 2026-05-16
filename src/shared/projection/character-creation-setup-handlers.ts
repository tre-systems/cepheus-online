import { deriveCharacterCreationTimelineEntry } from '../characterCreation'
import {
  appendCharacterCreationTimeline,
  backgroundSkillAllowance
} from './character-creation-helpers'
import { requireState } from './state'
import type { EventHandlerMap } from './types'

export type CharacterCreationSetupEventType =
  | 'CharacterCreationStarted'
  | 'CharacterCreationCharacteristicRolled'
  | 'CharacterCreationCharacteristicsCompleted'
  | 'CharacterCreationHomeworldSet'
  | 'CharacterCreationHomeworldCompleted'
  | 'CharacterCreationBackgroundSkillSelected'
  | 'CharacterCreationCascadeSkillResolved'

export const characterCreationSetupEventHandlers = {
  CharacterCreationStarted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    const creation = structuredClone(event.creation)
    const timelineEntry = deriveCharacterCreationTimelineEntry(envelope)
    character.creation = {
      ...creation,
      timeline: timelineEntry
        ? [...(creation.timeline ?? []), timelineEntry]
        : [...(creation.timeline ?? [])]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCharacteristicRolled: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.characteristics = {
      ...character.characteristics,
      [event.characteristic]: event.value
    }
    character.creation = {
      ...character.creation,
      characteristicRolls: {
        ...(character.creation.characteristicRolls ?? {}),
        [event.characteristic]: {
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          value: event.value
        }
      },
      timeline: appendCharacterCreationTimeline(character, envelope)
    }

    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCharacteristicsCompleted: (state, envelope) => {
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

  CharacterCreationHomeworldSet: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      homeworld: structuredClone(event.homeworld),
      backgroundSkills: [...event.backgroundSkills],
      backgroundSkillAllowance:
        event.backgroundSkillAllowance ?? backgroundSkillAllowance(character),
      pendingCascadeSkills: [...event.pendingCascadeSkills],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationHomeworldCompleted: (state, envelope) => {
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

  CharacterCreationBackgroundSkillSelected: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      backgroundSkills: [...event.backgroundSkills],
      backgroundSkillAllowance:
        event.backgroundSkillAllowance ??
        character.creation.backgroundSkillAllowance ??
        backgroundSkillAllowance(character),
      pendingCascadeSkills: [...event.pendingCascadeSkills],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCascadeSkillResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      backgroundSkills: [...event.backgroundSkills],
      backgroundSkillAllowance:
        event.backgroundSkillAllowance ??
        character.creation.backgroundSkillAllowance ??
        backgroundSkillAllowance(character),
      pendingCascadeSkills: [...event.pendingCascadeSkills],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterCreationSetupEventType>
