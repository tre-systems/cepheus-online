import {
  derivePrimaryEducationSkillOptions,
  deriveTotalBackgroundSkillAllowance
} from '../../../../shared/character-creation/background-skills'
import {
  CEPHEUS_SRD_RULESET,
  type CepheusRuleset
} from '../../../../shared/character-creation/cepheus-srd-ruleset'
import {
  careerSkillWithLevel,
  formatCareerSkill,
  isCascadeCareerSkill,
  parseCareerSkill
} from '../../../../shared/character-creation/skills'
import type {
  CascadeSkillChoice,
  HomeworldChoiceOptions
} from '../../../../shared/character-creation/types'
import type { CharacterCreationFlow } from './flow'
import { plural } from './view-common'
import type {
  CharacterCreationBackgroundSkillSummary,
  CharacterCreationCascadeSkillChoiceOptionViewModel,
  CharacterCreationCascadeSkillChoiceViewModel,
  CharacterCreationHomeworldSummaryViewModel,
  CharacterCreationPendingCascadeChoiceViewModel,
  CharacterCreationViewRulesOptions
} from './view-types'

interface CharacterCreationHomeworldDraftFields {
  homeworld?: {
    lawLevel?: string | null
    tradeCodes?: readonly string[] | null
  } | null
  homeWorld?: {
    lawLevel?: string | null
    tradeCodes?: string | readonly string[] | null
  } | null
  backgroundSkills?: readonly string[]
  pendingCascadeSkills?: readonly string[]
}

const homeworldDraftFields = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationHomeworldDraftFields =>
  draft as CharacterCreationFlow['draft'] &
    CharacterCreationHomeworldDraftFields

export const selectedHomeworld = (
  draft: CharacterCreationFlow['draft']
): NonNullable<CharacterCreationHomeworldDraftFields['homeWorld']> => {
  const fields = homeworldDraftFields(draft)
  return fields.homeWorld ?? fields.homeworld ?? {}
}

export const selectedTradeCodes = (
  tradeCodes: string | readonly string[] | null | undefined
): string[] => {
  if (!tradeCodes) return []
  return typeof tradeCodes === 'string' ? [tradeCodes] : [...tradeCodes]
}

const backgroundSkillValue = (skill: string): string =>
  isCascadeCareerSkill(skill)
    ? careerSkillWithLevel(skill, 0)
    : formatCareerSkill({ name: skill, level: 0 })

const cascadeChoiceOptions = (
  cascadeSkill: string,
  ruleset: CepheusRuleset = CEPHEUS_SRD_RULESET
): CharacterCreationCascadeSkillChoiceOptionViewModel[] => {
  const parsed = parseCareerSkill(cascadeSkill)
  if (!parsed) return []

  const options = ruleset.cascadeSkills[parsed.name] ?? []
  return options.map((option) => ({
    value: isCascadeCareerSkill(option)
      ? careerSkillWithLevel(option, parsed.level)
      : formatCareerSkill({ name: option, level: parsed.level }),
    label: option,
    cascade: isCascadeCareerSkill(option)
  }))
}

const projectedCascadeChoiceViewModel = (
  choice: CascadeSkillChoice
): CharacterCreationCascadeSkillChoiceViewModel => ({
  cascadeSkill: choice.cascadeSkill,
  label: choice.label,
  level: choice.level,
  options: choice.options.map((option) => ({ ...option }))
})

export const deriveCharacterCreationCascadeSkillChoiceViewModels = (
  pendingCascadeSkills: readonly string[],
  projectedChoices: readonly CascadeSkillChoice[] = [],
  options: Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationCascadeSkillChoiceViewModel[] => {
  const projectedBySkill = new Map(
    projectedChoices.map((choice) => [choice.cascadeSkill, choice])
  )

  return pendingCascadeSkills.map((cascadeSkill) => {
    const projected = projectedBySkill.get(cascadeSkill)
    if (projected) return projectedCascadeChoiceViewModel(projected)

    const parsed = parseCareerSkill(cascadeSkill)
    return {
      cascadeSkill,
      label: parsed?.name ?? cascadeSkill,
      level: parsed?.level ?? 0,
      options: cascadeChoiceOptions(cascadeSkill, options.ruleset)
    }
  })
}

export const pendingCascadeChoiceViewModel = (
  pendingCascadeSkills: readonly string[],
  projectedChoices: readonly CascadeSkillChoice[] = [],
  options: Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationPendingCascadeChoiceViewModel | null => {
  const choice = deriveCharacterCreationCascadeSkillChoiceViewModels(
    pendingCascadeSkills,
    projectedChoices,
    options
  )[0]
  if (!choice) return null

  return {
    open: true,
    cascadeSkill: choice.cascadeSkill,
    title: `Choose ${choice.label}`,
    prompt: `Resolve ${choice.label}-${choice.level} into a specialty.`,
    label: choice.label,
    level: choice.level,
    options: choice.options
  }
}

export const deriveCharacterCreationBackgroundSkillSummary = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
    homeworldChoiceOptions?: HomeworldChoiceOptions
  } & Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationBackgroundSkillSummary => {
  const fields = homeworldDraftFields(flow.draft)
  const homeworld = selectedHomeworld(flow.draft)
  const allowance = deriveTotalBackgroundSkillAllowance(
    flow.draft.characteristics.edu
  )
  const selectedSkills = [...(fields.backgroundSkills ?? [])]
  const pendingCascadeSkills = [...(fields.pendingCascadeSkills ?? [])]
  const selected = new Set([...selectedSkills, ...pendingCascadeSkills])
  const projectedSkillOptions = options.homeworldChoiceOptions?.backgroundSkills
  const localFallbackSkillOptions = () =>
    derivePrimaryEducationSkillOptions({
      edu: flow.draft.characteristics.edu,
      homeworld,
      rules: options.ruleset ?? CEPHEUS_SRD_RULESET
    }).map((option) => {
      const value = backgroundSkillValue(option.name)
      return {
        value,
        label: option.name,
        preselected: option.preselected,
        cascade: isCascadeCareerSkill(option.name)
      }
    })
  const skillOptions = (
    projectedSkillOptions ?? localFallbackSkillOptions()
  ).map((option) => ({
    ...option,
    selected: selected.has(option.value)
  }))
  const cascadeSkillChoices =
    deriveCharacterCreationCascadeSkillChoiceViewModels(
      pendingCascadeSkills,
      options.backgroundCascadeChoices,
      options
    )
  const errors =
    pendingCascadeSkills.length === 0
      ? []
      : [
          `${pendingCascadeSkills.length} cascade skill ${
            pendingCascadeSkills.length === 1
              ? 'choice remains'
              : 'choices remain'
          }`
        ]

  return {
    allowance,
    selectedSkills,
    availableSkills: skillOptions.map((option) => option.label),
    skillOptions,
    remainingSelections: Math.max(
      allowance - selectedSkills.length - pendingCascadeSkills.length,
      0
    ),
    pendingCascadeSkills,
    cascadeSkillChoices,
    errors,
    message: errors.length === 0 ? 'Background skills ready' : errors.join(', ')
  }
}

export const homeworldSummaryViewModel = (
  flow: CharacterCreationFlow,
  options: {
    backgroundCascadeChoices?: readonly CascadeSkillChoice[]
    homeworldChoiceOptions?: HomeworldChoiceOptions
  } & Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationHomeworldSummaryViewModel => {
  const homeworld = selectedHomeworld(flow.draft)
  const tradeCodes = selectedTradeCodes(homeworld.tradeCodes)
  const backgroundSkills = deriveCharacterCreationBackgroundSkillSummary(
    flow,
    options
  )
  const selectedCount =
    backgroundSkills.selectedSkills.length +
    backgroundSkills.pendingCascadeSkills.length

  return {
    lawLevel: homeworld.lawLevel ?? 'Not set',
    tradeCodes,
    tradeCodeSummary: tradeCodes.length > 0 ? tradeCodes.join(', ') : 'Not set',
    backgroundSkillSummary: `${selectedCount}/${backgroundSkills.allowance} background skills selected`,
    cascadeSummary:
      backgroundSkills.pendingCascadeSkills.length === 0
        ? 'No cascade choices pending'
        : `${plural(
            backgroundSkills.pendingCascadeSkills.length,
            'cascade choice',
            'cascade choices'
          )} pending`
  }
}
