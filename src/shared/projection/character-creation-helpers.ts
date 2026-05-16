import type { CepheusRuleset } from '../character-creation/cepheus-srd-ruleset'
import { resolveDefaultRulesetData } from '../character-creation/default-ruleset-provider'
import type { CareerCreationActionPlan } from '../character-creation/types'
import type { Result } from '../result'
import type {
  CareerCreationBenefitFact,
  CareerRank,
  CareerTerm,
  CareerTermCareerLifecycleFact,
  CareerTermFacts
} from '../characterCreation'
import {
  deriveCharacterCreationHistoryEvent,
  deriveCharacterCreationTimelineEntry,
  deriveTotalBackgroundSkillAllowance,
  projectCareerCreationActionPlan,
  startCareerTerm
} from '../characterCreation'
import type { GameEvent } from '../events'
import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacterSheetPatch,
  CharacterState,
  GameState
} from '../state'
import type { EventHandler, EventHandlerMap } from './types'

export type CharacterCreationRulesetResolver = (
  rulesetId?: string
) => Result<CepheusRuleset, string[]>

export interface CharacterCreationProjectionOptions {
  resolveRulesetById?: CharacterCreationRulesetResolver
}

export const defaultCharacteristics = (): CharacterCharacteristics => ({
  str: null,
  dex: null,
  end: null,
  int: null,
  edu: null,
  soc: null
})

export const applyCharacterSheetPatch = (
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

export const cloneEquipmentItem = (
  item: CharacterEquipmentItem
): CharacterEquipmentItem => ({
  ...(item.id === undefined ? {} : { id: item.id }),
  name: item.name,
  quantity: item.quantity,
  notes: item.notes
})

export const itemMatchesId = (item: CharacterEquipmentItem, itemId: string) =>
  item.id === itemId || (!item.id && item.name === itemId)

export const applyEquipmentPatch = (
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

export const requiredTermSkillCount = ({
  canCommission,
  canAdvance
}: {
  canCommission: boolean
  canAdvance: boolean
}): number => (!canCommission && !canAdvance ? 2 : 1)

export const backgroundSkillAllowance = (character: CharacterState): number =>
  deriveTotalBackgroundSkillAllowance(character.characteristics.edu)

export const appendCharacterCreationHistory = (
  character: CharacterState,
  event: GameEvent,
  context: { canEnterDraft?: boolean } = {}
) => {
  const historyEvent = deriveCharacterCreationHistoryEvent(event, context)

  return historyEvent
    ? [...(character.creation?.history ?? []), historyEvent]
    : [...(character.creation?.history ?? [])]
}

export const appendCharacterCreationTimeline = (
  character: CharacterState,
  envelope: Parameters<EventHandler<GameEvent>>[1]
) => {
  const timelineEntry = deriveCharacterCreationTimelineEntry(envelope)

  return timelineEntry
    ? [...(character.creation?.timeline ?? []), timelineEntry]
    : [...(character.creation?.timeline ?? [])]
}

export const cloneCareerTerm = (term: CareerTerm): CareerTerm =>
  structuredClone(term)

export const withCareerTermFacts = (
  term: CareerTerm,
  deriveFacts: (facts: CareerTermFacts) => CareerTermFacts
): CareerTerm => ({
  ...cloneCareerTerm(term),
  facts: deriveFacts(structuredClone(term.facts ?? {}))
})

export const recordTermFactsByIndex = (
  terms: readonly CareerTerm[],
  termIndex: number,
  deriveFacts: (facts: CareerTermFacts) => CareerTermFacts
) =>
  terms.map((term, index) =>
    index === termIndex
      ? withCareerTermFacts(term, deriveFacts)
      : cloneCareerTerm(term)
  )

export const recordActiveTermFacts = (
  terms: readonly CareerTerm[],
  deriveFacts: (facts: CareerTermFacts) => CareerTermFacts
) => recordTermFactsByIndex(terms, terms.length - 1, deriveFacts)

export const recordMusteringBenefit = (
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

export const recordActiveTermAdvancement = (
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

export const recordActiveTermAnagathics = (
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

export const applyCareerRank = (
  careers: readonly CareerRank[],
  career: string,
  rank: number
) =>
  careers.map((entry) =>
    entry.name === career ? { ...entry, rank } : { ...entry }
  )

export const startProjectedCareerTerm = ({
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

export const markLastTermCareerLifecycle = (
  character: CharacterState,
  lifecycle: CareerTermCareerLifecycleFact
): void => {
  if (!character.creation) return
  const lastTermIndex = character.creation.terms.length - 1
  if (lastTermIndex < 0) return

  character.creation = {
    ...character.creation,
    terms: character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...structuredClone(term),
            facts: {
              ...(term.facts ? structuredClone(term.facts) : {}),
              careerLifecycle: structuredClone(lifecycle)
            }
          }
        : structuredClone(term)
    )
  }
}

const failClosedActionPlan = ({
  state,
  pendingDecisions
}: {
  state: { status: CareerCreationActionPlan['status'] }
  pendingDecisions?: CareerCreationActionPlan['pendingDecisions']
}): CareerCreationActionPlan => ({
  status: state.status,
  pendingDecisions: pendingDecisions ?? [],
  legalActions: []
})

const refreshCharacterCreationActionPlans = (
  state: GameState | null,
  options: CharacterCreationProjectionOptions = {}
): GameState | null => {
  if (!state) return state
  const creationCharacters = Object.values(state.characters).filter(
    (
      character
    ): character is CharacterState & {
      creation: NonNullable<CharacterState['creation']>
    } => character.creation !== null
  )
  if (creationCharacters.length === 0) return state

  const resolvedRuleset = (
    options.resolveRulesetById ?? resolveDefaultRulesetData
  )(state.rulesetId)
  const ruleset = resolvedRuleset.ok ? resolvedRuleset.value : null
  for (const character of creationCharacters) {
    character.creation = ruleset
      ? projectCareerCreationActionPlan(character.creation, {
          characteristics: character.characteristics,
          ruleset
        })
      : {
          ...character.creation,
          actionPlan: failClosedActionPlan(character.creation)
        }
  }

  return state
}

export const withCharacterCreationActionPlans = <
  TEventType extends GameEvent['type'],
  THandlers extends EventHandlerMap<TEventType>
>(
  handlers: THandlers,
  options: CharacterCreationProjectionOptions = {}
): THandlers => {
  const wrapped = {} as THandlers

  for (const type of Object.keys(handlers) as (keyof THandlers)[]) {
    const handler = handlers[type] as EventHandler<GameEvent>
    wrapped[type] = ((
      state: GameState | null,
      envelope: Parameters<EventHandler<GameEvent>>[1]
    ) =>
      refreshCharacterCreationActionPlans(
        handler(state, envelope),
        options
      )) as THandlers[typeof type]
  }

  return wrapped
}
