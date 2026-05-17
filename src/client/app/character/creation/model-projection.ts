import type {
  CharacterCreationReadModel,
  CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state'
import { deriveCharacterCreationProjectionReadModel } from '../../../../shared/character-creation/view-state'
import {
  deriveCepheusCareerDefinitions,
  type CepheusRuleset
} from '../../../../shared/character-creation/cepheus-srd-ruleset'
import type { CareerCreationActionKey } from '../../../../shared/character-creation/types'
import type { CharacterCreationProjection } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow'
import { completedTermsFromReadModel } from './read-model-flow'
import type {
  CharacterCreationPendingViewModel,
  CharacterCreationProjectedActionSection,
  CharacterCreationProjectionViewModel
} from './model-types'
import {
  characteristicDefinitions,
  formatCharacterCreationCharacteristicModifier,
  formatCharacterCreationCompletedTermSummary,
  type CharacterCreationCharacteristicGridViewModel,
  type CharacterCreationTermHistoryViewModel
} from './view'

export type CharacterCreationFlowRulesOptions = {
  ruleset?: CepheusRuleset
  careers?: ReturnType<typeof deriveCepheusCareerDefinitions>
}

export const emptyHomeworldChoiceOptions = {
  lawLevels: [],
  tradeCodes: [],
  backgroundSkills: []
} as const

export const projectionViewModel = (
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

export const projectedCharacteristicGridViewModel = (
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

export const pendingViewModel = (
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

export const projectedTermHistoryViewModel = (
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

export const flowRulesOptions = (
  flow: CharacterCreationFlow
): CharacterCreationFlowRulesOptions =>
  flow.ruleset
    ? {
        ruleset: flow.ruleset,
        careers: deriveCepheusCareerDefinitions(flow.ruleset)
      }
    : {}
