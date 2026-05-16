import type { CharacterId } from '../../../../shared/ids'
import {
  deriveCepheusCareerDefinitions,
  type CepheusRuleset
} from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import {
  deriveCharacterCreationReadModel,
  deriveCharacterCreationProjectionReadModel,
  type CharacterCreationReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type {
  CareerCreationActionKey,
  LegalCareerCreationAction
} from '../../../../shared/character-creation/types.js'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import type { CharacterCreationActionPlan } from './actions.js'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow,
  type CharacterCreationStep
} from './flow.js'
import {
  activeCreationStep,
  activeTermCareerPlan,
  completedTermsForFlow,
  completedTermsFromReadModel,
  failedQualificationCareerPlan,
  flowFromReadModel
} from './read-model-flow.js'
import {
  characteristicDefinitions,
  characterCreationStepLabels,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel,
  deriveCharacterCreationCharacteristicGridViewModel,
  deriveCharacterCreationAgingChoicesViewModel,
  deriveCharacterCreationAgingRollViewModel,
  deriveCharacterCreationAnagathicsDecisionViewModel,
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationMusteringOutViewModel,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationInjuryResolutionViewModel,
  deriveCharacterCreationMishapResolutionViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReenlistmentRollViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationTermCascadeChoicesViewModel,
  deriveCharacterCreationTermHistoryViewModel,
  deriveCharacterCreationTermResolutionViewModel,
  deriveCharacterCreationTermSkillTrainingViewModel,
  deriveCharacterCreationValidationSummary,
  formatCharacterCreationCharacteristicModifier,
  formatCharacterCreationCompletedTermSummary,
  type CharacterCreationAgingChoicesViewModel,
  type CharacterCreationAgingRollViewModel,
  type CharacterCreationAnagathicsDecisionViewModel,
  type CharacterCreationBasicTrainingButton,
  type CharacterCreationButtonStates,
  type CharacterCreationCareerRollButton,
  type CharacterCreationCareerSelectionViewModel,
  type CharacterCreationCharacteristicGridViewModel,
  type CharacterCreationDeathViewModel,
  type CharacterCreationHomeworldViewModel,
  type CharacterCreationInjuryResolutionViewModel,
  type CharacterCreationMusteringOutViewModel,
  type CharacterCreationMishapResolutionViewModel,
  type CharacterCreationNextStepViewModel,
  type CharacterCreationReenlistmentRollViewModel,
  type CharacterCreationReviewSummary,
  type CharacterCreationStepProgressItem,
  type CharacterCreationTermCascadeChoicesViewModel,
  type CharacterCreationTermHistoryViewModel,
  type CharacterCreationTermResolutionViewModel,
  type CharacterCreationTermSkillTrainingViewModel,
  type CharacterCreationValidationSummary
} from './view.js'

type CharacterCreationFlowRulesOptions = {
  ruleset?: CepheusRuleset
  careers?: ReturnType<typeof deriveCepheusCareerDefinitions>
}

export type CharacterCreationViewModelMode = 'empty' | 'editable' | 'read-only'

export interface CharacterCreationProjectionViewModel {
  present: boolean
  status: CharacterCreationProjection['state']['status'] | null
  statusLabel: string
  step: CharacterCreationStep | null
  creationComplete: boolean
  isActive: boolean
  isPlayable: boolean
  isDeceased: boolean
  termCount: number
  completedTermCount: number
  timelineCount: number
}

export interface CharacterCreationPendingViewModel {
  backgroundCascadeSkills: string[]
  termCascadeSkills: string[]
  projectionCascadeSkills: string[]
  agingChangeCount: number
  hasCascadeChoices: boolean
  hasAgingChoices: boolean
  hasPendingResolution: boolean
  summary: string
}

export interface CharacterCreationWizardViewModel {
  step: CharacterCreationStep
  projectedStep: CharacterCreationStep | null
  projectedStepCurrent: boolean
  controlsDisabled: boolean
  progress: CharacterCreationStepProgressItem[]
  buttons: CharacterCreationButtonStates
  validation: CharacterCreationValidationSummary
  nextStep: CharacterCreationNextStepViewModel
  careerSelection: CharacterCreationCareerSelectionViewModel | null
  careerRoll: CharacterCreationCareerRollButton | null
  reenlistmentRoll: CharacterCreationReenlistmentRollViewModel | null
  agingRoll: CharacterCreationAgingRollViewModel | null
  agingChoices: CharacterCreationAgingChoicesViewModel | null
  anagathicsDecision: CharacterCreationAnagathicsDecisionViewModel | null
  mishapResolution: CharacterCreationMishapResolutionViewModel | null
  injuryResolution: CharacterCreationInjuryResolutionViewModel | null
  termCascadeChoices: CharacterCreationTermCascadeChoicesViewModel | null
  termResolution: CharacterCreationTermResolutionViewModel | null
  termSkills: CharacterCreationTermSkillTrainingViewModel | null
  basicTraining: CharacterCreationBasicTrainingButton | null
  musteringOut: CharacterCreationMusteringOutViewModel | null
  death: CharacterCreationDeathViewModel | null
  termHistory: CharacterCreationTermHistoryViewModel | null
  review: CharacterCreationReviewSummary | null
  characteristics: CharacterCreationCharacteristicGridViewModel | null
  homeworld: CharacterCreationHomeworldViewModel | null
}

export interface CharacterCreationViewModel {
  mode: CharacterCreationViewModelMode
  title: string
  characterId: CharacterId | null
  flow: CharacterCreationFlow | null
  readOnly: boolean
  controlsDisabled: boolean
  projection: CharacterCreationProjectionViewModel
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  pending: CharacterCreationPendingViewModel
  wizard: CharacterCreationWizardViewModel | null
  actionPlan: CharacterCreationActionPlan | null
}

export interface CharacterCreationProjectedActionSection {
  hasProjectedCreation: boolean
  legalActions: readonly LegalCareerCreationAction[]
  legalActionKeys: ReadonlySet<CareerCreationActionKey> | null
  legalAction: (
    key: CareerCreationActionKey
  ) => LegalCareerCreationAction | undefined
  isLegalActionAvailable: (key: CareerCreationActionKey) => boolean | undefined
  cascadeSkillChoices: NonNullable<
    CharacterCreationProjection['actionPlan']
  >['cascadeSkillChoices']
  homeworldChoiceOptions:
    | NonNullable<
        CharacterCreationProjection['actionPlan']
      >['homeworldChoiceOptions']
    | undefined
  careerChoiceOptions:
    | NonNullable<
        CharacterCreationProjection['actionPlan']
      >['careerChoiceOptions']
    | undefined
}

export interface DeriveCharacterCreationViewModelOptions {
  flow: CharacterCreationFlow | null
  projection: CharacterCreationProjection | null
  character?: CharacterState | null
  readOnly: boolean
  actionPlan?: CharacterCreationActionPlan | null
  ruleset?: CepheusRuleset | null
}

export { flowFromProjectedCharacterReadModel } from './read-model-flow.js'

const emptyHomeworldChoiceOptions = {
  lawLevels: [],
  tradeCodes: [],
  backgroundSkills: []
} as const

const projectionViewModel = (
  projection: CharacterCreationProjection | null
): {
  summary: CharacterCreationProjectionViewModel
  readModel: CharacterCreationProjectionReadModel | null
} => {
  if (!projection) {
    return {
      summary: {
        present: false,
        status: null,
        statusLabel: 'Creation',
        step: null,
        creationComplete: false,
        isActive: false,
        isPlayable: false,
        isDeceased: false,
        termCount: 0,
        completedTermCount: 0,
        timelineCount: 0
      },
      readModel: null
    }
  }

  const readModel = deriveCharacterCreationProjectionReadModel(projection)

  return {
    summary: {
      present: true,
      status: readModel.status,
      statusLabel: readModel.statusLabel,
      step: readModel.step,
      creationComplete: readModel.creationComplete,
      isActive: readModel.isActive,
      isPlayable: readModel.isPlayable,
      isDeceased: readModel.isDeceased,
      termCount: readModel.termCount,
      completedTermCount: readModel.completedTermCount,
      timelineCount: readModel.timelineCount
    },
    readModel
  }
}

export const deriveCharacterCreationProjectedActionSection = (
  projection: CharacterCreationProjection | null
): CharacterCreationProjectedActionSection => {
  const projectedActionPlan =
    projection && projection.actionPlan?.status === projection.state.status
      ? projection.actionPlan
      : null
  const legalActions =
    projection && projectedActionPlan
      ? projectedActionPlan.legalActions.filter(
          (action) => action.status === projection.state.status
        )
      : []
  const legalActionKeys = projection
    ? new Set<CareerCreationActionKey>(legalActions.map((action) => action.key))
    : null

  return {
    hasProjectedCreation: projection !== null,
    legalActions,
    legalActionKeys,
    legalAction: (key) => legalActions.find((action) => action.key === key),
    isLegalActionAvailable: (key) =>
      legalActionKeys ? legalActionKeys.has(key) : undefined,
    cascadeSkillChoices: projectedActionPlan?.cascadeSkillChoices ?? [],
    homeworldChoiceOptions: projectedActionPlan?.homeworldChoiceOptions,
    careerChoiceOptions: projectedActionPlan?.careerChoiceOptions
  }
}

const projectedCharacteristicGridViewModel = (
  readModel: CharacterCreationReadModel | null
): CharacterCreationCharacteristicGridViewModel | null => {
  if (!readModel || readModel.status !== 'CHARACTERISTICS') return null

  return {
    open: true,
    stats: characteristicDefinitions.map(({ key, label }) => {
      const value = readModel.sheet.characteristics[key]
      const valueText = value === null ? '' : String(value)
      const missing = value === null

      return {
        key,
        label,
        value: valueText,
        modifier: missing
          ? ''
          : formatCharacterCreationCharacteristicModifier(value),
        missing,
        errors: [],
        rollLabel: `Roll ${label}`
      }
    })
  }
}

const pendingSummary = ({
  backgroundCascadeSkills,
  termCascadeSkills,
  projectionCascadeSkills,
  agingChangeCount
}: Pick<
  CharacterCreationPendingViewModel,
  | 'backgroundCascadeSkills'
  | 'termCascadeSkills'
  | 'projectionCascadeSkills'
  | 'agingChangeCount'
>): string => {
  if (backgroundCascadeSkills.length > 0) {
    return `${backgroundCascadeSkills.length} background cascade ${
      backgroundCascadeSkills.length === 1 ? 'choice' : 'choices'
    } pending`
  }
  if (termCascadeSkills.length > 0) {
    return `${termCascadeSkills.length} term cascade ${
      termCascadeSkills.length === 1 ? 'choice' : 'choices'
    } pending`
  }
  if (agingChangeCount > 0) {
    return `${agingChangeCount} aging ${
      agingChangeCount === 1 ? 'change' : 'changes'
    } pending`
  }
  if (projectionCascadeSkills.length > 0) {
    return `${projectionCascadeSkills.length} projected cascade ${
      projectionCascadeSkills.length === 1 ? 'choice' : 'choices'
    } pending`
  }
  return 'No pending character creation choices'
}

const pendingViewModel = (
  flow: CharacterCreationFlow | null,
  projection: CharacterCreationProjection | null
): CharacterCreationPendingViewModel => {
  const backgroundCascadeSkills = [...(flow?.draft.pendingCascadeSkills ?? [])]
  const termCascadeSkills = [...(flow?.draft.pendingTermCascadeSkills ?? [])]
  const projectionCascadeSkills = [...(projection?.pendingCascadeSkills ?? [])]
  const agingChangeCount = flow?.draft.pendingAgingChanges.length ?? 0
  const hasCascadeChoices =
    backgroundCascadeSkills.length > 0 ||
    termCascadeSkills.length > 0 ||
    projectionCascadeSkills.length > 0
  const hasAgingChoices = agingChangeCount > 0

  return {
    backgroundCascadeSkills,
    termCascadeSkills,
    projectionCascadeSkills,
    agingChangeCount,
    hasCascadeChoices,
    hasAgingChoices,
    hasPendingResolution: hasCascadeChoices || hasAgingChoices,
    summary: pendingSummary({
      backgroundCascadeSkills,
      termCascadeSkills,
      projectionCascadeSkills,
      agingChangeCount
    })
  }
}

const projectedTermHistoryViewModel = (
  readModel: CharacterCreationProjectionReadModel
): CharacterCreationTermHistoryViewModel | null => {
  const completedTerms = completedTermsFromReadModel(readModel)
  if (completedTerms.length === 0) return null

  return {
    title: 'Terms served',
    terms: completedTerms.map((term, index) =>
      formatCharacterCreationCompletedTermSummary(term, index)
    )
  }
}

const flowRulesOptions = (
  flow: CharacterCreationFlow
): CharacterCreationFlowRulesOptions =>
  flow.ruleset
    ? {
        ruleset: flow.ruleset,
        careers: deriveCepheusCareerDefinitions(flow.ruleset)
      }
    : {}

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
  readOnly
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'CAREER_SELECTION') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const flow: CharacterCreationFlow = {
    step: 'career',
    draft: createInitialCharacterDraft(readModel.characterId, {
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
    })
  }

  return {
    step: 'career',
    projectedStep: 'career',
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {}),
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
  readOnly
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'BASIC_TRAINING') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const basicTrainingOptions = actionSection.legalAction(
    'completeBasicTraining'
  )?.basicTrainingOptions
  const flow: CharacterCreationFlow = {
    step: 'skills',
    draft: createInitialCharacterDraft(readModel.characterId, {
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
    })
  }

  return {
    step: 'skills',
    projectedStep: 'skills',
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {}),
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
  readOnly
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  const step = activeCreationStep(readModel)
  if (step !== 'career') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const flow = flowFromReadModel({
    readModel,
    projectedCreation,
    step
  })
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
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {}),
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
  readOnly
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'MUSTERING_OUT') return null

  const step: CharacterCreationStep = 'equipment'
  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const flow = flowFromReadModel({
    readModel,
    projectedCreation,
    step
  })
  const musteringBenefitOptions =
    actionSection.legalAction('resolveMusteringBenefit')
      ?.musteringBenefitOptions ?? []

  return {
    step,
    projectedStep: step,
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {}),
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
  readOnly
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (readModel.step !== 'review') return null

  const step: CharacterCreationStep = 'review'
  const flow = flowFromReadModel({
    readModel,
    projectedCreation,
    step
  })

  return {
    step,
    projectedStep: step,
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {}),
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

  if (characterReadModel && projectedCreation) {
    if (characterReadModel.status === 'CHARACTERISTICS') {
      return readModelCharacteristicStepViewModel(characterReadModel, readOnly)
    }

    if ((readOnly || !flow) && characterReadModel.status === 'HOMEWORLD') {
      return readModelHomeworldStepViewModel({
        readModel: characterReadModel,
        projectedCreation,
        readOnly,
        ruleset
      })
    }

    if (characterReadModel.status === 'CAREER_SELECTION') {
      return readModelCareerSelectionStepViewModel({
        readModel: characterReadModel,
        projectedCreation,
        readOnly
      })
    }

    if (characterReadModel.status === 'BASIC_TRAINING') {
      return readModelBasicTrainingStepViewModel({
        readModel: characterReadModel,
        projectedCreation,
        readOnly
      })
    }

    if (!preferLocalReviewFlow) {
      const musteringOut = readModelMusteringOutStepViewModel({
        readModel: characterReadModel,
        projectedCreation,
        readOnly
      })
      if (musteringOut) return musteringOut
    }

    const review = readModelReviewStepViewModel({
      readModel: characterReadModel,
      projectedCreation,
      readOnly
    })
    if (review) return review

    const career = readModelCareerStatusStepViewModel({
      readModel: characterReadModel,
      projectedCreation,
      readOnly
    })
    if (career) return career
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
