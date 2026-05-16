import {
  characteristicModifier,
  deriveFailedQualificationOptions,
  parseCareerCheck
} from '../../../../shared/character-creation/career-rules.js'
import {
  CEPHEUS_SRD_CAREERS,
  type CepheusCareerDefinition
} from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import type {
  CareerChoiceOptions,
  FailedQualificationActionOption
} from '../../../../shared/character-creation/types.js'
import type { CharacterCharacteristics } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import { formatCharacterCreationCareerOutcome } from './view-format.js'
import type {
  CharacterCreationCareerCheckViewModel,
  CharacterCreationCareerOptionViewModel,
  CharacterCreationCareerSelectionViewModel,
  CharacterCreationFailedQualificationViewModel,
  CharacterCreationViewRulesOptions
} from './view-types.js'

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

const projectedCareerOptionViewModels = (
  options: CareerChoiceOptions
): CharacterCreationCareerOptionViewModel[] =>
  options.careers.map((career) => ({
    key: career.key,
    label: career.label,
    selected: career.selected,
    qualification: { ...career.qualification },
    survival: { ...career.survival },
    commission: { ...career.commission },
    advancement: { ...career.advancement }
  }))

export const deriveCharacterCreationFailedQualificationViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  {
    failedQualificationOptions
  }: {
    failedQualificationOptions?: readonly FailedQualificationActionOption[]
  } = {}
): CharacterCreationFailedQualificationViewModel => {
  const plan = flow.draft.careerPlan
  const open =
    flow.step === 'career' &&
    plan?.qualificationPassed === false &&
    plan.drafted !== true &&
    failedQualificationOptions?.length !== 0
  const actionOptions =
    failedQualificationOptions ??
    deriveFailedQualificationOptions({
      canEnterDraft: !flow.draft.completedTerms.some((term) => term.drafted)
    }).map((option) => ({
      option,
      ...(option === 'Draft'
        ? { rollRequirement: { key: 'draft' as const, dice: '1d6' as const } }
        : {})
    }))
  const options = open
    ? actionOptions.map(({ option, rollRequirement }) => ({
        option,
        label: option,
        actionLabel: option === 'Draft' ? 'Roll draft' : 'Become a Drifter',
        rollRequirement: rollRequirement?.dice ?? null
      }))
    : []

  return {
    open,
    title: 'Qualification failed',
    message: 'Choose Drifter or roll for the Draft.',
    options
  }
}

export const deriveCharacterCreationCareerSelectionViewModel = (
  flow: CharacterCreationFlow,
  {
    careerChoiceOptions,
    failedQualificationOptions,
    careers
  }: {
    careerChoiceOptions?: CareerChoiceOptions
    failedQualificationOptions?: readonly FailedQualificationActionOption[]
  } & Pick<CharacterCreationViewRulesOptions, 'careers'> = {}
): CharacterCreationCareerSelectionViewModel | null => {
  if (flow.step !== 'career') return null

  const plan = flow.draft.careerPlan
  const hiddenFields = Object.entries({
    career: plan?.career ?? '',
    drafted: plan?.drafted ? 'true' : 'false',
    qualificationPassed:
      plan?.qualificationPassed === null ||
      plan?.qualificationPassed === undefined
        ? ''
        : String(plan.qualificationPassed),
    qualificationRoll: plan?.qualificationRoll ?? '',
    survivalRoll: plan?.survivalRoll ?? '',
    commissionRoll: plan?.commissionRoll ?? '',
    advancementRoll: plan?.advancementRoll ?? ''
  }).map(([key, value]) => ({
    key,
    value: value === null ? '' : String(value)
  }))

  return {
    open: true,
    hiddenFields,
    outcomeTitle: plan?.career ? `${plan.career} term` : 'Choose a career',
    outcomeText: formatCharacterCreationCareerOutcome(plan),
    showCareerList: !plan?.career,
    careerOptions: careerChoiceOptions
      ? projectedCareerOptionViewModels(careerChoiceOptions)
      : deriveCharacterCreationCareerOptionViewModels(flow.draft, careers),
    failedQualification: deriveCharacterCreationFailedQualificationViewModel(
      flow,
      { failedQualificationOptions }
    )
  }
}
