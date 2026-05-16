import { leaveCareerTerm, startCareerTerm } from '../characterCreation'
import {
  appendCharacterCreationHistory,
  appendCharacterCreationTimeline,
  applyCareerRank,
  cloneCareerTerm,
  markLastTermCareerLifecycle,
  recordActiveTermAdvancement,
  recordActiveTermFacts,
  recordMusteringBenefit,
  requiredTermSkillCount,
  startProjectedCareerTerm,
  withCareerTermFacts
} from './character-creation-helpers'
import { requireState } from './state'
import type { EventHandlerMap } from './types'

export type CharacterCreationCareerEventType =
  | 'CharacterCreationTransitioned'
  | 'CharacterCreationBasicTrainingCompleted'
  | 'CharacterCreationQualificationResolved'
  | 'CharacterCreationDraftResolved'
  | 'CharacterCreationDrifterEntered'
  | 'CharacterCreationSurvivalResolved'
  | 'CharacterCreationCommissionResolved'
  | 'CharacterCreationCommissionSkipped'
  | 'CharacterCreationAdvancementResolved'
  | 'CharacterCreationAdvancementSkipped'
  | 'CharacterCreationReenlistmentResolved'
  | 'CharacterCreationCareerReenlisted'
  | 'CharacterCreationCareerLeft'
  | 'CharacterCreationTermSkillRolled'
  | 'CharacterCreationTermCascadeSkillResolved'
  | 'CharacterCreationSkillsCompleted'
  | 'CharacterCareerTermStarted'

export const characterCreationCareerEventHandlers = {
  CharacterCreationTransitioned: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    let terms = character.creation.terms.map((term) => structuredClone(term))
    let careers = character.creation.careers.map((career) => ({
      ...career
    }))
    const creationEvent = event.creationEvent

    if (
      creationEvent.type === 'REENLIST' ||
      creationEvent.type === 'FORCED_REENLIST'
    ) {
      const career = terms.at(-1)?.career
      if (career) {
        const result = startCareerTerm({
          career,
          terms,
          careers
        })
        terms = result.terms.map((term) => structuredClone(term))
        careers = result.careers.map((entry) => ({ ...entry }))
      }
    } else if (
      creationEvent.type === 'LEAVE_CAREER' ||
      creationEvent.type === 'REENLIST_BLOCKED' ||
      creationEvent.type === 'MISHAP_RESOLVED'
    ) {
      terms = terms.map((term, index) =>
        index === terms.length - 1
          ? leaveCareerTerm(term)
          : structuredClone(term)
      )
    } else if (
      creationEvent.type === 'FINISH_MUSTERING' &&
      creationEvent.musteringBenefit
    ) {
      terms = recordMusteringBenefit(
        terms,
        creationEvent.musteringBenefit.career,
        creationEvent.musteringBenefit.value
      )
    } else if (
      creationEvent.type === 'COMPLETE_ADVANCEMENT' &&
      creationEvent.advancement
    ) {
      terms = recordActiveTermAdvancement(
        terms,
        creationEvent.advancement.total
      )
      if (creationEvent.rank) {
        careers = applyCareerRank(
          careers,
          creationEvent.rank.career,
          creationEvent.rank.newRank
        )
      }
    }

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      careers,
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationBasicTrainingCompleted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...withCareerTermFacts(term, (facts) => ({
              ...facts,
              basicTrainingSkills: [...event.trainingSkills]
            })),
            skillsAndTraining: [...event.trainingSkills],
            completedBasicTraining: true
          }
        : cloneCareerTerm(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      pendingDecisions: [],
      terms,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationQualificationResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    if (event.passed) {
      startProjectedCareerTerm({
        character,
        acceptedCareer: event.career
      })
      character.creation.terms = recordActiveTermFacts(
        character.creation.terms,
        (facts) => ({
          ...facts,
          qualification: {
            ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
            career: event.career,
            passed: event.passed,
            qualification: structuredClone(event.qualification),
            previousCareerCount: event.previousCareerCount,
            failedQualificationOptions: [...event.failedQualificationOptions]
          }
        })
      )
    }

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      failedToQualify: !event.passed,
      failedQualification: event.passed
        ? null
        : {
            ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
            career: event.career,
            passed: event.passed,
            qualification: structuredClone(event.qualification),
            previousCareerCount: event.previousCareerCount,
            failedQualificationOptions: [...event.failedQualificationOptions]
          },
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationDraftResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    startProjectedCareerTerm({
      character,
      acceptedCareer: event.draft.acceptedCareer,
      drafted: true
    })
    character.creation.terms = recordActiveTermFacts(
      character.creation.terms,
      (facts) => ({
        ...facts,
        draft: {
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          ...structuredClone(event.draft)
        }
      })
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationDrifterEntered: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    startProjectedCareerTerm({
      character,
      acceptedCareer: event.acceptedCareer
    })

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationSurvivalResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...withCareerTermFacts(term, (facts) => ({
              ...facts,
              survival: {
                ...(event.rollEventId
                  ? { rollEventId: event.rollEventId }
                  : {}),
                passed: event.passed,
                survival: structuredClone(event.survival),
                canCommission: event.canCommission,
                canAdvance: event.canAdvance
              }
            })),
            survival: event.survival.total
          }
        : cloneCareerTerm(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      requiredTermSkillCount: event.passed
        ? requiredTermSkillCount({
            canCommission: event.canCommission,
            canAdvance: event.canAdvance
          })
        : character.creation.requiredTermSkillCount,
      pendingDecisions: event.pendingDecisions
        ? event.pendingDecisions.map((decision) => ({ ...decision }))
        : [],
      terms,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCommissionResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordActiveTermFacts(character.creation.terms, (facts) => ({
        ...facts,
        commission: {
          skipped: false,
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          passed: event.passed,
          commission: structuredClone(event.commission)
        }
      })),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCommissionSkipped: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordActiveTermFacts(character.creation.terms, (facts) => ({
        ...facts,
        commission: { skipped: true }
      })),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAdvancementResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const terms = recordActiveTermFacts(
      recordActiveTermAdvancement(
        character.creation.terms,
        event.advancement.total
      ),
      (facts) => ({
        ...facts,
        advancement: {
          skipped: false,
          ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
          passed: event.passed,
          advancement: structuredClone(event.advancement),
          rank: event.rank ? structuredClone(event.rank) : null
        }
      })
    )
    const careers = event.rank
      ? applyCareerRank(
          character.creation.careers,
          event.rank.career,
          event.rank.newRank
        )
      : character.creation.careers.map((career) => ({ ...career }))

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      careers,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAdvancementSkipped: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordActiveTermFacts(character.creation.terms, (facts) => ({
        ...facts,
        advancement: { skipped: true }
      })),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationTermSkillRolled: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...withCareerTermFacts(term, (facts) => ({
              ...facts,
              termSkillRolls: [
                ...(facts.termSkillRolls ?? []),
                {
                  ...(event.rollEventId
                    ? { rollEventId: event.rollEventId }
                    : {}),
                  ...structuredClone(event.termSkill)
                }
              ]
            })),
            skills: [...event.termSkills],
            skillsAndTraining: [...event.skillsAndTraining]
          }
        : cloneCareerTerm(term)
    )
    const characteristic = event.termSkill.characteristic
    const characteristics = characteristic
      ? {
          ...character.characteristics,
          [characteristic.key]:
            (character.characteristics[characteristic.key] ?? 0) +
            characteristic.modifier
        }
      : character.characteristics

    character.characteristics = characteristics
    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      pendingCascadeSkills: [...event.pendingCascadeSkills],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationReenlistmentResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) => {
      if (index !== lastTermIndex) return structuredClone(term)

      return {
        ...withCareerTermFacts(term, (facts) => ({
          ...facts,
          reenlistment: {
            ...(event.rollEventId ? { rollEventId: event.rollEventId } : {}),
            outcome: event.outcome,
            reenlistment: structuredClone(event.reenlistment)
          }
        })),
        canReenlist: event.outcome !== 'blocked',
        reEnlistment: event.reenlistment.total
      }
    })

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCareerReenlisted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    markLastTermCareerLifecycle(character, {
      type: 'continued',
      outcome: event.outcome,
      career: event.career,
      forced: event.forced
    })
    startProjectedCareerTerm({
      character,
      acceptedCareer: event.career
    })
    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCareerLeft: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...leaveCareerTerm(term),
            facts: {
              ...(term.facts ? structuredClone(term.facts) : {}),
              careerLifecycle: {
                type: 'left' as const,
                outcome: event.outcome,
                retirement: event.retirement
              }
            }
          }
        : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationTermCascadeSkillResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...withCareerTermFacts(term, (facts) => ({
              ...facts,
              termCascadeSelections: [
                ...(facts.termCascadeSelections ?? []),
                {
                  cascadeSkill: event.cascadeSkill,
                  selection: event.selection
                }
              ]
            })),
            skills: [...event.termSkills],
            skillsAndTraining: [...event.skillsAndTraining]
          }
        : cloneCareerTerm(term)
    )

    character.creation = {
      ...character.creation,
      terms,
      pendingCascadeSkills: [...event.pendingCascadeSkills],
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationSkillsCompleted: (state, envelope) => {
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

  CharacterCareerTermStarted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState
    const acceptedCareer = event.acceptedCareer ?? event.career

    startProjectedCareerTerm({
      character,
      acceptedCareer,
      drafted: event.drafted
    })
    character.creation = {
      ...character.creation,
      ...(event.state ? { state: structuredClone(event.state) } : {}),
      ...(event.creationComplete === undefined
        ? {}
        : { creationComplete: event.creationComplete }),
      timeline: appendCharacterCreationTimeline(character, envelope)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterCreationCareerEventType>
