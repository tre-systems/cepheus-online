import { deriveRemainingCareerBenefits } from './benefits'
import { canCompleteCreation, canOfferNewCareer } from './term-lifecycle'
import type {
  CareerCreationActionContext,
  CareerCreationActionKey,
  CareerCreationActionProjection,
  CareerCreationPendingDecision,
  CareerCreationPendingDecisionKey,
  CareerCreationReenlistmentOutcome,
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

const lastTerm = (
  creation: CareerCreationActionProjection
): NonNullable<CareerCreationActionProjection['terms']>[number] | null =>
  creation.terms?.[creation.terms.length - 1] ?? null

const termsInCareer = (
  creation: CareerCreationActionProjection,
  career: string
): number =>
  creation.terms?.filter((term) => term.career === career).length ?? 0

const benefitsReceivedInCareer = (
  creation: CareerCreationActionProjection,
  career: string
): number =>
  creation.terms
    ?.filter((term) => term.career === career)
    .reduce((total, term) => total + term.benefits.length, 0) ?? 0

const rankInCareer = (
  creation: CareerCreationActionProjection,
  career: string
): number => creation.careers?.find((entry) => entry.name === career)?.rank ?? 0

export const deriveRemainingCareerCreationBenefits = (
  creation: CareerCreationActionProjection
): number => {
  if (!creation.terms) return 0

  let remaining = 0
  const seen = new Set<string>()
  for (const term of creation.terms) {
    if (seen.has(term.career)) continue
    seen.add(term.career)
    remaining += deriveRemainingCareerBenefits({
      termsInCareer: termsInCareer(creation, term.career),
      currentRank: rankInCareer(creation, term.career),
      benefitsReceived: benefitsReceivedInCareer(creation, term.career)
    })
  }

  return remaining
}

export const deriveCareerCreationPendingDecisions = (
  creation: CareerCreationActionProjection
): CareerCreationPendingDecision[] => {
  const decisions: CareerCreationPendingDecision[] = []
  const term = lastTerm(creation)

  if ((creation.pendingCascadeSkills?.length ?? 0) > 0) {
    decisions.push({ key: 'cascadeSkillResolution' })
  }

  if (
    creation.state.status === 'BASIC_TRAINING' &&
    term &&
    !term.completedBasicTraining &&
    term.skillsAndTraining.length === 0
  ) {
    decisions.push({ key: 'basicTrainingSkillSelection' })
  }

  if (
    creation.state.status === 'SKILLS_TRAINING' &&
    term &&
    term.skillsAndTraining.length === 0
  ) {
    decisions.push({ key: 'skillTrainingSelection' })
  }

  if ((creation.characteristicChanges?.length ?? 0) > 0) {
    decisions.push({ key: 'agingResolution' })
  }

  if (
    creation.state.status === 'REENLISTMENT' &&
    deriveCareerCreationReenlistmentOutcome(creation) === 'unresolved'
  ) {
    decisions.push({ key: 'reenlistmentResolution' })
  }

  if (
    creation.state.status === 'MUSTERING_OUT' &&
    deriveRemainingCareerCreationBenefits(creation) > 0
  ) {
    decisions.push({ key: 'musteringBenefitSelection' })
  }

  return decisions
}

export const deriveCareerCreationReenlistmentOutcome = (
  creation: CareerCreationActionProjection
): CareerCreationReenlistmentOutcome => {
  if (creation.state.status !== 'REENLISTMENT') return 'unresolved'

  const term = lastTerm(creation)
  if (!term) return 'unresolved'
  if ((creation.terms?.length ?? 0) >= 7) return 'retire'
  if (term.reEnlistment === 12) return 'forced'
  if (term.reEnlistment !== undefined && term.canReenlist) return 'allowed'
  if (term.musteringOut || !term.canReenlist) return 'blocked'

  return 'unresolved'
}

export const deriveCareerCreationActionContext = (
  creation: CareerCreationActionProjection
): CareerCreationActionContext => {
  const pendingDecisions = deriveCareerCreationPendingDecisions(creation)
  const noOutstandingSelections = pendingDecisions.length === 0
  const remainingMusteringBenefits =
    deriveRemainingCareerCreationBenefits(creation)
  const terms = creation.terms ?? []

  return {
    pendingDecisions,
    remainingMusteringBenefits,
    canContinueCareer: canOfferNewCareer({
      noOutstandingSelections,
      termCount: terms.length,
      remainingBenefits: remainingMusteringBenefits
    }),
    canCompleteCreation:
      creation.creationComplete !== true &&
      canCompleteCreation({ noOutstandingSelections, terms }),
    reenlistmentOutcome: deriveCareerCreationReenlistmentOutcome(creation)
  }
}

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

export const deriveLegalCareerCreationActionKeysForProjection = (
  creation: CareerCreationActionProjection
): CareerCreationActionKey[] =>
  deriveLegalCareerCreationActionKeys(
    creation.state,
    deriveCareerCreationActionContext(creation)
  )
