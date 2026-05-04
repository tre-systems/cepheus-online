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
import { buildSequencedCommand, type ClientIdentity } from '../game-commands.js'
import { uniqueCharacterId } from './bootstrap-flow.js'

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

export interface ManualCharacterCreationFlowOptions {
  state?: Pick<GameState, 'characters'> | null
  name?: string | null
  characterType?: CharacterType
}

export interface CharacterCreationWizardResult {
  flow: CharacterCreationFlow
  validation: CharacterCreationValidation
  moved: boolean
}

export type CharacterCreationDraftPatch = Partial<
  Omit<CharacterCreationDraft, 'characteristics' | 'skills' | 'equipment'>
> & {
  characteristics?: Partial<CharacterCharacteristics>
  skills?: readonly string[]
  equipment?: readonly CharacterEquipmentItem[]
}

type CreateCharacterCommand = Extract<Command, { type: 'CreateCharacter' }>
type StartCharacterCreationCommand = Extract<
  Command,
  { type: 'StartCharacterCreation' }
>
type AdvanceCharacterCreationCommand = Extract<
  Command,
  { type: 'AdvanceCharacterCreation' }
>
type StartCharacterCareerTermCommand = Extract<
  Command,
  { type: 'StartCharacterCareerTerm' }
>
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

const defaultManualCharacterName = (
  state: Pick<GameState, 'characters'> | null
): string => `Character ${Object.keys(state?.characters || {}).length + 1}`

const sequenceCommandAt = <T extends Command>(
  command: T,
  state: Pick<GameState, 'eventSeq'> | null,
  offset: number
): T => {
  if (
    !state ||
    command.expectedSeq !== undefined ||
    command.type === 'CreateGame'
  ) {
    return command
  }

  return {
    ...command,
    expectedSeq: state.eventSeq + offset
  }
}

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

export const createManualCharacterCreationFlow = ({
  state = null,
  name = null,
  characterType = 'PLAYER'
}: ManualCharacterCreationFlowOptions = {}): CharacterCreationFlow => {
  const defaultName = defaultManualCharacterName(state)
  const draftName = name?.trim() || defaultName
  return createCharacterCreationFlow(uniqueCharacterId(state, draftName), {
    name: draftName,
    characterType
  })
}

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

export const nextCharacterCreationWizardStep = (
  flow: CharacterCreationFlow
): CharacterCreationWizardResult => {
  const validation = validateCurrentCharacterCreationStep(flow)
  if (!validation.ok) {
    return { flow, validation, moved: false }
  }

  const nextFlow = advanceCharacterCreationStep(flow)
  return {
    flow: nextFlow,
    validation: validateCurrentCharacterCreationStep(nextFlow),
    moved: nextFlow.step !== flow.step
  }
}

export const backCharacterCreationWizardStep = (
  flow: CharacterCreationFlow
): CharacterCreationWizardResult => {
  const previousFlow = backCharacterCreationStep(flow)
  return {
    flow: previousFlow,
    validation: validateCurrentCharacterCreationStep(previousFlow),
    moved: previousFlow.step !== flow.step
  }
}

export const applyParsedCharacterCreationDraftPatch = (
  flow: CharacterCreationFlow,
  patch: CharacterCreationDraftPatch
): CharacterCreationWizardResult => {
  const updatedFlow = updateCharacterCreationFields(flow, patch)
  return {
    flow: updatedFlow,
    validation: validateCurrentCharacterCreationStep(updatedFlow),
    moved: false
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

export const deriveStartCharacterCreationCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): StartCharacterCreationCommand =>
  buildSequencedCommand(
    {
      type: 'StartCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId
    },
    state
  ) as StartCharacterCreationCommand

export const deriveStartCharacterCareerTermCommand = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): StartCharacterCareerTermCommand =>
  buildSequencedCommand(
    {
      type: 'StartCharacterCareerTerm',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: draft.characterId,
      career: 'Scout'
    },
    state
  ) as StartCharacterCareerTermCommand

const initialCharacterCreationStateCommands = (
  draft: CharacterCreationDraft,
  identity: ClientIdentity
): Command[] => [
  {
    type: 'StartCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId
  },
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId,
    creationEvent: { type: 'SET_CHARACTERISTICS' }
  } satisfies AdvanceCharacterCreationCommand,
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId,
    creationEvent: { type: 'COMPLETE_HOMEWORLD' }
  } satisfies AdvanceCharacterCreationCommand,
  {
    type: 'StartCharacterCareerTerm',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId,
    career: 'Scout'
  } satisfies StartCharacterCareerTermCommand,
  {
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId,
    creationEvent: {
      type: 'SELECT_CAREER',
      isNewCareer: true
    }
  } satisfies AdvanceCharacterCreationCommand
]

export const deriveInitialCharacterCreationStateCommands = (
  draft: CharacterCreationDraft,
  { identity, state = null }: CharacterCreationCommandOptions
): Command[] => {
  if (!state) return []

  return initialCharacterCreationStateCommands(draft, identity).map(
    (command, index) => sequenceCommandAt(command, state, index)
  )
}

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
  if (!options.state) return []

  const baseCommands: Command[] = [
    {
      type: 'CreateCharacter',
      gameId: options.identity.gameId,
      actorId: options.identity.actorId,
      characterId: flow.draft.characterId,
      characterType: flow.draft.characterType,
      name: flow.draft.name.trim()
    },
    ...initialCharacterCreationStateCommands(flow.draft, options.identity),
    {
      type: 'UpdateCharacterSheet',
      gameId: options.identity.gameId,
      actorId: options.identity.actorId,
      characterId: flow.draft.characterId,
      ...deriveCharacterSheetPatch(flow.draft)
    }
  ]

  return baseCommands.map((command, index) =>
    sequenceCommandAt(command, options.state ?? null, index)
  )
}
