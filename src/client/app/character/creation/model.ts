import type { CharacterId } from '../../../../shared/ids'
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
import {
  deriveCareerTermSkillRollSummaries,
  deriveCareerTermTrainingSkillsFromFacts,
  hasProjectedCareerTermFacts
} from '../../../../shared/character-creation/term-skills.js'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import type { CharacterCreationActionPlan } from './actions.js'
import {
  createInitialCharacterDraft,
  normalizeSkillList,
  type CharacterCreationCareerPlan,
  type CharacterCreationCompletedTerm,
  type CharacterCreationFlow,
  type CharacterCreationMusteringBenefit,
  type CharacterCreationStep
} from './flow.js'
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
}

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

const completedTermsFromReadModel = (
  readModel: Pick<CharacterCreationProjectionReadModel, 'completedTerms'>
): CharacterCreationCompletedTerm[] =>
  readModel.completedTerms.map((term) => ({
    career: term.career,
    drafted: term.drafted,
    anagathics: term.anagathics,
    anagathicsCost: term.anagathicsCost,
    age: term.age,
    rank: term.rank,
    rankTitle: term.rankTitle,
    rankBonusSkill: term.rankBonusSkill,
    qualificationRoll: term.qualificationRoll,
    survivalRoll: term.survivalRoll,
    survivalPassed: term.survivalPassed,
    canCommission: term.canCommission,
    commissionRoll: term.commissionRoll,
    commissionPassed: term.commissionPassed,
    canAdvance: term.canAdvance,
    advancementRoll: term.advancementRoll,
    advancementPassed: term.advancementPassed,
    termSkillRolls: term.termSkillRolls.map((roll) => ({ ...roll })),
    agingRoll: term.agingRoll,
    agingMessage: term.agingMessage,
    benefitForfeiture: term.benefitForfeiture,
    reenlistmentRoll: term.reenlistmentRoll,
    reenlistmentOutcome:
      term.reenlistmentOutcome === 'unresolved'
        ? null
        : term.reenlistmentOutcome
  }))

const completedTermsForFlow = ({
  projectionReadModel,
  characterReadModel,
  flow
}: {
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  flow: CharacterCreationFlow
}): CharacterCreationCompletedTerm[] => {
  const readModel = projectionReadModel ?? characterReadModel
  return readModel
    ? completedTermsFromReadModel(readModel)
    : flow.draft.completedTerms
}

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
  readOnly
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  if (readModel.status !== 'HOMEWORLD') return null

  const actionSection =
    deriveCharacterCreationProjectedActionSection(projectedCreation)
  const backgroundCascadeChoices = actionSection.cascadeSkillChoices
  const flow: CharacterCreationFlow = {
    step: 'homeworld',
    draft: createInitialCharacterDraft(readModel.characterId, {
      name: readModel.name,
      age: readModel.sheet.age,
      characteristics: readModel.sheet.characteristics,
      homeworld: projectedCreation.homeworld ?? undefined,
      backgroundSkills: readModel.backgroundSkills,
      pendingCascadeSkills: readModel.pendingCascadeSkills,
      skills: readModel.sheet.skills,
      equipment: readModel.sheet.equipment,
      credits: readModel.sheet.credits
    })
  }

  return {
    step: 'homeworld',
    projectedStep: 'homeworld',
    projectedStepCurrent: true,
    controlsDisabled: readOnly,
    progress: [],
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {
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
      backgroundCascadeChoices,
      homeworldChoiceOptions: actionSection.homeworldChoiceOptions
    })
  }
}

const failedQualificationCareerPlan = (
  projectedCreation: CharacterCreationProjection
): CharacterCreationCareerPlan | null => {
  const failedQualification = projectedCreation.failedQualification
  if (!failedQualification || failedQualification.passed) return null

  return {
    career: failedQualification.career,
    qualificationRoll: failedQualification.qualification.total,
    qualificationPassed: false,
    survivalRoll: null,
    survivalPassed: null,
    commissionRoll: null,
    commissionPassed: null,
    advancementRoll: null,
    advancementPassed: null,
    canCommission: null,
    canAdvance: null,
    drafted: false,
    rank: null,
    rankTitle: null,
    rankBonusSkill: null,
    termSkillRolls: [],
    anagathics: null,
    agingRoll: null,
    agingMessage: null,
    agingSelections: [],
    reenlistmentRoll: null,
    reenlistmentOutcome: null
  }
}

const activeTermCareerPlan = (
  readModel: CharacterCreationReadModel
): CharacterCreationCareerPlan | null => {
  const term = readModel.activeTerm
  if (!term) return null
  const qualification = term.facts?.qualification
  const survival = term.facts?.survival
  const commission = term.facts?.commission
  const advancement = term.facts?.advancement
  const aging = term.facts?.aging

  return {
    career: term.career,
    qualificationRoll: qualification?.qualification.total ?? null,
    qualificationPassed: qualification?.passed ?? true,
    survivalRoll: survival?.survival.total ?? null,
    survivalPassed: survival?.passed ?? null,
    commissionRoll:
      commission?.skipped === true
        ? -1
        : (commission?.commission.total ?? null),
    commissionPassed:
      commission?.skipped === true ? false : (commission?.passed ?? null),
    advancementRoll:
      advancement?.skipped === true
        ? -1
        : (advancement?.advancement.total ?? null),
    advancementPassed:
      advancement?.skipped === true ? false : (advancement?.passed ?? null),
    canCommission: survival?.canCommission ?? null,
    canAdvance: survival?.canAdvance ?? null,
    drafted: term.facts?.draft !== undefined || term.draft !== undefined,
    rank:
      advancement && !advancement.skipped
        ? (advancement.rank?.newRank ?? null)
        : null,
    rankTitle:
      advancement && !advancement.skipped
        ? (advancement.rank?.title ?? null)
        : null,
    rankBonusSkill:
      advancement && !advancement.skipped
        ? (advancement.rank?.bonusSkill ?? null)
        : null,
    termSkillRolls: deriveCareerTermSkillRollSummaries(term),
    anagathics: term.facts?.anagathicsDecision?.useAnagathics ?? null,
    agingRoll: aging?.roll.total ?? null,
    agingMessage:
      (aging?.characteristicChanges.length ?? 0) > 0
        ? `${aging?.characteristicChanges.length ?? 0} characteristic changes`
        : aging
          ? 'No aging effects.'
          : null,
    agingSelections:
      term.facts?.agingLosses?.selectedLosses.map((selection) => ({
        type: selection.type,
        modifier: selection.modifier,
        characteristic: selection.characteristic
      })) ?? [],
    benefitForfeiture: term.facts?.mishap?.outcome.benefitEffect ?? null,
    reenlistmentRoll: term.facts?.reenlistment?.reenlistment.total ?? null,
    reenlistmentOutcome: term.facts?.reenlistment?.outcome ?? null
  }
}

const activeCreationStep = (
  readModel: CharacterCreationReadModel
): CharacterCreationStep =>
  readModel.status === 'MUSTERING_OUT' ? 'equipment' : readModel.step

const musteringBenefitsFromReadModel = (
  readModel: CharacterCreationProjectionReadModel
): CharacterCreationMusteringBenefit[] =>
  readModel.terms.flatMap((term) =>
    (term.facts?.musteringBenefits ?? []).map((benefit) => ({
      career: benefit.career,
      kind: benefit.kind,
      roll: benefit.tableRoll,
      diceRoll: benefit.roll.total,
      modifier: benefit.modifier,
      tableRoll: benefit.tableRoll,
      value: benefit.value,
      credits: benefit.credits,
      ...(benefit.materialItem != null
        ? { materialItem: benefit.materialItem }
        : {})
    }))
  )

const pendingAgingChangesFromReadModel = (
  readModel: CharacterCreationReadModel
): CharacterCreationProjection['characteristicChanges'] => {
  if (readModel.activeTerm?.facts?.agingLosses) return []
  if (readModel.characteristicChanges.length > 0) {
    return readModel.characteristicChanges
  }
  return readModel.activeTerm?.facts?.aging?.characteristicChanges ?? []
}

const projectedTermTrainingSkills = (
  readModel: CharacterCreationProjectionReadModel
): string[] =>
  readModel.terms.flatMap((term) =>
    hasProjectedCareerTermFacts(term)
      ? deriveCareerTermTrainingSkillsFromFacts(term)
      : []
  )

const flowFromReadModel = ({
  readModel,
  projectedCreation,
  step
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  step: CharacterCreationStep
}): CharacterCreationFlow => ({
  step,
  draft: createInitialCharacterDraft(readModel.characterId, {
    name: readModel.name,
    age: readModel.sheet.age,
    characteristics: readModel.sheet.characteristics,
    homeworld: projectedCreation.homeworld ?? undefined,
    backgroundSkills: readModel.backgroundSkills,
    pendingCascadeSkills:
      readModel.status === 'HOMEWORLD' ? readModel.pendingCascadeSkills : [],
    pendingTermCascadeSkills:
      readModel.status === 'SKILLS_TRAINING'
        ? readModel.pendingCascadeSkills
        : [],
    pendingAgingChanges: pendingAgingChangesFromReadModel(readModel),
    careerPlan:
      readModel.status === 'CAREER_SELECTION'
        ? failedQualificationCareerPlan(projectedCreation)
        : activeTermCareerPlan(readModel),
    completedTerms: completedTermsFromReadModel(readModel),
    musteringBenefits: musteringBenefitsFromReadModel(readModel),
    skills: normalizeSkillList([
      ...readModel.sheet.skills,
      ...projectedTermTrainingSkills(readModel)
    ]),
    equipment: readModel.sheet.equipment,
    credits: readModel.sheet.credits
  })
})

export const flowFromProjectedCharacterReadModel = (
  character: CharacterState
): CharacterCreationFlow | null => {
  if (!character.creation) return null
  const readModel = deriveCharacterCreationReadModel(character)
  if (!readModel) return null

  return flowFromReadModel({
    readModel,
    projectedCreation: character.creation,
    step: activeCreationStep(readModel)
  })
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
  readOnly
}: {
  flow: CharacterCreationFlow | null
  projectedCreation: CharacterCreationProjection | null
  projection: CharacterCreationProjectionViewModel
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  readOnly: boolean
}): CharacterCreationWizardViewModel | null => {
  const preferLocalReviewFlow = !readOnly && flow?.step === 'review'

  if (characterReadModel && projectedCreation) {
    if (characterReadModel.status === 'CHARACTERISTICS') {
      return readModelCharacteristicStepViewModel(characterReadModel, readOnly)
    }

    if (readOnly && characterReadModel.status === 'HOMEWORLD') {
      return readModelHomeworldStepViewModel({
        readModel: characterReadModel,
        projectedCreation,
        readOnly
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

  return {
    step: flow.step,
    projectedStep: projection.step,
    projectedStepCurrent: projection.step === flow.step,
    controlsDisabled: readOnly,
    progress: deriveCharacterCreationStepProgressItems(flow),
    buttons: deriveCharacterCreationButtonStates(flow),
    validation: deriveCharacterCreationValidationSummary(flow),
    nextStep: deriveCharacterCreationNextStepViewModel(flow, {
      backgroundCascadeChoices
    }),
    careerSelection: deriveCharacterCreationCareerSelectionViewModel(flow, {
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
  actionPlan = null
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
    readOnly
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
