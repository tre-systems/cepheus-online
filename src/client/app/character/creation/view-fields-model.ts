import { parseCareerCheck } from '../../../../shared/character-creation/career-rules'
import {
  CEPHEUS_SRD_CAREERS,
  type CepheusCareerDefinition
} from '../../../../shared/character-creation/cepheus-srd-ruleset'
import type {
  CharacterEquipmentItem,
  CharacteristicKey
} from '../../../../shared/state'
import type {
  CharacterCreationCareerPlan,
  CharacterCreationDraftPatch,
  CharacterCreationFlow,
  CharacterCreationValidation
} from './flow'
import { validateCurrentCharacterCreationStep } from './flow'
import { characteristicDefinitions } from './view-format'
import { selectedHomeworld, selectedTradeCodes } from './view-homeworld-model'
import type {
  CharacterCreationFieldViewModel,
  CharacterCreationFormValues,
  CharacterCreationViewRulesOptions,
  CharacterCreationViewStep
} from './view-types'

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
  drafted: false,
  anagathics: null
})

const parseCareerPlan = (
  values: CharacterCreationFormValues
): CharacterCreationCareerPlan | undefined => {
  const keys = [
    'career',
    'qualificationRoll',
    'qualificationPassed',
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
    qualificationPassed:
      parseOptionalBoolean(values.qualificationPassed) ?? null,
    survivalRoll: parseOptionalNumber(values.survivalRoll) ?? null,
    commissionRoll: parseOptionalNumber(values.commissionRoll) ?? null,
    advancementRoll: parseOptionalNumber(values.advancementRoll) ?? null,
    drafted: drafted ?? false
  }
}

const parseHomeworld = (
  values: CharacterCreationFormValues
): CharacterCreationDraftPatch['homeworld'] | undefined => {
  const lawLevel = values['homeworld.lawLevel'] ?? values.lawLevel
  const tradeCodes = values['homeworld.tradeCodes'] ?? values.tradeCodes
  if (lawLevel === undefined && tradeCodes === undefined) return undefined

  return {
    lawLevel:
      lawLevel === undefined ? null : valueText(lawLevel).trim() || null,
    tradeCodes:
      tradeCodes === undefined ? [] : splitListText(valueText(tradeCodes))
  }
}

const selectedCareerDefinition = (
  career: string | null | undefined,
  careers: readonly CepheusCareerDefinition[] = CEPHEUS_SRD_CAREERS
): CepheusCareerDefinition | null =>
  careers.find((candidate) => candidate.name === career) ?? null

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
  if (value === -1) return []
  if (!Number.isFinite(value)) return [`${label} must be a finite number`]
  if (value < 2 || value > 12) return [`${label} must be between 2 and 12`]
  return []
}

const careerRollErrors = (
  { careerPlan }: Pick<CharacterCreationFlow['draft'], 'careerPlan'>,
  options: Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): string[] => {
  const careerDefinition = selectedCareerDefinition(
    careerPlan?.career,
    options.careers
  )
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
      required:
        careerPlan?.drafted !== true &&
        !(
          careerPlan?.qualificationPassed === true &&
          careerPlan.qualificationRoll === null
        )
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

export const validationForStep = (
  flow: CharacterCreationFlow,
  step: CharacterCreationViewStep = flow.step,
  options: CharacterCreationViewRulesOptions = {}
): CharacterCreationValidation & { step: CharacterCreationViewStep } => {
  const validation = validateCurrentCharacterCreationStep({
    ...flow,
    step
  })
  if (step !== 'career') return validation

  const errors = [
    ...validation.errors,
    ...careerRollErrors(flow.draft, options)
  ]
  return {
    ok: errors.length === 0,
    step,
    errors
  }
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
    if (key === 'career') return error.startsWith('Career is ')
    if (key === 'homeworld.lawLevel') {
      return error.startsWith('Homeworld law level ')
    }
    if (key === 'homeworld.tradeCodes') {
      return error.startsWith('Homeworld trade code ')
    }
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

export const deriveCharacterCreationFieldViewModels = (
  flow: CharacterCreationFlow,
  step: CharacterCreationViewStep = flow.step,
  options: Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): CharacterCreationFieldViewModel[] => {
  const validation = validationForStep(flow, step, options)
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
    case 'homeworld': {
      const homeworld = selectedHomeworld(draft)
      return [
        {
          key: 'homeworld.lawLevel',
          label: 'Law level',
          kind: 'text',
          step,
          value: homeworld.lawLevel ?? '',
          required: true,
          errors: fieldErrors(validation.errors, 'homeworld.lawLevel')
        },
        {
          key: 'homeworld.tradeCodes',
          label: 'Trade code',
          kind: 'text',
          step,
          value: selectedTradeCodes(homeworld.tradeCodes).join(', '),
          required: true,
          errors: fieldErrors(validation.errors, 'homeworld.tradeCodes')
        }
      ]
    }
    case 'career': {
      const careerPlan = draft.careerPlan
      const careerDefinition = selectedCareerDefinition(
        careerPlan?.career,
        options.careers
      )
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
          required:
            careerPlan?.drafted !== true &&
            !(
              careerPlan?.qualificationPassed === true &&
              careerPlan.qualificationRoll === null
            ),
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
  const homeworld = parseHomeworld(values)
  if (homeworld !== undefined) patch.homeworld = homeworld

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
