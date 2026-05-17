import type { CharacterCreationReadModel } from '../../../../shared/character-creation/view-state'
import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset'
import type { CharacterCreationProjection } from '../../../../shared/state'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow,
  type CharacterCreationStep
} from './flow'
import type { CharacterCreationWizardViewModel } from './model-types'
import {
  deriveCharacterCreationProjectedActionSection,
  emptyHomeworldChoiceOptions,
  projectedCharacteristicGridViewModel,
  projectedTermHistoryViewModel
} from './model-projection'
import {
  activeCreationStep,
  activeTermCareerPlan,
  completedTermsFromReadModel,
  failedQualificationCareerPlan,
  flowFromReadModel
} from './read-model-flow'
import {
  characterCreationStepLabels,
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationInjuryResolutionViewModel,
  deriveCharacterCreationMishapResolutionViewModel,
  deriveCharacterCreationMusteringOutViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReenlistmentRollViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationTermCascadeChoicesViewModel,
  deriveCharacterCreationTermResolutionViewModel,
  deriveCharacterCreationTermSkillTrainingViewModel,
  deriveCharacterCreationValidationSummary,
  type CharacterCreationValidationSummary
} from './view'

const readModelCharacteristicStepViewModel = (
  readModel: CharacterCreationReadModel,
  readOnly: boolean
): CharacterCreationWizardViewModel | null => {
  const characteristics = projectedCharacteristicGridViewModel(readModel)
  if (!characteristics) return null
  const step: CharacterCreationStep = 'characteristics'
  const rolledCount = readModel.rolledCharacteristicCount
  const remainingCount = Math.max(0, 6 - rolledCount)
  const validation: CharacterCreationValidationSummary = {
    ok: remainingCount === 0,
    step,
    errors:
      remainingCount === 0
        ? []
        : [`${remainingCount} characteristic rolls pending`],
    errorCount: remainingCount === 0 ? 0 : remainingCount,
    message:
      remainingCount === 0
        ? 'Characteristics are complete.'
        : `${remainingCount} characteristic rolls pending`
  }

  return {
    step,
    projectedStep: step,
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: {
      primary: {
        label: characterCreationStepLabels.homeworld,
        disabled: true,
        reason: remainingCount === 0 ? null : validation.message
      },
      secondary: null
    },
    validation,
    nextStep: {
      step,
      phase: characterCreationStepLabels[step],
      prompt:
        remainingCount === 0
          ? 'Characteristics are complete.'
          : 'Roll characteristics in any order.',
      blockingChoice: null,
      primaryAction: {
        label: characterCreationStepLabels.homeworld,
        disabled: true,
        reason: remainingCount === 0 ? null : validation.message
      },
      secondaryAction: null,
      validation,
      stats: [],
      skills: {
        skills: [],
        summary: ''
      }
    },
    careerSelection: null,
    careerRoll: null,
    reenlistmentRoll: null,
    agingRoll: null,
    agingChoices: null,
    anagathicsDecision: null,
    mishapResolution: null,
    injuryResolution: null,
    termCascadeChoices: null,
    termResolution: null,
    termSkills: null,
    basicTraining: null,
    musteringOut: null,
    death: null,
    termHistory: null,
    review: null,
    characteristics,
    homeworld: null
  }
}

const readModelHomeworldStepViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'HOMEWORLD') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const backgroundCascadeChoices = actionSection.cascadeSkillChoices
  const flow: CharacterCreationFlow = {
    step: 'homeworld',
    draft: createInitialCharacterDraft(
      readModel.characterId,
      {
        name: readModel.name,
        age: readModel.sheet.age,
        characteristics: readModel.sheet.characteristics,
        homeworld: projectedCreation.homeworld ?? undefined,
        backgroundSkills: readModel.backgroundSkills,
        pendingCascadeSkills: readModel.pendingCascadeSkills,
        skills: readModel.sheet.skills,
        equipment: readModel.sheet.equipment,
        credits: readModel.sheet.credits
      },
      ruleset ? { ruleset } : {}
    )
  }
  const homeworldChoiceOptions =
    actionSection.homeworldChoiceOptions ??
    (ruleset === null ? emptyHomeworldChoiceOptions : undefined)
  const rulesOptions = ruleset ? { ruleset } : {}

  return {
    step: 'homeworld',
    projectedStep: 'homeworld',
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {
      ...rulesOptions,
      backgroundCascadeChoices
    }),
    careerSelection: null,
    careerRoll: null,
    reenlistmentRoll: null,
    agingRoll: null,
    agingChoices: null,
    anagathicsDecision: null,
    mishapResolution: null,
    injuryResolution: null,
    termCascadeChoices: null,
    termResolution: null,
    termSkills: null,
    basicTraining: null,
    musteringOut: null,
    death: null,
    termHistory: null,
    review: null,
    characteristics: null,
    homeworld: deriveCharacterCreationHomeworldViewModel(flow, {
      ...rulesOptions,
      backgroundCascadeChoices,
      homeworldChoiceOptions
    })
  }
}

const readModelCareerSelectionStepViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'CAREER_SELECTION') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const flow: CharacterCreationFlow = {
    step: 'career',
    draft: createInitialCharacterDraft(
      readModel.characterId,
      {
        name: readModel.name,
        age: readModel.sheet.age,
        characteristics: readModel.sheet.characteristics,
        homeworld: projectedCreation.homeworld ?? undefined,
        backgroundSkills: readModel.backgroundSkills,
        pendingCascadeSkills: readModel.pendingCascadeSkills,
        careerPlan: failedQualificationCareerPlan(projectedCreation),
        completedTerms: completedTermsFromReadModel(readModel),
        skills: readModel.sheet.skills,
        equipment: readModel.sheet.equipment,
        credits: readModel.sheet.credits
      },
      ruleset ? { ruleset } : {}
    )
  }
  const rulesOptions = ruleset ? { ruleset } : {}

  return {
    step: 'career',
    projectedStep: 'career',
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, rulesOptions),
    careerSelection: deriveCharacterCreationCareerSelectionViewModel(flow, {
      careerChoiceOptions: actionSection.careerChoiceOptions ?? { careers: [] },
      failedQualificationOptions:
        actionSection.legalAction('selectCareer')?.failedQualificationOptions ??
        []
    }),
    careerRoll: null,
    reenlistmentRoll: null,
    agingRoll: null,
    agingChoices: null,
    anagathicsDecision: null,
    mishapResolution: null,
    injuryResolution: null,
    termCascadeChoices: null,
    termResolution: null,
    termSkills: null,
    basicTraining: null,
    musteringOut: null,
    death: null,
    termHistory: projectedTermHistoryViewModel(readModel),
    review: null,
    characteristics: null,
    homeworld: null
  }
}

const readModelBasicTrainingStepViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'BASIC_TRAINING') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const basicTrainingOptions = actionSection.legalAction(
    'completeBasicTraining'
  )?.basicTrainingOptions
  const flow: CharacterCreationFlow = {
    step: 'skills',
    draft: createInitialCharacterDraft(
      readModel.characterId,
      {
        name: readModel.name,
        age: readModel.sheet.age,
        characteristics: readModel.sheet.characteristics,
        homeworld: projectedCreation.homeworld ?? undefined,
        backgroundSkills: readModel.backgroundSkills,
        pendingCascadeSkills: readModel.pendingCascadeSkills,
        careerPlan: activeTermCareerPlan(readModel),
        completedTerms: completedTermsFromReadModel(readModel),
        skills: readModel.sheet.skills,
        equipment: readModel.sheet.equipment,
        credits: readModel.sheet.credits
      },
      ruleset ? { ruleset } : {}
    )
  }
  const rulesOptions = ruleset ? { ruleset } : {}

  return {
    step: 'skills',
    projectedStep: 'skills',
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, rulesOptions),
    careerSelection: null,
    careerRoll: null,
    reenlistmentRoll: null,
    agingRoll: null,
    agingChoices: null,
    anagathicsDecision: null,
    mishapResolution: null,
    injuryResolution: null,
    termCascadeChoices: null,
    termResolution: null,
    termSkills: null,
    basicTraining: deriveCharacterCreationBasicTrainingButton(flow, {
      basicTrainingOptions
    }),
    musteringOut: null,
    death: null,
    termHistory: projectedTermHistoryViewModel(readModel),
    review: null,
    characteristics: null,
    homeworld: null
  }
}

const readModelCareerStatusStepViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  const step = activeCreationStep(readModel)
  if (step !== 'career') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const flow = flowFromReadModel({
    readModel,
    projectedCreation,
    step,
    ruleset
  })
  const rulesOptions = ruleset ? { ruleset } : {}
  const termCascadeChoices =
    readModel.status === 'SKILLS_TRAINING'
      ? actionSection.cascadeSkillChoices
      : []
  const termSkillTableOptions =
    readModel.status === 'SKILLS_TRAINING'
      ? (actionSection.legalAction('rollTermSkill')?.termSkillTableOptions ??
        [])
      : []

  return {
    step,
    projectedStep: step,
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, rulesOptions),
    careerSelection: deriveCharacterCreationCareerSelectionViewModel(flow, {
      careerChoiceOptions: { careers: [] },
      failedQualificationOptions: []
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
        termCascadeChoices
      }
    ),
    termResolution: deriveCharacterCreationTermResolutionViewModel(flow, {
      availableActionKeys: actionSection.legalActionKeys ?? undefined
    }),
    termSkills: deriveCharacterCreationTermSkillTrainingViewModel(flow, {
      termSkillTableOptions
    }),
    basicTraining: null,
    musteringOut: null,
    death: deriveCharacterCreationDeathViewModel(flow, {
      available:
        projectedCreation.state.status === 'DECEASED'
          ? true
          : actionSection.isLegalActionAvailable('confirmDeath')
    }),
    termHistory: projectedTermHistoryViewModel(readModel),
    review: null,
    characteristics: null,
    homeworld: null
  }
}

const readModelMusteringOutStepViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'MUSTERING_OUT') return null

  const step: CharacterCreationStep = 'equipment'
  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const flow = flowFromReadModel({
    readModel,
    projectedCreation,
    step,
    ruleset
  })
  const rulesOptions = ruleset ? { ruleset } : {}
  const musteringBenefitOptions =
    actionSection.legalAction('resolveMusteringBenefit')
      ?.musteringBenefitOptions ?? []

  return {
    step,
    projectedStep: step,
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, rulesOptions),
    careerSelection: null,
    careerRoll: null,
    reenlistmentRoll: null,
    agingRoll: null,
    agingChoices: null,
    anagathicsDecision: null,
    mishapResolution: null,
    injuryResolution: null,
    termCascadeChoices: null,
    termResolution: null,
    termSkills: null,
    basicTraining: null,
    musteringOut: deriveCharacterCreationMusteringOutViewModel(flow, {
      musteringBenefitOptions
    }),
    death: null,
    termHistory: projectedTermHistoryViewModel(readModel),
    review: null,
    characteristics: null,
    homeworld: null
  }
}

const readModelReviewStepViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  if (readModel.step !== 'review') return null

  const step: CharacterCreationStep = 'review'
  const flow = flowFromReadModel({
    readModel,
    projectedCreation,
    step,
    ruleset
  })
  const rulesOptions = ruleset ? { ruleset } : {}

  return {
    step,
    projectedStep: step,
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow, rulesOptions),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, rulesOptions),
    careerSelection: null,
    careerRoll: null,
    reenlistmentRoll: null,
    agingRoll: null,
    agingChoices: null,
    anagathicsDecision: null,
    mishapResolution: null,
    injuryResolution: null,
    termCascadeChoices: null,
    termResolution: null,
    termSkills: null,
    basicTraining: null,
    musteringOut: null,
    death: null,
    termHistory: projectedTermHistoryViewModel(readModel),
    review: deriveCharacterCreationReviewSummary(flow, {
      completedTerms: completedTermsFromReadModel(readModel)
    }),
    characteristics: null,
    homeworld: null
  }
}

export const readModelWizardViewModel = ({
  readModel,
  projectedCreation,
  readOnly,
  ruleset,
  preferLocalReviewFlow
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
  ruleset?: CepheusRuleset | null
  preferLocalReviewFlow: boolean
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status === 'CHARACTERISTICS') {
    return readModelCharacteristicStepViewModel(readModel, readOnly)
  }

  if (readModel.status === 'HOMEWORLD') {
    return readModelHomeworldStepViewModel({
      readModel,
      projectedCreation,
      readOnly,
      ruleset
    })
  }

  if (readModel.status === 'CAREER_SELECTION') {
    return readModelCareerSelectionStepViewModel({
      readModel,
      projectedCreation,
      readOnly,
      ruleset
    })
  }

  if (readModel.status === 'BASIC_TRAINING') {
    return readModelBasicTrainingStepViewModel({
      readModel,
      projectedCreation,
      readOnly,
      ruleset
    })
  }

  if (!preferLocalReviewFlow) {
    const musteringOut = readModelMusteringOutStepViewModel({
      readModel,
      projectedCreation,
      readOnly,
      ruleset
    })
    if (musteringOut) return musteringOut
  }

  const review = readModelReviewStepViewModel({
    readModel,
    projectedCreation,
    readOnly,
    ruleset
  })
  if (review) return review

  return readModelCareerStatusStepViewModel({
    readModel,
    projectedCreation,
    readOnly,
    ruleset
  })
}
