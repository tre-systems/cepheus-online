import type {
  CharacterCreationCareerPlan,
  CharacterCreationDraftPatch,
  CharacterCreationFlow,
  CharacterCreationStep,
  CharacterCreationValidation
} from './character-creation-flow.js'
import {
  characterCreationSteps,
  deriveCharacterCreationBasicTrainingAction,
  deriveNextCharacterCreationCharacteristicRoll,
  deriveNextCharacterCreationCareerRoll,
  validateCurrentCharacterCreationStep
} from './character-creation-flow.js'
import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacteristicKey
} from '../../shared/state'
import {
  characteristicModifier,
  parseCareerCheck
} from '../../shared/character-creation/career-rules.js'
import {
  CEPHEUS_SRD_CAREERS,
  type CepheusCareerDefinition
} from '../../shared/character-creation/cepheus-srd-ruleset.js'

export type CharacterCreationFieldKind =
  | 'number'
  | 'select'
  | 'text'
  | 'textarea'

export interface CharacterCreationFieldViewModel {
  key: string
  label: string
  kind: CharacterCreationFieldKind
  step: CharacterCreationStep
  value: string
  required: boolean
  errors: string[]
}

export interface CharacterCreationCtaLabels {
  primary: string
  secondary: string | null
}

export interface CharacterCreationStepProgressItem {
  step: CharacterCreationStep
  label: string
  index: number
  current: boolean
  complete: boolean
  invalid: boolean
  disabled: boolean
  errors: string[]
}

export interface CharacterCreationButtonState {
  label: string
  disabled: boolean
  reason: string | null
}

export interface CharacterCreationButtonStates {
  primary: CharacterCreationButtonState
  secondary: CharacterCreationButtonState | null
}

export interface CharacterCreationCareerRollButton {
  label: string
  reason: string
  disabled: boolean
}

export interface CharacterCreationCharacteristicRollButton {
  label: string
  reason: string
  disabled: boolean
}

export interface CharacterCreationBasicTrainingButton {
  label: string
  reason: string
  skills: string[]
  disabled: boolean
}

export interface CharacterCreationValidationSummary {
  ok: boolean
  step: CharacterCreationStep
  errors: string[]
  errorCount: number
  message: string
}

export interface CharacterCreationReviewItem {
  label: string
  value: string
}

export interface CharacterCreationReviewSection {
  key: CharacterCreationStep
  label: string
  items: CharacterCreationReviewItem[]
}

export interface CharacterCreationReviewSummary {
  title: string
  subtitle: string
  sections: CharacterCreationReviewSection[]
}

export type CharacterCreationFormValues = Partial<
  Record<string, string | number | null | undefined>
>

export interface CharacterCreationCareerCheckViewModel {
  label: string
  requirement: string
  available: boolean
  characteristic: CharacteristicKey | null
  target: number | null
  modifier: number
}

export interface CharacterCreationCareerOptionViewModel {
  key: string
  label: string
  selected: boolean
  qualification: CharacterCreationCareerCheckViewModel
  survival: CharacterCreationCareerCheckViewModel
  commission: CharacterCreationCareerCheckViewModel
  advancement: CharacterCreationCareerCheckViewModel
}

const characteristicDefinitions: {
  key: CharacteristicKey
  label: string
}[] = [
  { key: 'str', label: 'Str' },
  { key: 'dex', label: 'Dex' },
  { key: 'end', label: 'End' },
  { key: 'int', label: 'Int' },
  { key: 'edu', label: 'Edu' },
  { key: 'soc', label: 'Soc' }
]

export const characterCreationStepLabels: Record<
  CharacterCreationStep,
  string
> = {
  basics: 'Basics',
  characteristics: 'Characteristics',
  career: 'Career',
  skills: 'Skills',
  equipment: 'Equipment',
  review: 'Review'
}

export const characterCreationPrimaryCtaLabels: Record<
  CharacterCreationStep,
  string
> = {
  basics: 'Continue to characteristics',
  characteristics: 'Continue to career',
  career: 'Continue to skills',
  skills: 'Continue to equipment',
  equipment: 'Review character',
  review: 'Create character'
}

export const deriveCharacterCreationCtaLabels = (
  step: CharacterCreationStep
): CharacterCreationCtaLabels => ({
  primary: characterCreationPrimaryCtaLabels[step],
  secondary: step === 'basics' ? null : 'Back'
})

const stepIndex = (step: CharacterCreationStep): number =>
  characterCreationSteps().indexOf(step)

export const deriveCharacterCreationStepProgressItems = (
  flow: CharacterCreationFlow
): CharacterCreationStepProgressItem[] => {
  const currentIndex = stepIndex(flow.step)

  return characterCreationSteps().map((step, index) => {
    const validation = validationForStep(flow, step)
    const visited = index <= currentIndex
    const current = step === flow.step

    return {
      step,
      label: characterCreationStepLabels[step],
      index,
      current,
      complete: index < currentIndex && validation.ok,
      invalid: visited && !validation.ok,
      disabled: index > currentIndex,
      errors: visited ? [...validation.errors] : []
    }
  })
}

export const deriveCharacterCreationButtonStates = (
  flow: CharacterCreationFlow
): CharacterCreationButtonStates => {
  const labels = deriveCharacterCreationCtaLabels(flow.step)
  const validation = validationForStep(flow)
  const reason = validation.ok
    ? null
    : `${validation.errors.length} ${
        validation.errors.length === 1 ? 'issue' : 'issues'
      } to fix`

  return {
    primary: {
      label: labels.primary,
      disabled: !validation.ok,
      reason
    },
    secondary:
      labels.secondary === null
        ? null
        : {
            label: labels.secondary,
            disabled: false,
            reason: null
          }
  }
}

export const deriveCharacterCreationCareerRollButton = (
  flow: CharacterCreationFlow
): CharacterCreationCareerRollButton | null => {
  if (flow.step !== 'career') return null
  const action = deriveNextCharacterCreationCareerRoll(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason,
    disabled: false
  }
}

export const deriveCharacterCreationCharacteristicRollButton = (
  flow: CharacterCreationFlow
): CharacterCreationCharacteristicRollButton | null => {
  if (flow.step !== 'characteristics') return null
  const action = deriveNextCharacterCreationCharacteristicRoll(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason,
    disabled: false
  }
}

export const deriveCharacterCreationBasicTrainingButton = (
  flow: CharacterCreationFlow
): CharacterCreationBasicTrainingButton | null => {
  const action = deriveCharacterCreationBasicTrainingAction(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason,
    skills: [...action.skills],
    disabled: false
  }
}

const valueText = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const parseOptionalNumber = (
  value: string | number | null | undefined
): number | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null

  const text = String(value).trim()
  if (!text) return null

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const parseOptionalBoolean = (
  value: string | number | boolean | null | undefined
): boolean | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value

  const text = String(value).trim().toLowerCase()
  if (!text) return false
  return text === 'true' || text === '1' || text === 'yes' || text === 'on'
}

const parseNumberWithDefault = (
  value: string | number | null | undefined,
  fallback: number
): number | undefined => {
  if (value === undefined) return undefined
  if (value === null) return fallback

  const text = String(value).trim()
  if (!text) return fallback

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const splitListText = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)

const parseEquipmentText = (value: string): CharacterEquipmentItem[] =>
  value
    .split('\n')
    .map((line) => {
      const [name = '', quantity = '1', ...notes] = line
        .split('|')
        .map((part) => part.trim())
      if (!name) return null

      const parsedQuantity = Number.parseInt(quantity, 10)
      return {
        name,
        quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 1,
        notes: notes.join(' | ')
      }
    })
    .filter((item): item is CharacterEquipmentItem => item !== null)

const parseCareerPlan = (
  values: CharacterCreationFormValues
): CharacterCreationCareerPlan | undefined => {
  const keys = [
    'career',
    'qualificationRoll',
    'survivalRoll',
    'commissionRoll',
    'advancementRoll',
    'drafted'
  ]
  if (!keys.some((key) => values[key] !== undefined)) return undefined

  const drafted = parseOptionalBoolean(values.drafted)

  return {
    ...emptyCareerPlan(),
    career: valueText(values.career),
    qualificationRoll: parseOptionalNumber(values.qualificationRoll) ?? null,
    survivalRoll: parseOptionalNumber(values.survivalRoll) ?? null,
    commissionRoll: parseOptionalNumber(values.commissionRoll) ?? null,
    advancementRoll: parseOptionalNumber(values.advancementRoll) ?? null,
    drafted: drafted ?? false
  }
}

const validationForStep = (
  flow: CharacterCreationFlow,
  step: CharacterCreationStep = flow.step
): CharacterCreationValidation => {
  const validation = validateCurrentCharacterCreationStep({
    ...flow,
    step
  })
  if (step !== 'career') return validation

  const errors = [...validation.errors, ...careerRollErrors(flow.draft)]
  return {
    ok: errors.length === 0,
    step,
    errors
  }
}

const selectedCareerDefinition = (
  career: string | null | undefined,
  careers: readonly CepheusCareerDefinition[] = CEPHEUS_SRD_CAREERS
): CepheusCareerDefinition | null =>
  careers.find((candidate) => candidate.name === career) ?? null

const emptyCareerPlan = (): CharacterCreationCareerPlan => ({
  career: '',
  qualificationRoll: null,
  qualificationPassed: null,
  survivalRoll: null,
  survivalPassed: null,
  commissionRoll: null,
  commissionPassed: null,
  advancementRoll: null,
  advancementPassed: null,
  canCommission: null,
  canAdvance: null,
  drafted: false
})

const rollErrors = ({
  value,
  label,
  required
}: {
  value: number | null | undefined
  label: string
  required: boolean
}): string[] => {
  if (value === null || value === undefined) {
    return required ? [`${label} is required`] : []
  }
  if (!Number.isFinite(value)) return [`${label} must be a finite number`]
  if (value < 2 || value > 12) return [`${label} must be between 2 and 12`]
  return []
}

const careerRollErrors = ({
  careerPlan
}: Pick<CharacterCreationFlow['draft'], 'careerPlan'>): string[] => {
  const careerDefinition = selectedCareerDefinition(careerPlan?.career)
  const requiresCommission =
    careerDefinition !== null &&
    careerPlan?.survivalPassed !== false &&
    parseCareerCheck(careerDefinition.commission) !== null
  const requiresAdvancement =
    careerDefinition !== null &&
    careerPlan?.survivalPassed === true &&
    careerPlan.canCommission === false &&
    parseCareerCheck(careerDefinition.advancement) !== null

  return [
    ...rollErrors({
      value: careerPlan?.qualificationRoll,
      label: 'Qualification roll',
      required: careerPlan?.drafted !== true
    }),
    ...(careerPlan?.qualificationPassed === false && careerPlan.drafted !== true
      ? ['Qualification failed; choose a different career']
      : []),
    ...rollErrors({
      value: careerPlan?.survivalRoll,
      label: 'Survival roll',
      required: true
    }),
    ...rollErrors({
      value: careerPlan?.commissionRoll,
      label: 'Commission roll',
      required: requiresCommission
    }),
    ...rollErrors({
      value: careerPlan?.advancementRoll,
      label: 'Advancement roll',
      required: requiresAdvancement
    })
  ]
}

const fieldErrors = (
  errors: readonly string[],
  key: string,
  characteristicKey?: CharacteristicKey
): string[] =>
  errors.filter((error) => {
    if (key === 'name') return error.startsWith('Name ')
    if (key === 'age') return error.startsWith('Age ')
    if (key === 'skills') return error.startsWith('At least one skill')
    if (key === 'credits') return error.startsWith('Credits ')
    if (key === 'equipment') return error.startsWith('Equipment ')
    if (key === 'career') return error.startsWith('Career ')
    if (key === 'qualificationRoll') {
      return error.startsWith('Qualification roll ')
    }
    if (key === 'survivalRoll') return error.startsWith('Survival roll ')
    if (key === 'commissionRoll') return error.startsWith('Commission roll ')
    if (key === 'advancementRoll') return error.startsWith('Advancement roll ')
    if (characteristicKey) {
      return error.startsWith(`${characteristicKey.toUpperCase()} `)
    }
    return false
  })

export const deriveCharacterCreationValidationSummary = (
  flow: CharacterCreationFlow,
  step: CharacterCreationStep = flow.step
): CharacterCreationValidationSummary => {
  const validation = validationForStep(flow, step)
  const errorCount = validation.errors.length

  return {
    ok: validation.ok,
    step: validation.step,
    errors: [...validation.errors],
    errorCount,
    message: validation.ok
      ? 'Ready to continue'
      : `${errorCount} ${errorCount === 1 ? 'issue' : 'issues'} to fix`
  }
}

export const deriveCharacterCreationFieldViewModels = (
  flow: CharacterCreationFlow,
  step: CharacterCreationStep = flow.step
): CharacterCreationFieldViewModel[] => {
  const validation = validationForStep(flow, step)
  const { draft } = flow

  switch (step) {
    case 'basics':
      return [
        {
          key: 'name',
          label: 'Name',
          kind: 'text',
          step,
          value: draft.name,
          required: true,
          errors: fieldErrors(validation.errors, 'name')
        },
        {
          key: 'age',
          label: 'Age',
          kind: 'number',
          step,
          value: valueText(draft.age),
          required: false,
          errors: fieldErrors(validation.errors, 'age')
        },
        {
          key: 'characterType',
          label: 'Type',
          kind: 'select',
          step,
          value: draft.characterType,
          required: true,
          errors: []
        }
      ]
    case 'characteristics':
      return characteristicDefinitions.map(({ key, label }) => ({
        key,
        label,
        kind: 'number',
        step,
        value: valueText(draft.characteristics[key]),
        required: true,
        errors: fieldErrors(validation.errors, key, key)
      }))
    case 'career': {
      const careerPlan = draft.careerPlan
      const careerDefinition = selectedCareerDefinition(careerPlan?.career)
      const requiresCommission =
        careerDefinition !== null &&
        careerPlan?.survivalPassed !== false &&
        parseCareerCheck(careerDefinition.commission) !== null
      const requiresAdvancement =
        careerDefinition !== null &&
        careerPlan?.survivalPassed === true &&
        careerPlan.canCommission === false &&
        parseCareerCheck(careerDefinition.advancement) !== null

      return [
        {
          key: 'career',
          label: 'Career',
          kind: 'select',
          step,
          value: careerPlan?.career ?? '',
          required: true,
          errors: fieldErrors(validation.errors, 'career')
        },
        {
          key: 'qualificationRoll',
          label: 'Qualification roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.qualificationRoll),
          required: true,
          errors: fieldErrors(validation.errors, 'qualificationRoll')
        },
        {
          key: 'survivalRoll',
          label: 'Survival roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.survivalRoll),
          required: true,
          errors: fieldErrors(validation.errors, 'survivalRoll')
        },
        {
          key: 'commissionRoll',
          label: 'Commission roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.commissionRoll),
          required: requiresCommission,
          errors: fieldErrors(validation.errors, 'commissionRoll')
        },
        {
          key: 'advancementRoll',
          label: 'Advancement roll',
          kind: 'number',
          step,
          value: valueText(careerPlan?.advancementRoll),
          required: requiresAdvancement,
          errors: fieldErrors(validation.errors, 'advancementRoll')
        }
      ]
    }
    case 'skills':
      return [
        {
          key: 'skills',
          label: 'Skills',
          kind: 'textarea',
          step,
          value: draft.skills.join('\n'),
          required: true,
          errors: fieldErrors(validation.errors, 'skills')
        }
      ]
    case 'equipment':
      return [
        {
          key: 'equipment',
          label: 'Equipment',
          kind: 'textarea',
          step,
          value: equipmentText(draft.equipment),
          required: false,
          errors: fieldErrors(validation.errors, 'equipment')
        },
        {
          key: 'credits',
          label: 'Credits',
          kind: 'number',
          step,
          value: valueText(draft.credits),
          required: false,
          errors: fieldErrors(validation.errors, 'credits')
        },
        {
          key: 'notes',
          label: 'Notes',
          kind: 'textarea',
          step,
          value: draft.notes,
          required: false,
          errors: []
        }
      ]
    case 'review':
      return []
    default: {
      const exhaustive: never = step
      return exhaustive
    }
  }
}

export const parseCharacterCreationDraftPatch = (
  values: CharacterCreationFormValues
): CharacterCreationDraftPatch => {
  const patch: CharacterCreationDraftPatch = {}

  if (values.name !== undefined) patch.name = valueText(values.name)
  if (values.characterType !== undefined) {
    const characterType = valueText(values.characterType)
    if (
      characterType === 'PLAYER' ||
      characterType === 'NPC' ||
      characterType === 'ANIMAL' ||
      characterType === 'ROBOT'
    ) {
      patch.characterType = characterType
    }
  }
  if (values.age !== undefined) patch.age = parseOptionalNumber(values.age)
  if (values.credits !== undefined) {
    patch.credits = parseNumberWithDefault(values.credits, 0)
  }
  if (values.notes !== undefined) patch.notes = valueText(values.notes)
  if (values.skills !== undefined) {
    patch.skills = splitListText(valueText(values.skills))
  }
  if (values.equipment !== undefined) {
    patch.equipment = parseEquipmentText(valueText(values.equipment))
  }
  const careerPlan = parseCareerPlan(values)
  if (careerPlan !== undefined) patch.careerPlan = careerPlan

  const characteristics: CharacterCreationDraftPatch['characteristics'] = {}
  for (const { key } of characteristicDefinitions) {
    const value = Object.hasOwn(values, key)
      ? values[key]
      : values[`characteristics.${key}`]
    if (value !== undefined) characteristics[key] = parseOptionalNumber(value)
  }
  if (Object.keys(characteristics).length > 0) {
    patch.characteristics = characteristics
  }

  return patch
}

export const equipmentText = (
  equipment: readonly CharacterEquipmentItem[]
): string =>
  equipment
    .map((item) => [item.name, item.quantity, item.notes].join(' | '))
    .join('\n')

const itemValue = (value: string | number | null): string =>
  value === null || value === '' ? 'Not set' : String(value)

const outcomeValue = (
  roll: number | null | undefined,
  passed: boolean | null | undefined,
  unavailableLabel = 'Not set'
): string => {
  if (roll === null || roll === undefined) return unavailableLabel
  if (passed === true) return `${roll} (passed)`
  if (passed === false) return `${roll} (failed)`
  return `${roll} (not evaluated)`
}

const careerReviewItems = (
  careerPlan: CharacterCreationCareerPlan | null
): CharacterCreationReviewItem[] => [
  { label: 'Career', value: itemValue(careerPlan?.career.trim() ?? '') },
  {
    label: 'Qualification',
    value: outcomeValue(
      careerPlan?.qualificationRoll,
      careerPlan?.qualificationPassed
    )
  },
  {
    label: 'Survival',
    value: outcomeValue(careerPlan?.survivalRoll, careerPlan?.survivalPassed)
  },
  {
    label: 'Commission',
    value: outcomeValue(
      careerPlan?.commissionRoll,
      careerPlan?.commissionPassed,
      careerPlan?.canCommission === false ? 'Not available' : 'Not set'
    )
  },
  {
    label: 'Advancement',
    value: outcomeValue(
      careerPlan?.advancementRoll,
      careerPlan?.advancementPassed,
      careerPlan?.canAdvance === false ? 'Not available' : 'Not set'
    )
  }
]

const careerCheckViewModel = ({
  label,
  requirement,
  characteristics
}: {
  label: string
  requirement: string
  characteristics: Partial<CharacterCharacteristics>
}): CharacterCreationCareerCheckViewModel => {
  const check = parseCareerCheck(requirement)

  return {
    label,
    requirement,
    available: check !== null,
    characteristic: check?.characteristic ?? null,
    target: check?.target ?? null,
    modifier:
      check?.characteristic === undefined || check.characteristic === null
        ? 0
        : characteristicModifier(characteristics[check.characteristic])
  }
}

export const deriveCharacterCreationCareerOptionViewModels = (
  draft: Pick<CharacterCreationFlow['draft'], 'careerPlan' | 'characteristics'>,
  careers: readonly CepheusCareerDefinition[] = CEPHEUS_SRD_CAREERS
): CharacterCreationCareerOptionViewModel[] =>
  careers.map((career) => ({
    key: career.name,
    label: career.name,
    selected: draft.careerPlan?.career === career.name,
    qualification: careerCheckViewModel({
      label: 'Qualification',
      requirement: career.qualification,
      characteristics: draft.characteristics
    }),
    survival: careerCheckViewModel({
      label: 'Survival',
      requirement: career.survival,
      characteristics: draft.characteristics
    }),
    commission: careerCheckViewModel({
      label: 'Commission',
      requirement: career.commission,
      characteristics: draft.characteristics
    }),
    advancement: careerCheckViewModel({
      label: 'Advancement',
      requirement: career.advancement,
      characteristics: draft.characteristics
    })
  }))

export const deriveCharacterCreationReviewSummary = (
  flow: CharacterCreationFlow
): CharacterCreationReviewSummary => {
  const { draft } = flow
  const skills = draft.skills.length > 0 ? draft.skills.join(', ') : 'Not set'
  const equipment =
    draft.equipment.length > 0
      ? draft.equipment
          .map((item) => `${item.name} x${item.quantity}`)
          .join(', ')
      : 'None'

  return {
    title: draft.name.trim() || 'Unnamed character',
    subtitle: draft.characterType,
    sections: [
      {
        key: 'basics',
        label: characterCreationStepLabels.basics,
        items: [
          { label: 'Name', value: itemValue(draft.name.trim()) },
          { label: 'Type', value: draft.characterType },
          { label: 'Age', value: itemValue(draft.age) }
        ]
      },
      {
        key: 'characteristics',
        label: characterCreationStepLabels.characteristics,
        items: characteristicDefinitions.map(({ key, label }) => ({
          label,
          value: itemValue(draft.characteristics[key])
        }))
      },
      {
        key: 'career',
        label: characterCreationStepLabels.career,
        items: careerReviewItems(draft.careerPlan)
      },
      {
        key: 'skills',
        label: characterCreationStepLabels.skills,
        items: [{ label: 'Skills', value: skills }]
      },
      {
        key: 'equipment',
        label: characterCreationStepLabels.equipment,
        items: [
          { label: 'Equipment', value: equipment },
          { label: 'Credits', value: itemValue(draft.credits) },
          { label: 'Notes', value: itemValue(draft.notes.trim()) }
        ]
      }
    ]
  }
}
