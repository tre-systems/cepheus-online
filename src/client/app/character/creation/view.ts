import { deriveMaterialBenefitEffect } from '../../../../shared/character-creation/benefits.js'
import { CEPHEUS_SRD_RULESET } from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import { tallyCareerSkills } from '../../../../shared/character-creation/skills.js'
import type {
  BasicTrainingActionOption,
  BenefitKind,
  CareerCreationActionKey,
  CascadeSkillChoice,
  HomeworldChoiceOptions,
  MusteringBenefitActionOption
} from '../../../../shared/character-creation/types.js'
import type { CharacteristicKey } from '../../../../shared/state'
import type {
  CharacterCreationCompletedTerm,
  CharacterCreationFlow,
  CharacterCreationMusteringBenefit
} from './flow.js'
import {
  canRollCharacterCreationMusteringBenefit,
  characterCreationMusteringBenefitRollModifier,
  characterCreationSteps,
  deriveCharacterCreationBasicTrainingAction,
  deriveCharacterCreationCareerSkipAction,
  deriveNextCharacterCreationCareerRoll,
  deriveNextCharacterCreationCharacteristicRoll,
  remainingMusteringBenefits
} from './flow.js'
import { deriveCharacterCreationDeathViewModel } from './view-career-lifecycle-model.js'
import {
  deriveCharacterCreationFieldViewModels,
  validationForStep
} from './view-fields-model.js'
import {
  characterCreationCharacteristicModifier,
  characterCreationPrimaryCtaLabels,
  characterCreationStepLabels,
  characteristicDefinitions,
  formatCharacterCreationCharacteristicModifier,
  formatCharacterCreationCompletedTermSummary,
  formatCharacterCreationMusteringBenefitSummary,
  musteringBenefitKindLabel,
  musteringBenefitValueLabel,
  signedModifier
} from './view-format.js'
import { plural } from './view-common.js'
import {
  deriveCharacterCreationBackgroundSkillSummary,
  homeworldSummaryViewModel,
  pendingCascadeChoiceViewModel,
  selectedHomeworld,
  selectedTradeCodes
} from './view-homeworld-model.js'
import type {
  CharacterCreationBasicTrainingButton,
  CharacterCreationButtonStates,
  CharacterCreationCareerRollButton,
  CharacterCreationCharacteristicGridViewModel,
  CharacterCreationCharacteristicRollButton,
  CharacterCreationCtaLabels,
  CharacterCreationHomeworldOptionViewModel,
  CharacterCreationHomeworldViewModel,
  CharacterCreationMusteringOutViewModel,
  CharacterCreationNextStepViewModel,
  CharacterCreationReviewItem,
  CharacterCreationReviewSummary,
  CharacterCreationSkillStripViewModel,
  CharacterCreationStatStripItem,
  CharacterCreationStepProgressItem,
  CharacterCreationTermHistoryViewModel,
  CharacterCreationValidationSummary,
  CharacterCreationViewRulesOptions,
  CharacterCreationViewStep
} from './view-types.js'

export type * from './view-types.js'
export {
  characterCreationPrimaryCtaLabels,
  characterCreationStepLabels,
  characteristicDefinitions,
  formatCharacterCreationCareerCheckShort,
  formatCharacterCreationCareerOutcome,
  formatCharacterCreationCharacteristicModifier,
  formatCharacterCreationCompletedTermSummary,
  formatCharacterCreationMusteringBenefitSummary,
  formatCharacterCreationReenlistmentOutcome
} from './view-format.js'
export {
  deriveCharacterCreationFieldViewModels,
  equipmentText,
  parseCharacterCreationDraftPatch
} from './view-fields-model.js'
export {
  deriveCharacterCreationCareerOptionViewModels,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationFailedQualificationViewModel
} from './view-career-model.js'
export {
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationInjuryResolutionViewModel,
  deriveCharacterCreationMishapResolutionViewModel,
  deriveCharacterCreationReenlistmentRollViewModel,
  deriveCharacterCreationTermCascadeChoicesViewModel,
  deriveCharacterCreationTermResolutionViewModel,
  deriveCharacterCreationTermSkillTrainingViewModel
} from './view-career-lifecycle-model.js'
export { deriveCharacterCreationCascadeSkillChoiceViewModels } from './view-homeworld-model.js'

const musteringBenefitRollLabel = (
  benefit: CharacterCreationMusteringBenefit
): string => {
  if (benefit.legacyProjection) return 'Legacy benefit'
  const diceRoll = benefit.diceRoll ?? null
  const modifier = benefit.modifier ?? null
  const tableRoll = benefit.tableRoll ?? benefit.roll
  if (diceRoll === null || modifier === null) return `Table ${benefit.roll}`
  if (modifier === 0) return `Roll ${diceRoll}`
  return `Roll ${diceRoll} ${signedModifier(modifier)} DM = ${tableRoll}`
}

const musteringBenefitMetaLabel = (
  benefit: CharacterCreationMusteringBenefit
): string => {
  if (benefit.kind === 'cash') return 'Credits'

  const effect = deriveMaterialBenefitEffect(
    benefit.materialItem ?? benefit.value
  )
  if (effect.kind === 'characteristic') {
    return `Characteristic gain: ${effect.characteristic.toUpperCase()} +${effect.modifier}`
  }
  if (effect.kind === 'equipment') return 'Equipment item'

  return 'No material benefit'
}

const musteringBenefitActionTitle = ({
  career,
  kind,
  modifier
}: {
  career: string
  kind: BenefitKind
  modifier: number
}): string => {
  const target = [
    career.trim(),
    musteringBenefitKindLabel(kind).toLowerCase(),
    'benefit'
  ]
    .filter(Boolean)
    .join(' ')
  const rollModifier = modifier === 0 ? '' : `${signedModifier(modifier)} DM`

  return [target, rollModifier].filter(Boolean).join('; ')
}

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

export const deriveCharacterCreationMusteringOutViewModel = (
  flow: CharacterCreationFlow,
  {
    musteringBenefitOptions
  }: {
    musteringBenefitOptions?: readonly MusteringBenefitActionOption[]
  } = {}
): CharacterCreationMusteringOutViewModel => {
  const remaining = remainingMusteringBenefits(flow.draft)
  const summary =
    flow.draft.completedTerms.length === 0
      ? 'No career terms completed yet.'
      : remaining > 0
        ? `${remaining} benefit ${remaining === 1 ? 'roll' : 'rolls'} remaining.`
        : 'Benefits complete.'
  const benefitActions =
    musteringBenefitOptions?.map((option) => ({
      career: option.career,
      kind: option.kind,
      label: option.kind === 'cash' ? 'Roll cash' : 'Roll benefit'
    })) ??
    ([
      {
        career: flow.draft.completedTerms.at(-1)?.career ?? '',
        kind: 'cash',
        label: 'Roll cash'
      },
      {
        career: flow.draft.completedTerms.at(-1)?.career ?? '',
        kind: 'material',
        label: 'Roll benefit'
      }
    ] satisfies readonly {
      career: string
      kind: BenefitKind
      label: string
    }[])

  return {
    title: 'Mustering out',
    summary,
    benefits: flow.draft.musteringBenefits.map((benefit) => ({
      label: `${benefit.career} ${musteringBenefitKindLabel(benefit.kind)}`,
      valueLabel: musteringBenefitValueLabel(benefit),
      rollLabel: musteringBenefitRollLabel(benefit),
      metaLabel: musteringBenefitMetaLabel(benefit)
    })),
    actions: benefitActions.map(({ career, kind, label }) => {
      const modifier = characterCreationMusteringBenefitRollModifier({
        draft: flow.draft,
        kind
      })
      const disabled =
        !musteringBenefitOptions &&
        (remaining <= 0 ||
          !canRollCharacterCreationMusteringBenefit({
            draft: flow.draft,
            kind
          }))
      return {
        career,
        kind,
        label,
        disabled,
        title: musteringBenefitActionTitle({ career, kind, modifier })
      }
    })
  }
}

const optionViewModels = (
  values: readonly string[],
  selectedValues: readonly string[]
): CharacterCreationHomeworldOptionViewModel[] => {
  const selected = new Set(selectedValues)
  return values.map((value) => ({
    value,
    label: value,
    selected: selected.has(value)
  }))
}

export const deriveCharacterCreationHomeworldViewModel = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
    homeworldChoiceOptions?: HomeworldChoiceOptions
  } & CharacterCreationViewRulesOptions = {}
): CharacterCreationHomeworldViewModel => {
  const homeworld = selectedHomeworld(flow.draft)
  const tradeCodes = selectedTradeCodes(homeworld.tradeCodes)
  const ruleset = options.ruleset ?? CEPHEUS_SRD_RULESET
  const lawLevels =
    options.homeworldChoiceOptions?.lawLevels ??
    Object.keys(ruleset.homeWorldSkillsByLawLevel)
  const tradeCodeOptions =
    options.homeworldChoiceOptions?.tradeCodes ??
    Object.keys(ruleset.homeWorldSkillsByTradeCode)

  return {
    step: 'homeworld',
    fields: deriveCharacterCreationFieldViewModels(flow, 'homeworld'),
    lawLevelOptions: optionViewModels(
      lawLevels,
      homeworld.lawLevel ? [homeworld.lawLevel] : []
    ),
    tradeCodeOptions: optionViewModels(tradeCodeOptions, tradeCodes),
    summary: homeworldSummaryViewModel(flow, options),
    backgroundSkills: deriveCharacterCreationBackgroundSkillSummary(
      flow,
      options
    ),
    pendingCascadeChoice: pendingCascadeChoiceViewModel(
      flow.draft.pendingCascadeSkills,
      options.backgroundCascadeChoices,
      options
    )
  }
}

const itemValue = (value: string | number | null): string =>
  value === null || value === '' ? 'Not set' : String(value)

const outcomeValue = (
  roll: number | null | undefined,
  passed: boolean | null | undefined,
  unavailableLabel = 'Not set'
): string => {
  if (roll === null || roll === undefined) return unavailableLabel
  if (roll === -1) return 'Skipped'
  if (passed === true) return `${roll} (passed)`
  if (passed === false) return `${roll} (failed)`
  return `${roll} (not evaluated)`
}

const careerReviewItems = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationReviewItem[] => {
  const careerPlan = draft.careerPlan
  const completedTerm = draft.completedTerms.at(-1)
  const career = careerPlan?.career.trim() || completedTerm?.career || ''

  return [
    { label: 'Career', value: itemValue(career) },
    {
      label: 'Qualification',
      value: outcomeValue(
        careerPlan?.qualificationRoll ?? completedTerm?.qualificationRoll,
        careerPlan?.qualificationPassed ??
          (completedTerm ? completedTerm.qualificationRoll !== null : null)
      )
    },
    {
      label: 'Survival',
      value: outcomeValue(
        careerPlan?.survivalRoll ?? completedTerm?.survivalRoll,
        careerPlan?.survivalPassed ?? completedTerm?.survivalPassed
      )
    },
    {
      label: 'Commission',
      value: outcomeValue(
        careerPlan?.commissionRoll ?? completedTerm?.commissionRoll,
        careerPlan?.commissionPassed ?? completedTerm?.commissionPassed,
        (careerPlan?.canCommission ?? completedTerm?.canCommission) === false
          ? 'Not available'
          : 'Not set'
      )
    },
    {
      label: 'Advancement',
      value: outcomeValue(
        careerPlan?.advancementRoll ?? completedTerm?.advancementRoll,
        careerPlan?.advancementPassed ?? completedTerm?.advancementPassed,
        (careerPlan?.canAdvance ?? completedTerm?.canAdvance) === false
          ? 'Not available'
          : 'Not set'
      )
    }
  ]
}

const termHistoryReviewItems = (
  completedTerms: readonly CharacterCreationCompletedTerm[]
): CharacterCreationReviewItem[] => {
  if (completedTerms.length === 0) {
    return [{ label: 'Terms', value: 'Not recorded' }]
  }

  return completedTerms.map((term, index) => ({
    label: `Term ${index + 1}`,
    value: [
      term.career,
      term.drafted ? 'drafted' : null,
      term.survivalPassed ? 'survived' : 'killed in service',
      term.commissionPassed === true ? 'commissioned' : null,
      term.advancementPassed === true ? 'advanced' : null,
      term.rankTitle ? `rank ${term.rankTitle}` : null,
      term.rankBonusSkill ? `rank skill ${term.rankBonusSkill}` : null,
      (term.termSkillRolls ?? []).length > 0
        ? `training ${(term.termSkillRolls ?? [])
            .map((roll) => `${roll.skill} (${roll.roll})`)
            .join(', ')}`
        : null,
      term.anagathics === true ? 'anagathics' : null,
      term.agingRoll != null
        ? `aging ${term.agingRoll}${
            term.agingMessage ? ` ${term.agingMessage}` : ''
          }`
        : null
    ]
      .filter(Boolean)
      .join(', ')
  }))
}

const musteringReviewItems = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationReviewItem[] => {
  if (draft.musteringBenefits.length === 0) {
    return [{ label: 'Benefits', value: 'Not rolled' }]
  }

  return draft.musteringBenefits.map((benefit, index) => ({
    label: `Benefit ${index + 1}`,
    value: `${formatCharacterCreationMusteringBenefitSummary(benefit)} (${musteringBenefitRollLabel(benefit)})`
  }))
}

export const deriveCharacterCreationReviewSummary = (
  flow: CharacterCreationFlow,
  {
    completedTerms = flow.draft.completedTerms
  }: { completedTerms?: readonly CharacterCreationCompletedTerm[] } = {}
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
        items: careerReviewItems(draft)
      },
      {
        key: 'career-history',
        label: 'Terms',
        items: termHistoryReviewItems(completedTerms)
      },
      {
        key: 'skills',
        label: characterCreationStepLabels.skills,
        items: [{ label: 'Skills', value: skills }]
      },
      {
        key: 'mustering-out',
        label: 'Mustering out',
        items: musteringReviewItems(draft)
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

export const deriveCharacterCreationTermHistoryViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationTermHistoryViewModel | null => {
  if (flow.draft.completedTerms.length === 0) return null

  return {
    title: 'Terms served',
    terms: flow.draft.completedTerms.map((term, index) =>
      formatCharacterCreationCompletedTermSummary(term, index)
    )
  }
}
