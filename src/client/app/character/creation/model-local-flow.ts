import type {
  CharacterCreationReadModel,
  CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type { CharacterCreationProjection } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import { completedTermsForFlow } from './read-model-flow.js'
import type {
  CharacterCreationProjectionViewModel,
  CharacterCreationWizardViewModel
} from './model-types.js'
import {
  deriveCharacterCreationProjectedActionSection,
  flowRulesOptions,
  projectedCharacteristicGridViewModel,
  projectedTermHistoryViewModel
} from './model-projection.js'
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

export const localFlowWizardViewModel = ({
  flow,
  projectedCreation,
  projection,
  projectionReadModel,
  characterReadModel,
  readOnly
}: {
  flow: CharacterCreationFlow
  projectedCreation: CharacterCreationProjection | null
  projection: CharacterCreationProjectionViewModel
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  readOnly: boolean
}): CharacterCreationWizardViewModel => {
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
