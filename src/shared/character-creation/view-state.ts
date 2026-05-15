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
import type {
  CareerCreationActionContext,
  CareerCreationActionPlan,
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
  careers: CareerRank[]
  backgroundSkills: string[]
  pendingCascadeSkills: string[]
  characteristicChanges: CharacterCreationProjection['characteristicChanges']
  pendingDecisions: CareerCreationActionContext['pendingDecisions']
  actionContext: CareerCreationActionContext
  actionPlan: CareerCreationActionPlan
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
