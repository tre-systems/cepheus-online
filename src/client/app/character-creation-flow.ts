import type { Command } from '../../shared/commands'
import type { CharacterId } from '../../shared/ids'
import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacteristicKey,
  CharacterSheetPatch,
  CharacterType,
  GameState
} from '../../shared/state'
import { buildSequencedCommand, type ClientIdentity } from '../game-commands'

export type CharacterCreationStep =
  | 'basics'
  | 'characteristics'
  | 'skills'
  | 'equipment'
  | 'review'

export interface CharacterCreationDraft {
  characterId: CharacterId
  characterType: CharacterType
  name: string
  age: number | null
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
  notes: string
}

export interface CharacterCreationFlow {
  step: CharacterCreationStep
  draft: CharacterCreationDraft
}

export interface CharacterCreationValidation {
  ok: boolean
  step: CharacterCreationStep
  errors: string[]
}

export interface CharacterCreationCommandOptions {
  identity: ClientIdentity
  state?: Pick<GameState, 'eventSeq'> | null
}

export type CharacterCreationDraftPatch = Partial<
  Omit<CharacterCreationDraft, 'characteristics' | 'skills' | 'equipment'>
> & {
  characteristics?: Partial<CharacterCharacteristics>
  skills?: readonly string[]
  equipment?: readonly CharacterEquipmentItem[]
}

type CreateCharacterCommand = Extract<Command, { type: 'CreateCharacter' }>
type UpdateCharacterSheetCommand = Extract<
  Command,
  { type: 'UpdateCharacterSheet' }
>

const CHARACTER_CREATION_STEPS = [
  'basics',
  'characteristics',
  'skills',
  'equipment',
  'review'
] satisfies CharacterCreationStep[]

const CHARACTERISTIC_KEYS = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
] satisfies CharacteristicKey[]

const emptyCharacteristics = (): CharacterCharacteristics => ({
  str: null,
  dex: null,
  end: null,
  int: null,
  edu: null,
  soc: null
})

const cloneEquipment = (
  equipment: readonly CharacterEquipmentItem[]
): CharacterEquipmentItem[] =>
  equipment.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    notes: item.notes
  }))

const normalizeSkillList = (skills: readonly string[]): string[] => {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const rawSkill of skills) {
    const skill = rawSkill.trim()
    const key = skill.toLowerCase()
    if (!skill || seen.has(key)) continue
    normalized.push(skill)
    seen.add(key)
  }

  return normalized
}

const normalizeEquipmentList = (
  equipment: readonly CharacterEquipmentItem[]
): CharacterEquipmentItem[] => {
  const normalized: CharacterEquipmentItem[] = []

  for (const item of equipment) {
    const name = item.name.trim()
    if (!name) continue
    normalized.push({
      name,
      quantity:
        Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
      notes: item.notes.trim()
    })
  }

  return normalized
}

const isFiniteNonNegativeNumber = (value: number) =>
  Number.isFinite(value) && value >= 0

const stepIndex = (step: CharacterCreationStep): number =>
  CHARACTER_CREATION_STEPS.indexOf(step)

const validateBasics = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Name is required')
  if (draft.age !== null && !isFiniteNonNegativeNumber(draft.age)) {
    errors.push('Age must be a non-negative number')
  }
  return errors
}

const validateCharacteristics = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []

  for (const key of CHARACTERISTIC_KEYS) {
    const value = draft.characteristics[key]
    if (value === null) {
      errors.push(`${key.toUpperCase()} is required`)
    } else if (!Number.isFinite(value)) {
      errors.push(`${key.toUpperCase()} must be a finite number`)
    }
  }

  return errors
}

const validateSkills = (draft: CharacterCreationDraft): string[] =>
  draft.skills.length === 0 ? ['At least one skill is required'] : []

const validateEquipment = (draft: CharacterCreationDraft): string[] => {
  const errors: string[] = []
  if (!isFiniteNonNegativeNumber(draft.credits)) {
    errors.push('Credits must be a non-negative number')
  }

  for (const [index, item] of draft.equipment.entries()) {
    if (!item.name.trim()) errors.push(`Equipment ${index + 1} needs a name`)
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push(`Equipment ${index + 1} quantity must be positive`)
    }
  }

  return errors
}

const validationErrorsForStep = (
  step: CharacterCreationStep,
  draft: CharacterCreationDraft
): string[] => {
  switch (step) {
    case 'basics':
      return validateBasics(draft)
    case 'characteristics':
      return validateCharacteristics(draft)
    case 'skills':
      return validateSkills(draft)
    case 'equipment':
      return validateEquipment(draft)
    case 'review':
      return [
        ...validateBasics(draft),
        ...validateCharacteristics(draft),
        ...validateSkills(draft),
        ...validateEquipment(draft)
      ]
    default: {
      const exhaustive: never = step
      return [`Unsupported step ${exhaustive}`]
    }
  }
}

export const characterCreationSteps = (): CharacterCreationStep[] => [
  ...CHARACTER_CREATION_STEPS
]

export const createInitialCharacterDraft = (
  characterId: CharacterId,
  overrides: Partial<CharacterCreationDraft> = {}
): CharacterCreationDraft => ({
  characterId,
  characterType: overrides.characterType ?? 'PLAYER',
  name: overrides.name ?? '',
  age: overrides.age ?? null,
  characteristics: {
    ...emptyCharacteristics(),
    ...(overrides.characteristics ?? {})
  },
  skills: normalizeSkillList(overrides.skills ?? []),
  equipment: normalizeEquipmentList(overrides.equipment ?? []),
  credits: overrides.credits ?? 0,
  notes: overrides.notes ?? ''
})

export const createCharacterCreationFlow = (
  characterId: CharacterId,
  overrides: Partial<CharacterCreationDraft> = {}
): CharacterCreationFlow => ({
  step: 'basics',
  draft: createInitialCharacterDraft(characterId, overrides)
})

export const updateCharacterCreationDraft = (
  draft: CharacterCreationDraft,
  patch: CharacterCreationDraftPatch
): CharacterCreationDraft => ({
  characterId: patch.characterId ?? draft.characterId,
  characterType: patch.characterType ?? draft.characterType,
  name: patch.name ?? draft.name,
  age: patch.age ?? draft.age,
  credits: patch.credits ?? draft.credits,
  notes: patch.notes ?? draft.notes,
  characteristics: {
    ...draft.characteristics,
    ...(patch.characteristics ?? {})
  },
  skills:
    patch.skills === undefined
      ? [...draft.skills]
      : normalizeSkillList(patch.skills),
  equipment:
    patch.equipment === undefined
      ? cloneEquipment(draft.equipment)
      : normalizeEquipmentList(patch.equipment)
})

export const updateCharacterCreationFields = (
  flow: CharacterCreationFlow,
  patch: CharacterCreationDraftPatch
): CharacterCreationFlow => ({
  ...flow,
  draft: updateCharacterCreationDraft(flow.draft, patch)
})

export const validateCurrentCharacterCreationStep = (
  flow: CharacterCreationFlow
): CharacterCreationValidation => {
  const errors = validationErrorsForStep(flow.step, flow.draft)
  return {
    ok: errors.length === 0,
    step: flow.step,
    errors
  }
}

export const advanceCharacterCreationStep = (
  flow: CharacterCreationFlow
): CharacterCreationFlow => {
  const validation = validateCurrentCharacterCreationStep(flow)
  if (!validation.ok) return flow

  const nextIndex = Math.min(
    stepIndex(flow.step) + 1,
    CHARACTER_CREATION_STEPS.length - 1
  )
  return {
    ...flow,
    step: CHARACTER_CREATION_STEPS[nextIndex]
  }
}

export const backCharacterCreationStep = (
  flow: CharacterCreationFlow
): CharacterCreationFlow => {
  const previousIndex = Math.max(stepIndex(flow.step) - 1, 0)
  return {
    ...flow,
    step: CHARACTER_CREATION_STEPS[previousIndex]
  }
}

export const deriveCreateCharacterCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): CreateCharacterCommand =>
  buildSequencedCommand(
    {
      type: 'CreateCharacter',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      characterType: draft.characterType,
      name: draft.name.trim()
    },
    state
  ) as CreateCharacterCommand

export const deriveCharacterSheetPatch = (
  draft: CharacterCreationDraft
): CharacterSheetPatch => ({
  age: draft.age,
  characteristics: { ...draft.characteristics },
  skills: [...draft.skills],
  equipment: cloneEquipment(draft.equipment),
  credits: draft.credits,
  notes: draft.notes
})

export const deriveUpdateCharacterSheetCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): UpdateCharacterSheetCommand =>
  buildSequencedCommand(
    {
      type: 'UpdateCharacterSheet',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      ...deriveCharacterSheetPatch(draft)
    },
    state
  ) as UpdateCharacterSheetCommand

export const deriveCharacterCreationCommands = (
  flow: CharacterCreationFlow,
  options: CharacterCreationCommandOptions
): Command[] => {
  const validation = {
    ...validateCurrentCharacterCreationStep({
      ...flow,
      step: 'review'
    })
  }
  if (!validation.ok) return []

  return [
    deriveCreateCharacterCommand(flow.draft, options),
    deriveUpdateCharacterSheetCommand(flow.draft, options)
  ]
}
