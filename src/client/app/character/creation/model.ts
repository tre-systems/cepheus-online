import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import {
  deriveCharacterCreationReadModel,
  type CharacterCreationReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type { CharacterCreationProjection } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import { completedTermsForFlow } from './read-model-flow.js'
import { readModelWizardViewModel } from './model-read-model-steps.js'
import {
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationCharacteristicGridViewModel,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationInjuryResolutionViewModel,
  deriveCharacterCreationMishapResolutionViewModel,
  deriveCharacterCreationMusteringOutViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReenlistmentRollViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationTermCascadeChoicesViewModel,
  deriveCharacterCreationTermHistoryViewModel,
  deriveCharacterCreationTermResolutionViewModel,
  deriveCharacterCreationTermSkillTrainingViewModel,
  deriveCharacterCreationValidationSummary
} from './view.js'
import {
  deriveCharacterCreationProjectedActionSection,
  flowRulesOptions,
  pendingViewModel,
  projectedCharacteristicGridViewModel,
  projectedTermHistoryViewModel,
  projectionViewModel
} from './model-projection.js'
import type {
  CharacterCreationProjectionViewModel,
  CharacterCreationViewModel,
  CharacterCreationWizardViewModel,
  DeriveCharacterCreationViewModelOptions
} from './model-types.js'

export { flowFromProjectedCharacterReadModel } from './read-model-flow.js'
export type {
  CharacterCreationPendingViewModel,
  CharacterCreationProjectedActionSection,
  CharacterCreationProjectionViewModel,
  CharacterCreationViewModel,
  CharacterCreationViewModelMode,
  CharacterCreationWizardViewModel,
  DeriveCharacterCreationViewModelOptions
} from './model-types.js'
export { deriveCharacterCreationProjectedActionSection } from './model-projection.js'

const wizardViewModel = ({
  flow,
  projectedCreation,
  projection,
  projectionReadModel,
  characterReadModel,
  readOnly,
  ruleset
}: {
  flow: CharacterCreationFlow | null
  projectedCreation: CharacterCreationProjection | null
  projection: CharacterCreationProjectionViewModel
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  const preferLocalReviewFlow = !readOnly && flow?.step === 'review'

  const shouldUseReadModelHomeworld =
    characterReadModel?.status !== 'HOMEWORLD' || readOnly || !flow
  if (characterReadModel && projectedCreation && shouldUseReadModelHomeworld) {
    const readModelWizard = readModelWizardViewModel({
      readModel: characterReadModel,
      projectedCreation,
      readOnly,
      ruleset,
      preferLocalReviewFlow
    })
    if (readModelWizard) return readModelWizard
  }

  if (!flow) {
    return null
  }

  const completedTermReadModel = projectionReadModel ?? characterReadModel
  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const projectedStatus = projectedCreation?.state.status ?? null
  const backgroundCascadeChoices =
    projectedStatus === 'HOMEWORLD' ? actionSection.cascadeSkillChoices : []
  const termCascadeChoices = !actionSection.hasProjectedCreation
    ? undefined
    : projectedStatus === 'SKILLS_TRAINING'
      ? actionSection.cascadeSkillChoices
      : []
  const homeworldChoiceOptions =
    projectedStatus === 'HOMEWORLD'
      ? actionSection.homeworldChoiceOptions
      : undefined
  const careerChoiceOptions = !actionSection.hasProjectedCreation
    ? undefined
    : projectedStatus === 'CAREER_SELECTION'
      ? (actionSection.careerChoiceOptions ?? { careers: [] })
      : { careers: [] }
  const failedQualificationOptions = !actionSection.hasProjectedCreation
    ? undefined
    : projectedStatus === 'CAREER_SELECTION'
      ? (actionSection.legalAction('selectCareer')
          ?.failedQualificationOptions ?? [])
      : []
  const basicTrainingOptions = !actionSection.hasProjectedCreation
    ? undefined
    : projectedStatus === 'BASIC_TRAINING'
      ? (actionSection.legalAction('completeBasicTraining')
          ?.basicTrainingOptions ?? {
          kind: 'none',
          skills: []
        })
      : { kind: 'none' as const, skills: [] }
  const termSkillTableOptions = !actionSection.hasProjectedCreation
    ? undefined
    : projectedStatus === 'SKILLS_TRAINING'
      ? (actionSection.legalAction('rollTermSkill')?.termSkillTableOptions ??
        [])
      : []
  const musteringBenefitOptions = !actionSection.hasProjectedCreation
    ? undefined
    : projectedStatus === 'MUSTERING_OUT'
      ? (actionSection.legalAction('resolveMusteringBenefit')
          ?.musteringBenefitOptions ?? [])
      : []
  const rulesOptions = flowRulesOptions(flow)

  return {
    step: flow.step,
    projectedStep: projection.step,
    projectedStepCurrent: projection.step === flow.step,
    controlsDisabled: readOnly,
    progress: deriveCharacterCreationStepProgressItems(flow, rulesOptions),
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(
      flow,
      flow.step,
      rulesOptions
    ),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {
      ...rulesOptions,
      backgroundCascadeChoices
    }),
    careerSelection: deriveCharacterCreationCareerSelectionViewModel(flow, {
      ...rulesOptions,
      careerChoiceOptions,
      failedQualificationOptions
    }),
    careerRoll: deriveCharacterCreationCareerRollButton(flow, {
      availableActionKeys: actionSection.legalActionKeys ?? undefined
    }),
    reenlistmentRoll: deriveCharacterCreationReenlistmentRollViewModel(flow, {
      available: actionSection.isLegalActionAvailable('rollReenlistment')
    }),
    agingRoll: deriveCharacterCreationAgingRollViewModel(flow, {
      available: actionSection.isLegalActionAvailable('resolveAging')
    }),
    agingChoices: deriveCharacterCreationAgingChoicesViewModel(flow),
    anagathicsDecision: deriveCharacterCreationAnagathicsDecisionViewModel(
      flow,
      {
        available: actionSection.isLegalActionAvailable('decideAnagathics')
      }
    ),
    mishapResolution: deriveCharacterCreationMishapResolutionViewModel(flow, {
      available: actionSection.isLegalActionAvailable('resolveMishap')
    }),
    injuryResolution: deriveCharacterCreationInjuryResolutionViewModel(flow, {
      available: actionSection.isLegalActionAvailable('resolveInjury'),
      projection: projectedCreation
    }),
    termCascadeChoices: deriveCharacterCreationTermCascadeChoicesViewModel(
      flow,
      {
        ...rulesOptions,
        termCascadeChoices
      }
    ),
    termResolution: deriveCharacterCreationTermResolutionViewModel(flow, {
      availableActionKeys: actionSection.legalActionKeys ?? undefined
    }),
    termSkills:
      actionSection.hasProjectedCreation &&
      projectedStatus !== 'SKILLS_TRAINING'
        ? null
        : deriveCharacterCreationTermSkillTrainingViewModel(flow, {
            termSkillTableOptions
          }),
    basicTraining:
      actionSection.hasProjectedCreation && projectedStatus !== 'BASIC_TRAINING'
        ? null
        : deriveCharacterCreationBasicTrainingButton(flow, {
            basicTrainingOptions
          }),
    musteringOut:
      flow.step === 'equipment' &&
      (!actionSection.hasProjectedCreation ||
        projectedStatus === 'MUSTERING_OUT')
        ? deriveCharacterCreationMusteringOutViewModel(flow, {
            musteringBenefitOptions
          })
        : null,
    death: deriveCharacterCreationDeathViewModel(flow, {
      available:
        projectedCreation?.state.status === 'DECEASED'
          ? true
          : actionSection.isLegalActionAvailable('confirmDeath')
    }),
    termHistory: completedTermReadModel
      ? projectedTermHistoryViewModel(completedTermReadModel)
      : deriveCharacterCreationTermHistoryViewModel(flow),
    review:
      flow.step === 'review'
        ? deriveCharacterCreationReviewSummary(flow, {
            completedTerms: completedTermsForFlow({
              projectionReadModel,
              characterReadModel,
              flow
            })
          })
        : null,
    characteristics:
      projectedCharacteristicGridViewModel(characterReadModel) ??
      deriveCharacterCreationCharacteristicGridViewModel(flow),
    homeworld:
      flow.step === 'homeworld'
        ? deriveCharacterCreationHomeworldViewModel(flow, {
            ...rulesOptions,
            backgroundCascadeChoices,
            homeworldChoiceOptions
          })
        : null
  }
}

export const deriveCharacterCreationViewModel = ({
  flow,
  projection,
  character = null,
  readOnly,
  actionPlan = null,
  ruleset
}: DeriveCharacterCreationViewModelOptions): CharacterCreationViewModel => {
  const projected = projectionViewModel(projection)
  const characterReadModel = character
    ? deriveCharacterCreationReadModel(character)
    : null
  const wizard = wizardViewModel({
    flow,
    projectedCreation: projection,
    projection: projected.summary,
    projectionReadModel: projected.readModel,
    characterReadModel,
    readOnly,
    ruleset
  })

  return {
    mode:
      !flow && !characterReadModel
        ? 'empty'
        : readOnly
          ? 'read-only'
          : 'editable',
    title:
      flow?.draft.name.trim() ||
      characterReadModel?.name.trim() ||
      'Create traveller',
    characterId: flow?.draft.characterId ?? character?.id ?? null,
    flow,
    readOnly,
    controlsDisabled: readOnly,
    projection: projected.summary,
    projectionReadModel: projected.readModel,
    characterReadModel,
    pending: pendingViewModel(flow, projection),
    wizard,
    actionPlan
  }
}
