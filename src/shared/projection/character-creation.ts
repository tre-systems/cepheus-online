import {
  deriveCharacterCreationHistoryEvent,
  deriveCharacterCreationTimelineEntry,
  deriveMaterialBenefitEffect,
  deriveTotalBackgroundSkillAllowance,
  leaveCareerTerm,
  projectCareerCreationActionPlan,
  startCareerTerm
} from '../characterCreation'
import type { GameEvent } from '../events'
import type {
  CareerCreationBenefitFact,
  CareerRank,
  CareerTerm,
  CareerTermFacts
} from '../characterCreation'
import { requireState } from './state'
import type { EventHandler, EventHandlerMap } from './types'
import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacterState,
  CharacterSheetPatch,
  GameState
} from '../state'

const defaultCharacteristics = (): CharacterCharacteristics => ({
  str: null,
  dex: null,
  end: null,
  int: null,
  edu: null,
  soc: null
})

const applyCharacterSheetPatch = (
  character: CharacterState,
  patch: CharacterSheetPatch
) => {
  if (patch.notes !== undefined) character.notes = patch.notes
  if (patch.age !== undefined) character.age = patch.age
  if (patch.characteristics !== undefined) {
    character.characteristics = {
      ...character.characteristics,
      ...patch.characteristics
    }
  }
  if (patch.skills !== undefined) character.skills = [...patch.skills]
  if (patch.equipment !== undefined) {
    character.equipment = patch.equipment.map((item) => ({ ...item }))
  }
  if (patch.credits !== undefined) character.credits = patch.credits
}

const cloneEquipmentItem = (
  item: CharacterEquipmentItem
): CharacterEquipmentItem => ({
  ...(item.id === undefined ? {} : { id: item.id }),
  name: item.name,
  quantity: item.quantity,
  notes: item.notes
})

const itemMatchesId = (item: CharacterEquipmentItem, itemId: string) =>
  item.id === itemId || (!item.id && item.name === itemId)

const applyEquipmentPatch = (
  item: CharacterEquipmentItem,
  patch: Partial<CharacterEquipmentItem>
): CharacterEquipmentItem => {
  const id = item.id ?? patch.id
  return {
    ...(id === undefined ? {} : { id }),
    name: patch.name ?? item.name,
    quantity: patch.quantity ?? item.quantity,
    notes: patch.notes ?? item.notes
  }
}

const requiredTermSkillCount = ({
  canCommission,
  canAdvance
}: {
  canCommission: boolean
  canAdvance: boolean
}): number => (!canCommission && !canAdvance ? 2 : 1)

const backgroundSkillAllowance = (character: CharacterState): number =>
  deriveTotalBackgroundSkillAllowance(character.characteristics.edu)

const appendCharacterCreationHistory = (
  character: CharacterState,
  event: GameEvent,
  context: { canEnterDraft?: boolean } = {}
) => {
  const historyEvent = deriveCharacterCreationHistoryEvent(event, context)

  return historyEvent
    ? [...(character.creation?.history ?? []), historyEvent]
    : [...(character.creation?.history ?? [])]
}

const appendCharacterCreationTimeline = (
  character: CharacterState,
  envelope: Parameters<EventHandler<GameEvent>>[1]
) => {
  const timelineEntry = deriveCharacterCreationTimelineEntry(envelope)

  return timelineEntry
    ? [...(character.creation?.timeline ?? []), timelineEntry]
    : [...(character.creation?.timeline ?? [])]
}

const cloneCareerTerm = (term: CareerTerm): CareerTerm => structuredClone(term)

const withCareerTermFacts = (
  term: CareerTerm,
  deriveFacts: (facts: CareerTermFacts) => CareerTermFacts
): CareerTerm => ({
  ...cloneCareerTerm(term),
  facts: deriveFacts(structuredClone(term.facts ?? {}))
})

const recordTermFactsByIndex = (
  terms: readonly CareerTerm[],
  termIndex: number,
  deriveFacts: (facts: CareerTermFacts) => CareerTermFacts
) =>
  terms.map((term, index) =>
    index === termIndex
      ? withCareerTermFacts(term, deriveFacts)
      : cloneCareerTerm(term)
  )

const recordActiveTermFacts = (
  terms: readonly CareerTerm[],
  deriveFacts: (facts: CareerTermFacts) => CareerTermFacts
) => recordTermFactsByIndex(terms, terms.length - 1, deriveFacts)

const recordMusteringBenefit = (
  terms: readonly CareerTerm[],
  career: string,
  benefit: string,
  fact?: CareerCreationBenefitFact
) =>
  terms.map((term, index) =>
    term.career === career &&
    !terms.slice(0, index).some((previous) => previous.career === career)
      ? {
          ...cloneCareerTerm(term),
          benefits: [...term.benefits, benefit],
          ...(fact
            ? {
                facts: {
                  ...(term.facts ? structuredClone(term.facts) : {}),
                  musteringBenefits: [
                    ...(term.facts?.musteringBenefits ?? []),
                    structuredClone(fact)
                  ]
                }
              }
            : {})
        }
      : cloneCareerTerm(term)
  )

const recordActiveTermAdvancement = (
  terms: readonly CareerTerm[],
  advancement: number
) =>
  terms.map((term, index) =>
    index === terms.length - 1
      ? {
          ...cloneCareerTerm(term),
          advancement
        }
      : cloneCareerTerm(term)
  )

const recordActiveTermAnagathics = (
  terms: readonly CareerTerm[],
  termIndex: number,
  useAnagathics: boolean,
  passed?: boolean,
  cost?: number
) =>
  terms.map((term, index) =>
    index === termIndex
      ? {
          ...cloneCareerTerm(term),
          anagathics: useAnagathics && passed !== false,
          ...(cost !== undefined ? { anagathicsCost: cost } : {})
        }
      : cloneCareerTerm(term)
  )

const applyCareerRank = (
  careers: readonly CareerRank[],
  career: string,
  rank: number
) =>
  careers.map((entry) =>
    entry.name === career ? { ...entry, rank } : { ...entry }
  )

const startProjectedCareerTerm = ({
  character,
  acceptedCareer,
  drafted = false
}: {
  character: CharacterState
  acceptedCareer: string
  drafted?: boolean
}) => {
  if (!character.creation) return
  const result = startCareerTerm({
    career: acceptedCareer,
    terms: character.creation.terms,
    careers: character.creation.careers,
    drafted
  })

  character.creation = {
    ...character.creation,
    terms: result.terms.map((term) => structuredClone(term)),
    careers: result.careers.map((career) => ({ ...career })),
    canEnterDraft: result.canEnterDraft,
    failedToQualify: result.failedToQualify,
    failedQualification: null
  }
}

const refreshCharacterCreationActionPlans = (
  state: GameState | null
): GameState | null => {
  if (!state) return state

  for (const character of Object.values(state.characters)) {
    if (!character.creation) continue
    character.creation = projectCareerCreationActionPlan(character.creation, {
      characteristics: character.characteristics
    })
  }

  return state
}

const withCharacterCreationActionPlans = <
  THandlers extends EventHandlerMap<CharacterEventType>
>(
  handlers: THandlers
): THandlers => {
  const wrapped = {} as THandlers

  for (const type of Object.keys(handlers) as (keyof THandlers)[]) {
    const handler = handlers[type] as EventHandler<GameEvent>
    wrapped[type] = ((
      state: GameState | null,
      envelope: Parameters<EventHandler<GameEvent>>[1]
    ) =>
      refreshCharacterCreationActionPlans(
        handler(state, envelope)
      )) as THandlers[typeof type]
  }

  return wrapped
}

type CharacterEventType =
  | 'CharacterCreated'
  | 'CharacterSheetUpdated'
  | 'CharacterEquipmentItemAdded'
  | 'CharacterEquipmentItemUpdated'
  | 'CharacterEquipmentItemRemoved'
  | 'CharacterCreditsAdjusted'
  | 'CharacterCreationStarted'
  | 'CharacterCreationTransitioned'
  | 'CharacterCreationCharacteristicRolled'
  | 'CharacterCreationCharacteristicsCompleted'
  | 'CharacterCreationBasicTrainingCompleted'
  | 'CharacterCreationQualificationResolved'
  | 'CharacterCreationDraftResolved'
  | 'CharacterCreationDrifterEntered'
  | 'CharacterCreationSurvivalResolved'
  | 'CharacterCreationCommissionResolved'
  | 'CharacterCreationCommissionSkipped'
  | 'CharacterCreationAdvancementResolved'
  | 'CharacterCreationAdvancementSkipped'
  | 'CharacterCreationAgingResolved'
  | 'CharacterCreationAgingLossesResolved'
  | 'CharacterCreationMishapResolved'
  | 'CharacterCreationInjuryResolved'
  | 'CharacterCreationDeathConfirmed'
  | 'CharacterCreationAnagathicsDecided'
  | 'CharacterCreationReenlistmentResolved'
  | 'CharacterCreationCareerReenlisted'
  | 'CharacterCreationCareerLeft'
  | 'CharacterCreationTermSkillRolled'
  | 'CharacterCreationTermCascadeSkillResolved'
  | 'CharacterCreationSkillsCompleted'
  | 'CharacterCreationMusteringBenefitRolled'
  | 'CharacterCreationAfterMusteringContinued'
  | 'CharacterCreationMusteringCompleted'
  | 'CharacterCreationCompleted'
  | 'CharacterCreationHomeworldSet'
  | 'CharacterCreationHomeworldCompleted'
  | 'CharacterCreationBackgroundSkillSelected'
  | 'CharacterCreationCascadeSkillResolved'
  | 'CharacterCreationFinalized'
  | 'CharacterCareerTermStarted'

const rawCharacterEventHandlers = {
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
  },

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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationQualificationResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const canEnterDraft = character.creation.canEnterDraft
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event, {
        canEnterDraft
      })
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
    }
    if (event.cost !== undefined) {
      character.credits -= event.cost
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCareerReenlisted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    startProjectedCareerTerm({
      character,
      acceptedCareer: event.career
    })
    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      index === lastTermIndex ? leaveCareerTerm(term) : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
      timeline: appendCharacterCreationTimeline(character, envelope),
      history: appendCharacterCreationHistory(character, event)
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
} satisfies EventHandlerMap<CharacterEventType>

export const characterEventHandlers = withCharacterCreationActionPlans(
  rawCharacterEventHandlers
)
