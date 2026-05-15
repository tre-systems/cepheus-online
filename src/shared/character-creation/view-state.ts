import type { CharacterId, UserId } from '../ids'
import type {
  CharacterCreationProjection,
  CharacterEquipmentItem,
  CharacterState,
  CharacterCharacteristics
} from '../state'
import {
  deriveCareerCreationActionContext,
  deriveCareerCreationActionPlan
} from './legal-actions'
import {
  deriveCareerTermSkillRollSummaries,
  hasProjectedCareerTermFacts,
  type CareerTermSkillRollSummary
} from './term-skills'
import type {
  CareerCreationActionContext,
  CareerCreationActionPlan,
  CareerCreationReenlistmentOutcome,
  CareerCreationStatus,
  CharacterCreationTimelineEntry,
  CareerRank,
  CareerTerm
} from './types'

export type CharacterCreationProcedureStep =
  | 'characteristics'
  | 'homeworld'
  | 'career'
  | 'skills'
  | 'review'

export interface CharacterCreationProjectionReadModel {
  status: CareerCreationStatus
  statusLabel: string
  step: CharacterCreationProcedureStep
  creationComplete: boolean
  isActive: boolean
  isPlayable: boolean
  isDeceased: boolean
  termCount: number
  completedTermCount: number
  timelineCount: number
  timeline: CharacterCreationTimelineEntry[]
  activeTerm: CareerTerm | null
  terms: CareerTerm[]
  completedTerms: CharacterCreationCompletedTermReadModel[]
  careers: CareerRank[]
  backgroundSkills: string[]
  pendingCascadeSkills: string[]
  characteristicChanges: CharacterCreationProjection['characteristicChanges']
  pendingDecisions: CareerCreationActionContext['pendingDecisions']
  actionContext: CareerCreationActionContext
  actionPlan: CareerCreationActionPlan
}

export interface CharacterCreationCompletedTermReadModel {
  career: string
  drafted: boolean
  anagathics: boolean
  anagathicsCost: number | null
  age: number | null
  rank: number | null
  rankTitle: string | null
  rankBonusSkill: string | null
  qualificationRoll: number | null
  survivalRoll: number | null
  survivalPassed: boolean
  canCommission: boolean
  commissionRoll: number | null
  commissionPassed: boolean | null
  canAdvance: boolean
  advancementRoll: number | null
  advancementPassed: boolean | null
  termSkillRolls: CareerTermSkillRollSummary[]
  agingRoll: number | null
  agingMessage: string | null
  benefitForfeiture: 'forfeit_current_term' | 'lose_all' | null
  reenlistmentRoll: number | null
  reenlistmentOutcome: CareerCreationReenlistmentOutcome | null
  legacyProjection: boolean
}

export interface CharacterCreationSheetPreview {
  age: number | null
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
}

export interface CharacterCreationReadModel
  extends CharacterCreationProjectionReadModel {
  characterId: CharacterId
  name: string
  ownerId: UserId | null
  rolledCharacteristicCount: number
  sheet: CharacterCreationSheetPreview
}

export const characterCreationStatusLabel = (
  status: string | null | undefined
): string =>
  String(status || 'CREATION')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')

export const characterCreationStepFromStatus = (
  status: CareerCreationStatus | string
): CharacterCreationProcedureStep => {
  switch (status) {
    case 'CHARACTERISTICS':
      return 'characteristics'
    case 'HOMEWORLD':
      return 'homeworld'
    case 'BASIC_TRAINING':
      return 'skills'
    case 'ACTIVE':
    case 'PLAYABLE':
      return 'review'
    default:
      return 'career'
  }
}

const cloneTerm = (term: CareerTerm): CareerTerm => ({
  ...term,
  skills: [...term.skills],
  skillsAndTraining: [...term.skillsAndTraining],
  benefits: [...term.benefits]
})

const cloneEquipment = (
  equipment: readonly CharacterEquipmentItem[]
): CharacterEquipmentItem[] => equipment.map((item) => ({ ...item }))

const cloneTimelineEntry = (
  entry: CharacterCreationTimelineEntry
): CharacterCreationTimelineEntry => ({ ...entry })

const completedTermFromSemanticFacts = (
  term: CareerTerm
): CharacterCreationCompletedTermReadModel => {
  const facts = term.facts
  const commission = facts?.commission
  const advancement = facts?.advancement
  const rank = advancement && !advancement.skipped ? advancement.rank : null

  return {
    career: term.career,
    drafted: facts?.draft !== undefined,
    anagathics: facts?.anagathicsDecision?.useAnagathics ?? false,
    anagathicsCost: facts?.anagathicsDecision?.cost ?? null,
    age: facts?.aging?.age ?? null,
    rank: rank?.newRank ?? null,
    rankTitle: rank?.title ?? null,
    rankBonusSkill: rank?.bonusSkill ?? null,
    qualificationRoll: facts?.qualification?.qualification.total ?? null,
    survivalRoll: facts?.survival?.survival.total ?? null,
    survivalPassed: facts?.survival?.passed ?? true,
    canCommission: facts?.survival?.canCommission ?? false,
    commissionRoll:
      commission?.skipped === true
        ? -1
        : (commission?.commission.total ?? null),
    commissionPassed:
      commission?.skipped === true ? false : (commission?.passed ?? null),
    canAdvance: facts?.survival?.canAdvance ?? false,
    advancementRoll:
      advancement?.skipped === true
        ? -1
        : (advancement?.advancement.total ?? null),
    advancementPassed:
      advancement?.skipped === true ? false : (advancement?.passed ?? null),
    termSkillRolls: deriveCareerTermSkillRollSummaries(term),
    agingRoll: facts?.aging?.roll.total ?? null,
    agingMessage:
      facts?.aging && facts.aging.characteristicChanges.length > 0
        ? 'losses required'
        : null,
    benefitForfeiture: facts?.mishap?.outcome.benefitEffect ?? null,
    reenlistmentRoll: facts?.reenlistment?.reenlistment.total ?? null,
    reenlistmentOutcome: facts?.reenlistment?.outcome ?? null,
    legacyProjection: false
  }
}

const completedTermFromLegacyAggregate = (
  term: CareerTerm
): CharacterCreationCompletedTermReadModel => ({
  career: term.career,
  drafted: term.draft === 1,
  anagathics: term.anagathics,
  anagathicsCost: term.anagathicsCost ?? null,
  age: null,
  rank: null,
  rankTitle: null,
  rankBonusSkill: null,
  qualificationRoll: null,
  survivalRoll: term.survival ?? null,
  survivalPassed: term.survival == null ? true : term.complete,
  canCommission: false,
  commissionRoll: null,
  commissionPassed: null,
  canAdvance: false,
  advancementRoll: term.advancement ?? null,
  advancementPassed: null,
  termSkillRolls: term.skillsAndTraining.map((skill) => ({
    table: 'serviceSkills',
    roll: 0,
    skill
  })),
  agingRoll: null,
  agingMessage: null,
  benefitForfeiture: null,
  reenlistmentRoll: term.reEnlistment ?? null,
  reenlistmentOutcome: term.canReenlist ? 'allowed' : 'blocked',
  legacyProjection: true
})

const completedTermReadModel = (
  term: CareerTerm
): CharacterCreationCompletedTermReadModel =>
  hasProjectedCareerTermFacts(term)
    ? completedTermFromSemanticFacts(term)
    : completedTermFromLegacyAggregate(term)

export const deriveCharacterCreationProjectionReadModel = (
  creation: CharacterCreationProjection
): CharacterCreationProjectionReadModel => {
  const actionContext = deriveCareerCreationActionContext(creation)
  const actionPlan =
    creation.actionPlan ?? deriveCareerCreationActionPlan(creation)
  const terms = creation.terms.map(cloneTerm)
  const status = creation.state.status

  return {
    status,
    statusLabel: characterCreationStatusLabel(status),
    step: characterCreationStepFromStatus(status),
    creationComplete: creation.creationComplete,
    isActive:
      !creation.creationComplete &&
      status !== 'PLAYABLE' &&
      status !== 'DECEASED',
    isPlayable: status === 'PLAYABLE',
    isDeceased: status === 'DECEASED',
    termCount: terms.length,
    completedTermCount: terms.filter(
      (term) => term.complete || term.musteringOut
    ).length,
    timelineCount: creation.timeline?.length ?? 0,
    timeline: (creation.timeline ?? []).map(cloneTimelineEntry),
    activeTerm: terms.at(-1) ?? null,
    terms,
    completedTerms: terms
      .filter((term) => term.complete || term.musteringOut)
      .map(completedTermReadModel),
    careers: creation.careers.map((career) => ({ ...career })),
    backgroundSkills: [...(creation.backgroundSkills ?? [])],
    pendingCascadeSkills: [...(creation.pendingCascadeSkills ?? [])],
    characteristicChanges: creation.characteristicChanges.map((change) => ({
      ...change
    })),
    pendingDecisions: [...(actionContext.pendingDecisions ?? [])],
    actionContext,
    actionPlan
  }
}

export const deriveCharacterCreationReadModel = (
  character: CharacterState
): CharacterCreationReadModel | null => {
  if (!character.creation) return null

  const projection = deriveCharacterCreationProjectionReadModel(
    character.creation
  )

  return {
    ...projection,
    characterId: character.id,
    name: character.name || 'Traveller',
    ownerId: character.ownerId,
    rolledCharacteristicCount: Object.values(character.characteristics).filter(
      (value) => value !== null
    ).length,
    sheet: {
      age: character.age,
      characteristics: { ...character.characteristics },
      skills: [...character.skills],
      equipment: cloneEquipment(character.equipment),
      credits: character.credits
    }
  }
}
