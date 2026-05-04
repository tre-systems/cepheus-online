import type { Command } from '../../shared/commands'
import {
  evaluateCareerCheck,
  parseCareerCheck
} from '../../shared/character-creation/career-rules.js'
import {
  CEPHEUS_SRD_CAREERS,
  type CepheusCareerDefinition
} from '../../shared/character-creation/cepheus-srd-ruleset.js'
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
  | 'career'
  | 'skills'
  | 'equipment'
  | 'review'

export interface CharacterCreationCareerPlan {
  career: string
  qualificationRoll: number | null
  qualificationPassed: boolean | null
  survivalRoll: number | null
  survivalPassed: boolean | null
  commissionRoll: number | null
  commissionPassed: boolean | null
  advancementRoll: number | null
  advancementPassed: boolean | null
  canCommission: boolean | null
  canAdvance: boolean | null
  drafted: boolean
}

export interface CharacterCreationDraft {
  characterId: CharacterId
  characterType: CharacterType
  name: string
  age: number | null
  characteristics: CharacterCharacteristics
  careerPlan: CharacterCreationCareerPlan | null
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
  Omit<
    CharacterCreationDraft,
    'characteristics' | 'careerPlan' | 'skills' | 'equipment'
  >
> & {
  characteristics?: Partial<CharacterCharacteristics>
  careerPlan?: CharacterCreationCareerPlan | null
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
  'career',
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

const createCareerPlan = (
  overrides: Partial<CharacterCreationCareerPlan> = {}
): CharacterCreationCareerPlan => ({
  career: overrides.career ?? '',
  qualificationRoll: overrides.qualificationRoll ?? null,
  qualificationPassed: overrides.qualificationPassed ?? null,
  survivalRoll: overrides.survivalRoll ?? null,
  survivalPassed: overrides.survivalPassed ?? null,
  commissionRoll: overrides.commissionRoll ?? null,
  commissionPassed: overrides.commissionPassed ?? null,
  advancementRoll: overrides.advancementRoll ?? null,
  advancementPassed: overrides.advancementPassed ?? null,
  canCommission: overrides.canCommission ?? null,
  canAdvance: overrides.canAdvance ?? null,
  drafted: overrides.drafted ?? false
})

const cloneCareerPlan = (
  plan: CharacterCreationCareerPlan | null
): CharacterCreationCareerPlan | null =>
  plan
    ? {
        career: plan.career,
        qualificationRoll: plan.qualificationRoll,
        qualificationPassed: plan.qualificationPassed,
        survivalRoll: plan.survivalRoll,
        survivalPassed: plan.survivalPassed,
        commissionRoll: plan.commissionRoll,
        commissionPassed: plan.commissionPassed,
        advancementRoll: plan.advancementRoll,
        advancementPassed: plan.advancementPassed,
        canCommission: plan.canCommission,
        canAdvance: plan.canAdvance,
        drafted: plan.drafted
      }
    : null

const normalizeCareerPlan = (
  plan: CharacterCreationCareerPlan | null | undefined
): CharacterCreationCareerPlan | null =>
  plan
    ? createCareerPlan({
        ...plan,
        career: plan.career.trim()
      })
    : null

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

const validateCareer = (draft: CharacterCreationDraft): string[] =>
  draft.careerPlan?.career.trim() ? [] : ['Career is required']

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
    case 'career':
      return validateCareer(draft)
    case 'skills':
      return validateSkills(draft)
    case 'equipment':
      return validateEquipment(draft)
    case 'review':
      return [
        ...validateBasics(draft),
        ...validateCharacteristics(draft),
        ...validateCareer(draft),
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
  careerPlan: normalizeCareerPlan(overrides.careerPlan),
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
  careerPlan:
    patch.careerPlan === undefined
      ? cloneCareerPlan(draft.careerPlan)
      : normalizeCareerPlan(patch.careerPlan),
  skills:
    patch.skills === undefined
      ? [...draft.skills]
      : normalizeSkillList(patch.skills),
  equipment:
    patch.equipment === undefined
      ? cloneEquipment(draft.equipment)
      : normalizeEquipmentList(patch.equipment)
})

export const characterCreationCareerNames = (): string[] =>
  CEPHEUS_SRD_CAREERS.map((career) => career.name)

export const selectCharacterCreationCareerPlan = (
  career: string,
  overrides: Partial<Omit<CharacterCreationCareerPlan, 'career'>> = {}
): CharacterCreationCareerPlan => createCareerPlan({ ...overrides, career })

const findCareerDefinition = (
  careerName: string
): CepheusCareerDefinition | null =>
  CEPHEUS_SRD_CAREERS.find((career) => career.name === careerName) ?? null

const evaluateOptionalCareerRoll = ({
  check,
  characteristics,
  roll
}: {
  check: string
  characteristics: Partial<CharacterCharacteristics>
  roll: number | null
}): boolean | null => {
  if (roll === null || !Number.isFinite(roll)) return null
  return evaluateCareerCheck({ check, characteristics, roll })?.success ?? null
}

export const evaluateCharacterCreationCareerPlan = (
  draft: Pick<CharacterCreationDraft, 'characteristics'>,
  plan: CharacterCreationCareerPlan
): CharacterCreationCareerPlan => {
  const normalizedPlan = normalizeCareerPlan(plan) ?? createCareerPlan()
  const careerDefinition = findCareerDefinition(normalizedPlan.career)
  if (!careerDefinition) return normalizedPlan

  const qualificationPassed = evaluateOptionalCareerRoll({
    check: careerDefinition.qualification,
    characteristics: draft.characteristics,
    roll: normalizedPlan.qualificationRoll
  })
  const survivalPassed = evaluateOptionalCareerRoll({
    check: careerDefinition.survival,
    characteristics: draft.characteristics,
    roll: normalizedPlan.survivalRoll
  })
  const canCommission =
    survivalPassed === false
      ? false
      : parseCareerCheck(careerDefinition.commission) !== null
  const canAdvance =
    survivalPassed === false || canCommission
      ? false
      : parseCareerCheck(careerDefinition.advancement) !== null

  return {
    ...normalizedPlan,
    qualificationPassed,
    survivalPassed,
    commissionPassed: evaluateOptionalCareerRoll({
      check: careerDefinition.commission,
      characteristics: draft.characteristics,
      roll: normalizedPlan.commissionRoll
    }),
    advancementPassed: evaluateOptionalCareerRoll({
      check: careerDefinition.advancement,
      characteristics: draft.characteristics,
      roll: normalizedPlan.advancementRoll
    }),
    canCommission,
    canAdvance
  }
}

export const applyCharacterCreationCareerPlan = (
  draft: CharacterCreationDraft,
  plan: CharacterCreationCareerPlan
): CharacterCreationDraft =>
  updateCharacterCreationDraft(draft, {
    careerPlan: evaluateCharacterCreationCareerPlan(draft, plan)
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
  const careerPlanNeedsEvaluation =
    patch.careerPlan !== undefined || patch.characteristics !== undefined
  const evaluatedFlow =
    careerPlanNeedsEvaluation && updatedFlow.draft.careerPlan !== null
      ? {
          ...updatedFlow,
          draft: applyCharacterCreationCareerPlan(
            updatedFlow.draft,
            updatedFlow.draft.careerPlan
          )
        }
      : updatedFlow

  return {
    flow: evaluatedFlow,
    validation: validateCurrentCharacterCreationStep(evaluatedFlow),
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
      career: draft.careerPlan?.career.trim() ?? '',
      ...(draft.careerPlan?.drafted ? { drafted: true } : {})
    },
    state
  ) as StartCharacterCareerTermCommand

const initialCharacterCreationStateCommands = (
  draft: CharacterCreationDraft,
  identity: ClientIdentity
): Command[] => {
  const careerPlan = draft.careerPlan
  const baseCommand = {
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: draft.characterId
  }
  const advance = (
    creationEvent: AdvanceCharacterCreationCommand['creationEvent']
  ): AdvanceCharacterCreationCommand => ({
    type: 'AdvanceCharacterCreation',
    ...baseCommand,
    creationEvent
  })
  const commands: Command[] = [
    {
      type: 'StartCharacterCreation',
      ...baseCommand
    },
    advance({ type: 'SET_CHARACTERISTICS' }),
    advance({ type: 'COMPLETE_HOMEWORLD' }),
    {
      type: 'StartCharacterCareerTerm',
      ...baseCommand,
      career: careerPlan?.career.trim() ?? '',
      ...(careerPlan?.drafted ? { drafted: true } : {})
    } satisfies StartCharacterCareerTermCommand,
    advance({
      type: 'SELECT_CAREER',
      isNewCareer: true,
      ...(careerPlan?.drafted ? { drafted: true } : {})
    })
  ]

  if (careerPlan && careerPlan.survivalPassed !== null) {
    commands.push(advance({ type: 'COMPLETE_BASIC_TRAINING' }))
    commands.push(
      careerPlan.survivalPassed
        ? advance({
            type: 'SURVIVAL_PASSED',
            canCommission: careerPlan.canCommission ?? false,
            canAdvance: careerPlan.canAdvance ?? false
          })
        : advance({ type: 'SURVIVAL_FAILED' })
    )
  }

  return commands
}

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
