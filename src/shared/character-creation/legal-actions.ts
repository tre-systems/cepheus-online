import type {
  CareerCreationActionContext,
  CareerCreationActionKey,
  CareerCreationPendingDecisionKey,
  CareerCreationState
} from './types'

const defaultActionContext = {
  remainingMusteringBenefits: 0,
  canContinueCareer: false,
  canCompleteCreation: false,
  reenlistmentOutcome: 'unresolved'
} satisfies Required<Omit<CareerCreationActionContext, 'pendingDecisions'>>

const hasPendingDecision = (
  context: CareerCreationActionContext,
  key: CareerCreationPendingDecisionKey
): boolean =>
  context.pendingDecisions?.some((decision) => decision.key === key) ?? false

const hasAnyPendingDecision = (context: CareerCreationActionContext): boolean =>
  (context.pendingDecisions?.length ?? 0) > 0

export const deriveLegalCareerCreationActionKeys = (
  state: CareerCreationState,
  context: CareerCreationActionContext = {}
): CareerCreationActionKey[] => {
  const options = {
    ...defaultActionContext,
    ...context
  }

  const noPendingDecisions = !hasAnyPendingDecision(context)

  switch (state.status) {
    case 'CHARACTERISTICS':
      return hasPendingDecision(context, 'characteristicAssignment')
        ? []
        : ['setCharacteristics']
    case 'HOMEWORLD':
      return hasPendingDecision(context, 'homeworldSkillSelection')
        ? []
        : ['completeHomeworld']
    case 'CAREER_SELECTION':
      return hasPendingDecision(context, 'careerQualification')
        ? []
        : ['selectCareer']
    case 'BASIC_TRAINING':
      return noPendingDecisions ? ['completeBasicTraining'] : []
    case 'SURVIVAL':
      return noPendingDecisions ? ['rollSurvival'] : []
    case 'MISHAP':
      return hasPendingDecision(context, 'mishapResolution')
        ? []
        : ['resolveMishap', 'confirmDeath']
    case 'COMMISSION':
      if (!state.context.canCommission || !noPendingDecisions) return []
      return ['rollCommission', 'skipCommission']
    case 'ADVANCEMENT':
      if (!state.context.canAdvance || !noPendingDecisions) return []
      return ['rollAdvancement', 'skipAdvancement']
    case 'SKILLS_TRAINING':
      return noPendingDecisions ? ['completeSkills'] : []
    case 'AGING':
      return noPendingDecisions ? ['resolveAging'] : []
    case 'REENLISTMENT':
      if (!noPendingDecisions) return []
      if (options.reenlistmentOutcome === 'unresolved') {
        return ['rollReenlistment']
      }
      if (options.reenlistmentOutcome === 'forced') return ['forcedReenlist']
      if (options.reenlistmentOutcome === 'allowed') {
        return ['reenlist', 'leaveCareer']
      }
      return ['leaveCareer']
    case 'MUSTERING_OUT':
      if (!noPendingDecisions) return []
      if (options.remainingMusteringBenefits > 0) {
        return ['resolveMusteringBenefit']
      }
      return [
        ...(options.canContinueCareer ? ['continueCareer' as const] : []),
        'finishMustering'
      ]
    case 'ACTIVE':
      return noPendingDecisions && options.canCompleteCreation
        ? ['completeCreation']
        : []
    case 'PLAYABLE':
      return []
    case 'DECEASED':
      return []
    default: {
      const exhaustive: never = state.status
      return exhaustive
    }
  }
}
