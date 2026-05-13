import { leaveCareerTerm, startCareerTerm } from '../characterCreation'
import type { CareerRank, CareerTerm } from '../characterCreation'
import { requireState } from './state'
import type { EventHandlerMap } from './types'
import type {
  CharacterCharacteristics,
  CharacterState,
  CharacterSheetPatch
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

const recordMusteringBenefit = (
  terms: readonly CareerTerm[],
  career: string,
  benefit: string
) =>
  terms.map((term, index) =>
    term.career === career &&
    !terms.slice(0, index).some((previous) => previous.career === career)
      ? {
          ...term,
          benefits: [...term.benefits, benefit]
        }
      : structuredClone(term)
  )

const recordActiveTermAdvancement = (
  terms: readonly CareerTerm[],
  advancement: number
) =>
  terms.map((term, index) =>
    index === terms.length - 1
      ? {
          ...structuredClone(term),
          advancement
        }
      : structuredClone(term)
  )

const recordActiveTermAnagathics = (
  terms: readonly CareerTerm[],
  termIndex: number,
  useAnagathics: boolean
) =>
  terms.map((term, index) =>
    index === termIndex
      ? {
          ...structuredClone(term),
          anagathics: useAnagathics
        }
      : structuredClone(term)
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
    failedToQualify: result.failedToQualify
  }
}

type CharacterEventType =
  | 'CharacterCreated'
  | 'CharacterSheetUpdated'
  | 'CharacterCreationStarted'
  | 'CharacterCreationTransitioned'
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

export const characterEventHandlers = {
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

  CharacterCreationStarted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    character.creation = structuredClone(event.creation)
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
      history: [
        ...(character.creation.history ?? []),
        structuredClone(creationEvent)
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'SET_CHARACTERISTICS' }
      ]
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
      index === lastTermIndex ? leaveCareerTerm(term) : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      history: [
        ...(character.creation.history ?? []),
        { type: 'MISHAP_RESOLVED' }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'DEATH_CONFIRMED' }
      ]
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
            ...structuredClone(term),
            skillsAndTraining: [...event.trainingSkills],
            completedBasicTraining: true
          }
        : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      history: [
        ...(character.creation.history ?? []),
        { type: 'COMPLETE_BASIC_TRAINING' }
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationQualificationResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const creationEvent = event.passed
      ? {
          type: 'SELECT_CAREER' as const,
          isNewCareer: true,
          qualification: structuredClone(event.qualification)
        }
      : {
          type: 'SELECT_CAREER' as const,
          isNewCareer: false,
          qualification: structuredClone(event.qualification),
          failedQualificationOptions: [...event.failedQualificationOptions],
          canEnterDraft: character.creation.canEnterDraft
        }

    if (event.passed) {
      startProjectedCareerTerm({
        character,
        acceptedCareer: event.career
      })
    }

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      failedToQualify: !event.passed,
      history: [
        ...(character.creation.history ?? []),
        structuredClone(creationEvent)
      ]
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

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          drafted: true
        }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          failedQualificationOptions: ['Drifter']
        }
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationSurvivalResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const creationEvent = event.passed
      ? {
          type: 'SURVIVAL_PASSED' as const,
          canCommission: event.canCommission,
          canAdvance: event.canAdvance,
          survival: structuredClone(event.survival)
        }
      : {
          type: 'SURVIVAL_FAILED' as const,
          survival: structuredClone(event.survival)
        }
    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...structuredClone(term),
            survival: event.survival.total
          }
        : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      history: [
        ...(character.creation.history ?? []),
        structuredClone(creationEvent)
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCommissionResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const creationEvent = {
      type: 'COMPLETE_COMMISSION' as const,
      commission: structuredClone(event.commission)
    }

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      history: [
        ...(character.creation.history ?? []),
        structuredClone(creationEvent)
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'SKIP_COMMISSION' }
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationAdvancementResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const creationEvent = {
      type: 'COMPLETE_ADVANCEMENT' as const,
      advancement: structuredClone(event.advancement),
      rank: event.rank ? structuredClone(event.rank) : null
    }
    const terms = recordActiveTermAdvancement(
      character.creation.terms,
      event.advancement.total
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
      history: [
        ...(character.creation.history ?? []),
        structuredClone(creationEvent)
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'SKIP_ADVANCEMENT' }
      ]
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
            ...structuredClone(term),
            skills: [...event.termSkills],
            skillsAndTraining: [...event.skillsAndTraining]
          }
        : structuredClone(term)
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
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'ROLL_TERM_SKILL',
          termSkill: structuredClone(event.termSkill)
        }
      ]
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
      characteristicChanges: event.aging.characteristicChanges.map(
        (change) => ({ ...change })
      ),
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'COMPLETE_AGING',
          aging: structuredClone(event.aging)
        }
      ]
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
      characteristicChanges: []
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
      terms: recordActiveTermAnagathics(
        character.creation.terms,
        event.termIndex,
        event.useAnagathics
      ),
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'DECIDE_ANAGATHICS',
          useAnagathics: event.useAnagathics,
          termIndex: event.termIndex
        }
      ]
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
        ...structuredClone(term),
        canReenlist: event.outcome !== 'blocked',
        reEnlistment: event.reenlistment.total
      }
    })

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'RESOLVE_REENLISTMENT',
          reenlistment: structuredClone(event.reenlistment)
        }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        {
          type: event.forced ? 'FORCED_REENLIST' : 'REENLIST'
        }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        {
          type:
            event.outcome === 'blocked' ? 'REENLIST_BLOCKED' : 'LEAVE_CAREER'
        }
      ]
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
            ...structuredClone(term),
            skills: [...event.termSkills],
            skillsAndTraining: [...event.skillsAndTraining]
          }
        : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      terms,
      pendingCascadeSkills: [...event.pendingCascadeSkills],
      history: [
        ...(character.creation.history ?? []),
        {
          type: 'RESOLVE_TERM_CASCADE_SKILL',
          cascadeSkill: event.cascadeSkill,
          selection: event.selection
        }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'COMPLETE_SKILLS' }
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationMusteringBenefitRolled: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const creationEvent = {
      type: 'FINISH_MUSTERING' as const,
      musteringBenefit: structuredClone(event.musteringBenefit)
    }

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms: recordMusteringBenefit(
        character.creation.terms,
        event.musteringBenefit.career,
        event.musteringBenefit.value
      ),
      history: [
        ...(character.creation.history ?? []),
        structuredClone(creationEvent)
      ]
    }
    if (event.musteringBenefit.kind === 'cash') {
      character.credits += event.musteringBenefit.credits
    } else if (event.musteringBenefit.materialItem) {
      character.equipment = [
        ...character.equipment,
        {
          name: event.musteringBenefit.materialItem,
          quantity: 1,
          notes: `Mustering benefit: ${event.musteringBenefit.career}`
        }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'CONTINUE_CAREER' }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'FINISH_MUSTERING' }
      ]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'CREATION_COMPLETE' }
      ]
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
      pendingCascadeSkills: [...event.pendingCascadeSkills]
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
      history: [
        ...(character.creation.history ?? []),
        { type: 'COMPLETE_HOMEWORLD' }
      ]
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
      pendingCascadeSkills: [...event.pendingCascadeSkills]
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
      pendingCascadeSkills: [...event.pendingCascadeSkills]
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
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterEventType>
