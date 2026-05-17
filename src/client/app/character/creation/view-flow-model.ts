import { tallyCareerSkills } from '../../../../shared/character-creation/skills'
import type {
  BasicTrainingActionOption,
  CareerCreationActionKey,
  CascadeSkillChoice
} from '../../../../shared/character-creation/types'
import type { CharacteristicKey } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow'
import {
  characterCreationSteps,
  deriveCharacterCreationBasicTrainingAction,
  deriveCharacterCreationCareerSkipAction,
  deriveNextCharacterCreationCareerRoll,
  deriveNextCharacterCreationCharacteristicRoll
} from './flow'
import { deriveCharacterCreationDeathViewModel } from './view-career-lifecycle-model'
import { plural } from './view-common'
import {
  deriveCharacterCreationFieldViewModels,
  validationForStep
} from './view-fields-model'
import {
  characterCreationCharacteristicModifier,
  characterCreationPrimaryCtaLabels,
  characterCreationStepLabels,
  characteristicDefinitions,
  formatCharacterCreationCharacteristicModifier
} from './view-format'
import {
  deriveCharacterCreationBackgroundSkillSummary,
  pendingCascadeChoiceViewModel
} from './view-homeworld-model'
import type {
  CharacterCreationBasicTrainingButton,
  CharacterCreationButtonStates,
  CharacterCreationCareerRollButton,
  CharacterCreationCharacteristicGridViewModel,
  CharacterCreationCharacteristicRollButton,
  CharacterCreationCtaLabels,
  CharacterCreationNextStepViewModel,
  CharacterCreationSkillStripViewModel,
  CharacterCreationStatStripItem,
  CharacterCreationStepProgressItem,
  CharacterCreationValidationSummary,
  CharacterCreationViewRulesOptions,
  CharacterCreationViewStep
} from './view-types'

export const deriveCharacterCreationCtaLabels = (
  step: CharacterCreationViewStep
): CharacterCreationCtaLabels => ({
  primary: characterCreationPrimaryCtaLabels[step],
  secondary: step === 'basics' ? null : 'Back'
})

export const characterCreationViewSteps = (): CharacterCreationViewStep[] =>
  characterCreationSteps()

const stepIndex = (step: CharacterCreationViewStep): number =>
  characterCreationViewSteps().indexOf(step)

export const deriveCharacterCreationStepProgressItems = (
  flow: CharacterCreationFlow,
  options: CharacterCreationViewRulesOptions = {}
): CharacterCreationStepProgressItem[] => {
  const currentIndex = stepIndex(flow.step)

  return characterCreationViewSteps().map((step, index) => {
    const validation = validationForStep(flow, step, options)
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
  flow: CharacterCreationFlow,
  options: CharacterCreationViewRulesOptions = {}
): CharacterCreationButtonStates => {
  const labels = deriveCharacterCreationCtaLabels(flow.step)
  const validation = validationForStep(flow, flow.step, options)
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
  flow: CharacterCreationFlow,
  {
    availableActionKeys
  }: { availableActionKeys?: ReadonlySet<CareerCreationActionKey> } = {}
): CharacterCreationCareerRollButton | null => {
  if (flow.step !== 'career') return null
  const action = deriveNextCharacterCreationCareerRoll(flow)
  if (!action) return null
  const requiredAction: Partial<
    Record<CharacterCreationCareerRollButton['key'], CareerCreationActionKey>
  > = {
    qualificationRoll: 'selectCareer',
    survivalRoll: 'rollSurvival',
    commissionRoll: 'rollCommission',
    advancementRoll: 'rollAdvancement'
  }
  const requiredActionKey = requiredAction[action.key]
  if (
    availableActionKeys &&
    requiredActionKey &&
    !availableActionKeys.has(requiredActionKey)
  ) {
    return null
  }

  return {
    key: action.key,
    label: action.label,
    reason: action.reason,
    disabled: false,
    skipLabel: deriveCharacterCreationCareerSkipAction(flow)?.label ?? null
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
  flow: CharacterCreationFlow,
  {
    basicTrainingOptions
  }: { basicTrainingOptions?: BasicTrainingActionOption } = {}
): CharacterCreationBasicTrainingButton | null => {
  if (basicTrainingOptions && flow.step === 'skills') {
    if (basicTrainingOptions.kind === 'none') return null
    const careerName = flow.draft.careerPlan?.career.trim()
    if (!careerName || basicTrainingOptions.skills.length === 0) return null

    return {
      label:
        basicTrainingOptions.kind === 'choose-one'
          ? 'Choose basic training'
          : 'Apply basic training',
      reason:
        basicTrainingOptions.kind === 'choose-one'
          ? `Choose one ${careerName} service skill at level 0`
          : `First ${careerName} term grants service skills at level 0`,
      skills: [...basicTrainingOptions.skills],
      kind: basicTrainingOptions.kind,
      disabled: false
    }
  }

  const action = deriveCharacterCreationBasicTrainingAction(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason,
    skills: [...action.skills],
    kind: action.kind,
    disabled: false
  }
}

export const deriveCharacterCreationStatStrip = (
  flow: Pick<CharacterCreationFlow, 'draft'>
): CharacterCreationStatStripItem[] =>
  characteristicDefinitions.map(({ key, label }) => {
    const value = flow.draft.characteristics[key]
    return {
      key,
      label,
      value: value === null ? '-' : String(value),
      modifier:
        value === null ? '-' : characterCreationCharacteristicModifier(value),
      missing: value === null
    }
  })

export const deriveCharacterCreationSkillStrip = (
  flow: Pick<CharacterCreationFlow, 'draft'>
): CharacterCreationSkillStripViewModel => {
  const pendingTermCascadeSkills = new Set(flow.draft.pendingTermCascadeSkills)
  const skills = tallyCareerSkills([
    ...flow.draft.backgroundSkills,
    ...flow.draft.skills.filter((skill) => !pendingTermCascadeSkills.has(skill))
  ])

  return {
    skills,
    summary: skills.join(', ')
  }
}

export const deriveCharacterCreationCharacteristicGridViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationCharacteristicGridViewModel | null => {
  if (flow.step !== 'characteristics') return null

  return {
    open: true,
    stats: deriveCharacterCreationFieldViewModels(flow, 'characteristics').map(
      (field) => {
        const key = field.key as CharacteristicKey
        const missing = field.value === ''
        return {
          key,
          label: field.label,
          value: field.value,
          modifier: missing
            ? ''
            : formatCharacterCreationCharacteristicModifier(field.value),
          missing,
          errors: [...field.errors],
          rollLabel: `Roll ${field.label}`
        }
      }
    )
  }
}

export const deriveCharacterCreationValidationSummary = (
  flow: CharacterCreationFlow,
  step: CharacterCreationViewStep = flow.step,
  options: Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): CharacterCreationValidationSummary => {
  const validation = validationForStep(flow, step, options)
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

const characterCreationPrompt = (
  flow: CharacterCreationFlow,
  validation: CharacterCreationValidationSummary,
  options: Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): string => {
  switch (flow.step) {
    case 'basics':
      return 'Name the traveller and choose the sheet type.'
    case 'characteristics': {
      const roll = deriveCharacterCreationCharacteristicRollButton(flow)
      return roll ? '' : 'Characteristics are ready.'
    }
    case 'homeworld': {
      const summary = deriveCharacterCreationBackgroundSkillSummary(
        flow,
        options
      )
      if (
        validation.errors.includes('Homeworld law level is required') ||
        validation.errors.includes('Homeworld trade code is required')
      ) {
        return 'Choose homeworld law level and trade codes.'
      }
      if (summary.pendingCascadeSkills.length > 0) {
        const choice = pendingCascadeChoiceViewModel(
          flow.draft.pendingCascadeSkills,
          [],
          options
        )
        return choice
          ? `Choose a ${choice.label} specialty.`
          : `${plural(
              summary.pendingCascadeSkills.length,
              'cascade choice',
              'cascade choices'
            )} must be resolved.`
      }
      if (summary.remainingSelections > 0) {
        return `Choose ${plural(
          summary.remainingSelections,
          'more background skill',
          'more background skills'
        )}.`
      }
      return 'Homeworld and background skills are ready.'
    }
    case 'career':
      if (deriveCharacterCreationDeathViewModel(flow)) {
        return 'The survival roll failed. This traveller is dead.'
      }
      return deriveCharacterCreationCareerRollButton(flow)
        ? 'Resolve the current career term rolls.'
        : 'Choose a career and confirm term results.'
    case 'skills':
      return deriveCharacterCreationBasicTrainingButton(flow)
        ? 'Apply basic training or enter skills manually.'
        : 'Review the skill list before equipment.'
    case 'equipment':
      return 'Add starting equipment, credits, and notes.'
    case 'review':
      return validation.ok
        ? 'Review the complete character before creating it.'
        : 'Fix the highlighted character details before creating it.'
    default: {
      const exhaustive: never = flow.step
      return exhaustive
    }
  }
}

export const deriveCharacterCreationNextStepViewModel = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
  } & CharacterCreationViewRulesOptions = {}
): CharacterCreationNextStepViewModel => {
  const validation = deriveCharacterCreationValidationSummary(
    flow,
    flow.step,
    options
  )
  const buttons = deriveCharacterCreationButtonStates(flow, options)
  const blockingChoice =
    flow.step === 'homeworld'
      ? pendingCascadeChoiceViewModel(
          flow.draft.pendingCascadeSkills,
          options.backgroundCascadeChoices,
          options
        )
      : null

  return {
    step: flow.step,
    phase: characterCreationStepLabels[flow.step],
    prompt: characterCreationPrompt(flow, validation, options),
    blockingChoice,
    primaryAction: buttons.primary,
    secondaryAction: buttons.secondary,
    validation,
    stats: deriveCharacterCreationStatStrip(flow),
    skills: deriveCharacterCreationSkillStrip(flow)
  }
}
