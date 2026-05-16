import { CEPHEUS_SRD_RULESET } from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import type {
  CascadeSkillChoice,
  HomeworldChoiceOptions
} from '../../../../shared/character-creation/types.js'
import type { CharacterCreationFlow } from './flow.js'
import { deriveCharacterCreationFieldViewModels } from './view-fields-model.js'
import {
  deriveCharacterCreationBackgroundSkillSummary,
  homeworldSummaryViewModel,
  pendingCascadeChoiceViewModel,
  selectedHomeworld,
  selectedTradeCodes
} from './view-homeworld-model.js'
import type {
  CharacterCreationHomeworldOptionViewModel,
  CharacterCreationHomeworldViewModel,
  CharacterCreationViewRulesOptions
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
  characterCreationViewSteps,
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCharacteristicGridViewModel,
  deriveCharacterCreationCharacteristicRollButton,
  deriveCharacterCreationCtaLabels,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationSkillStrip,
  deriveCharacterCreationStatStrip,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationValidationSummary
} from './view-flow-model.js'
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
export {
  deriveCharacterCreationMusteringOutViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationTermHistoryViewModel
} from './view-mustering-review-model.js'
export { deriveCharacterCreationCascadeSkillChoiceViewModels } from './view-homeworld-model.js'

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
