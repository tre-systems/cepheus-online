import { leaveCareerTerm } from '../characterCreation'
import {
  appendCharacterCreationTimeline,
  applyCharacterSheetPatch,
  recordActiveTermAnagathics,
  recordActiveTermFacts,
  recordTermFactsByIndex,
  withCareerTermFacts
} from './character-creation-helpers'
import { requireState } from './state'
import type { EventHandlerMap } from './types'

export type CharacterCreationRiskEventType =
  | 'CharacterCreationMishapResolved'
  | 'CharacterCreationInjuryResolved'
  | 'CharacterCreationDeathConfirmed'
  | 'CharacterCreationAgingResolved'
  | 'CharacterCreationAgingLossesResolved'
  | 'CharacterCreationAnagathicsDecided'

export const characterCreationRiskEventHandlers = {
  CharacterCreationMishapResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? withCareerTermFacts(leaveCareerTerm(term), (facts) => ({
            ...facts,
            ...(event.mishap
              ? {
                  mishap: {
                    ...(event.rollEventId
                      ? { rollEventId: event.rollEventId }
                      : {}),
                    roll: structuredClone(event.mishap.roll),
                    outcome: structuredClone(event.mishap.outcome)
                  }
                }
              : {})
          }))
        : structuredClone(term)
    )

    if ((event.mishap?.outcome.debtCredits ?? 0) > 0) {
      character.credits -= event.mishap?.outcome.debtCredits ?? 0
    }
    if ((event.mishap?.outcome.extraServiceYears ?? 0) > 0) {
      character.age =
        (character.age ?? 18) + (event.mishap?.outcome.extraServiceYears ?? 0)
    }

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      pendingDecisions: event.mishap?.outcome.injury
        ? [{ key: 'injuryResolution' }]
        : [],
      terms,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationInjuryResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    applyCharacterSheetPatch(character, {
      characteristics: event.characteristicPatch
    })
    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      pendingDecisions: [],
      terms: recordActiveTermFacts(character.creation.terms, (facts) => ({
        ...facts,
        injury: {
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          ...(event.method ? { method: event.method } : {}),
          ...(event.injuryRoll
            ? { injuryRoll: structuredClone(event.injuryRoll) }
            : {}),
          ...(event.severityRoll
            ? { severityRoll: structuredClone(event.severityRoll) }
            : {}),
          outcome: structuredClone(event.outcome),
          selectedLosses: structuredClone(event.selectedLosses),
          characteristicPatch: structuredClone(event.characteristicPatch)
        }
      })),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationDeathConfirmed: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      pendingDecisions: [],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAgingResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.age = event.aging.age
    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordActiveTermFacts(character.creation.terms, (facts) => ({
        ...facts,
        aging: {
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          ...structuredClone(event.aging)
        }
      })),
      characteristicChanges: event.aging.characteristicChanges.map(
        (change) => ({ ...change })
      ),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAgingLossesResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    applyCharacterSheetPatch(character, {
      characteristics: event.characteristicPatch
    })
    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordActiveTermFacts(character.creation.terms, (facts) => ({
        ...facts,
        agingLosses: {
          selectedLosses: structuredClone(event.selectedLosses),
          characteristicPatch: structuredClone(event.characteristicPatch)
        }
      })),
      characteristicChanges: [],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAnagathicsDecided: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordTermFactsByIndex(
        recordActiveTermAnagathics(
          character.creation.terms,
          event.termIndex,
          event.useAnagathics,
          event.passed,
          event.cost
        ),
        event.termIndex,
        (facts) => ({
          ...facts,
          anagathicsDecision: {
            ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
            useAnagathics: event.useAnagathics,
            termIndex: event.termIndex,
            ...(event.passed !== undefined ? { passed: event.passed } : {}),
            ...(event.survival
              ? { survival: structuredClone(event.survival) }
              : {}),
            ...(event.cost !== undefined ? { cost: event.cost } : {}),
            ...(event.costRoll
              ? { costRoll: structuredClone(event.costRoll) }
              : {})
          }
        })
      ),
      pendingDecisions: event.pendingDecisions
        ? event.pendingDecisions.map((decision) => ({ ...decision }))
        : character.creation.pendingDecisions,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    if (event.cost !== undefined) {
      character.credits -= event.cost
    }
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterCreationRiskEventType>
