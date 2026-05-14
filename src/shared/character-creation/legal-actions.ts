import { deriveRemainingCareerBenefits } from './benefits'
import { CEPHEUS_SRD_RULESET } from './cepheus-srd-ruleset'
import { deriveBasicTrainingPlan } from './career-rules'
import { canCompleteCreation, canOfferNewCareer } from './term-lifecycle'
import type {
  CareerCreationActionContext,
  CareerCreationActionKey,
  CareerCreationActionPlan,
  CareerCreationActionProjection,
  CareerCreationPendingDecision,
  CareerCreationPendingDecisionKey,
  CareerCreationReenlistmentOutcome,
  CareerCreationState,
  LegalCareerCreationAction
} from './types'

const defaultActionContext = {
  requiredTermSkillCount: 1,
  remainingMusteringBenefits: 0,
  canContinueCareer: false,
  canCompleteCreation: false,
  canResolveBasicTrainingSelection: false,
  reenlistmentOutcome: 'unresolved',
  failedToQualify: false,
  canEnterDraft: true
} satisfies Required<Omit<CareerCreationActionContext, 'pendingDecisions'>>

const hasPendingDecision = (
  context: CareerCreationActionContext,
  key: CareerCreationPendingDecisionKey
): boolean =>
  context.pendingDecisions?.some((decision) => decision.key === key) ?? false

const hasAnyPendingDecision = (context: CareerCreationActionContext): boolean =>
  (context.pendingDecisions?.length ?? 0) > 0

const hasOnlyPendingDecision = (
  context: CareerCreationActionContext,
  key: CareerCreationPendingDecisionKey
): boolean => {
  const decisions = context.pendingDecisions ?? []
  return (
    decisions.length > 0 && decisions.every((decision) => decision.key === key)
  )
}

const deriveFailedQualificationActionOptions = (
  canEnterDraft: boolean
): NonNullable<LegalCareerCreationAction['failedQualificationOptions']> => [
  { option: 'Drifter' },
  ...(canEnterDraft
    ? [
        {
          option: 'Draft' as const,
          rollRequirement: { key: 'draft' as const, dice: '1d6' as const }
        }
      ]
    : [])
]

const lastTerm = (
  creation: CareerCreationActionProjection
): NonNullable<CareerCreationActionProjection['terms']>[number] | null =>
  creation.terms?.[creation.terms.length - 1] ?? null

const backgroundSelectionCount = (
  creation: CareerCreationActionProjection
): number =>
  (creation.backgroundSkills?.length ?? 0) +
  (creation.pendingCascadeSkills?.length ?? 0)

const hasIncompleteHomeworldSelection = (
  creation: CareerCreationActionProjection
): boolean => {
  if (creation.state.status !== 'HOMEWORLD') return false
  const allowance = creation.backgroundSkillAllowance ?? 0
  if (allowance <= 0) return false

  return backgroundSelectionCount(creation) < allowance
}

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

const hasAnagathicsDecisionForActiveTerm = (
  creation: CareerCreationActionProjection
): boolean => {
  const termIndex = (creation.terms?.length ?? 0) - 1
  if (termIndex < 0) return false

  return (
    creation.history?.some(
      (event) =>
        event.type === 'DECIDE_ANAGATHICS' && event.termIndex === termIndex
    ) ?? false
  )
}

const shouldDecideAnagathics = (
  creation: CareerCreationActionProjection
): boolean => {
  if (creation.state.status !== 'AGING') return false
  if ((creation.characteristicChanges?.length ?? 0) > 0) return false

  const term = lastTerm(creation)
  if (!term) return false
  if (hasAnagathicsDecisionForActiveTerm(creation)) return false
  if (!CEPHEUS_SRD_RULESET.careerBasics[term.career]) return false

  return term.survival !== undefined
}

const canResolveBasicTrainingSelection = (
  creation: CareerCreationActionProjection,
  pendingDecisions: readonly CareerCreationPendingDecision[]
): boolean => {
  if (
    creation.state.status !== 'BASIC_TRAINING' ||
    pendingDecisions.length === 0 ||
    !pendingDecisions.every(
      (decision) => decision.key === 'basicTrainingSkillSelection'
    )
  ) {
    return false
  }
  const term = lastTerm(creation)
  if (!term) return false
  const previousTerms = creation.terms?.slice(0, -1) ?? []
  return (
    deriveBasicTrainingPlan({
      career: term.career,
      serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
      completedTermCount: previousTerms.length,
      previousCareerNames: previousTerms.map(
        (previousTerm) => previousTerm.career
      )
    }).kind === 'choose-one'
  )
}

const basicTrainingCommandTypes = [
  'CompleteCharacterCreationBasicTraining'
] as unknown as LegalCareerCreationAction['commandTypes']

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
  const decisions: CareerCreationPendingDecision[] = [
    ...(creation.pendingDecisions ?? []).map((decision) => ({ ...decision }))
  ]
  const pushDecision = (decision: CareerCreationPendingDecision) => {
    if (!decisions.some((candidate) => candidate.key === decision.key)) {
      decisions.push(decision)
    }
  }
  const term = lastTerm(creation)

  if ((creation.pendingCascadeSkills?.length ?? 0) > 0) {
    pushDecision({ key: 'cascadeSkillResolution' })
  }

  if (hasIncompleteHomeworldSelection(creation)) {
    pushDecision({ key: 'homeworldSkillSelection' })
  }

  if (
    creation.state.status === 'BASIC_TRAINING' &&
    term &&
    !term.completedBasicTraining &&
    term.skillsAndTraining.length === 0
  ) {
    const basicTraining = deriveBasicTrainingPlan({
      career: term.career,
      serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
      completedTermCount: Math.max(0, (creation.terms?.length ?? 1) - 1),
      previousCareerNames:
        creation.terms?.slice(0, -1).map((previous) => previous.career) ?? []
    })
    if (basicTraining.kind === 'choose-one') {
      pushDecision({ key: 'basicTrainingSkillSelection' })
    }
  }

  if (
    creation.state.status === 'SKILLS_TRAINING' &&
    term &&
    term.skills.length < (creation.requiredTermSkillCount ?? 1)
  ) {
    pushDecision({ key: 'skillTrainingSelection' })
  }

  if ((creation.characteristicChanges?.length ?? 0) > 0) {
    pushDecision({ key: 'agingResolution' })
  }

  if (shouldDecideAnagathics(creation)) {
    pushDecision({ key: 'anagathicsDecision' })
  }

  if (
    creation.state.status === 'REENLISTMENT' &&
    deriveCareerCreationReenlistmentOutcome(creation) === 'unresolved'
  ) {
    pushDecision({ key: 'reenlistmentResolution' })
  }

  if (
    creation.state.status === 'MUSTERING_OUT' &&
    deriveRemainingCareerCreationBenefits(creation) > 0
  ) {
    pushDecision({ key: 'musteringBenefitSelection' })
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
  const canResolveBasicTraining = canResolveBasicTrainingSelection(
    creation,
    pendingDecisions
  )

  return {
    pendingDecisions,
    ...(creation.requiredTermSkillCount === undefined
      ? {}
      : { requiredTermSkillCount: creation.requiredTermSkillCount }),
    remainingMusteringBenefits,
    canContinueCareer: canOfferNewCareer({
      noOutstandingSelections,
      termCount: terms.length,
      remainingBenefits: remainingMusteringBenefits
    }),
    canCompleteCreation:
      creation.creationComplete !== true &&
      canCompleteCreation({ noOutstandingSelections, terms }),
    ...(canResolveBasicTraining
      ? { canResolveBasicTrainingSelection: true }
      : {}),
    reenlistmentOutcome: deriveCareerCreationReenlistmentOutcome(creation),
    ...(creation.failedToQualify === undefined
      ? {}
      : { failedToQualify: creation.failedToQualify }),
    ...(creation.canEnterDraft === undefined
      ? {}
      : { canEnterDraft: creation.canEnterDraft })
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
  const hasOnlyAgingResolution =
    context.pendingDecisions?.length === 1 &&
    hasPendingDecision(context, 'agingResolution')
  const canResolveAgingLossesBeforeReenlistment =
    hasPendingDecision(context, 'agingResolution') &&
    (context.pendingDecisions?.every(
      (decision) =>
        decision.key === 'agingResolution' ||
        decision.key === 'reenlistmentResolution'
    ) ??
      false)

  switch (state.status) {
    case 'CHARACTERISTICS':
      return hasPendingDecision(context, 'characteristicAssignment')
        ? []
        : ['setCharacteristics']
    case 'HOMEWORLD':
      return noPendingDecisions ? ['completeHomeworld'] : []
    case 'CAREER_SELECTION':
      if (hasPendingDecision(context, 'careerQualification')) return []
      if (options.failedToQualify) {
        return ['selectCareer']
      }
      return ['selectCareer']
    case 'BASIC_TRAINING':
      return noPendingDecisions || options.canResolveBasicTrainingSelection
        ? ['completeBasicTraining']
        : []
    case 'SURVIVAL':
      return noPendingDecisions ? ['rollSurvival'] : []
    case 'MISHAP':
      if (hasAnyPendingDecision(context)) {
        const hasSurvivalResolution = hasPendingDecision(
          context,
          'survivalResolution'
        )
        const hasMishapResolution = hasPendingDecision(
          context,
          'mishapResolution'
        )

        if (
          hasSurvivalResolution &&
          !hasMishapResolution &&
          context.pendingDecisions?.length === 1
        ) {
          return ['confirmDeath']
        }

        if (
          hasMishapResolution &&
          !hasSurvivalResolution &&
          context.pendingDecisions?.length === 1
        ) {
          return ['resolveMishap']
        }

        return []
      }

      return ['resolveMishap', 'confirmDeath']
    case 'COMMISSION':
      if (!state.context.canCommission || !noPendingDecisions) return []
      return ['rollCommission', 'skipCommission']
    case 'ADVANCEMENT':
      if (!state.context.canAdvance || !noPendingDecisions) return []
      return ['rollAdvancement', 'skipAdvancement']
    case 'SKILLS_TRAINING':
      return noPendingDecisions ||
        hasOnlyPendingDecision(context, 'skillTrainingSelection')
        ? ['completeSkills']
        : []
    case 'AGING':
      if (
        context.pendingDecisions?.length === 1 &&
        hasPendingDecision(context, 'anagathicsDecision')
      ) {
        return ['decideAnagathics']
      }
      return noPendingDecisions ? ['resolveAging'] : []
    case 'REENLISTMENT':
      if (hasOnlyAgingResolution || canResolveAgingLossesBeforeReenlistment) {
        return ['resolveAging']
      }
      if (options.reenlistmentOutcome === 'unresolved') {
        return (context.pendingDecisions?.every(
          (decision) => decision.key === 'reenlistmentResolution'
        ) ?? true)
          ? ['rollReenlistment']
          : []
      }
      if (!noPendingDecisions) return []
      if (options.reenlistmentOutcome === 'forced') return ['forcedReenlist']
      if (options.reenlistmentOutcome === 'allowed') {
        return ['reenlist', 'leaveCareer']
      }
      return ['leaveCareer']
    case 'MUSTERING_OUT':
      if (options.remainingMusteringBenefits > 0) {
        return noPendingDecisions ||
          hasOnlyPendingDecision(context, 'musteringBenefitSelection')
          ? ['resolveMusteringBenefit']
          : []
      }
      if (!noPendingDecisions) return []
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

const actionDefinitions = {
  setCharacteristics: {
    commandTypes: ['RollCharacterCreationCharacteristic'],
    rollRequirement: { key: 'characteristics', dice: '2d6' }
  },
  completeHomeworld: {
    commandTypes: ['CompleteCharacterCreationHomeworld']
  },
  selectCareer: {
    commandTypes: [
      'ResolveCharacterCreationQualification',
      'ResolveCharacterCreationDraft',
      'EnterCharacterCreationDrifter'
    ],
    rollRequirement: { key: 'careerQualification', dice: '2d6' }
  },
  completeBasicTraining: {
    commandTypes: basicTrainingCommandTypes
  },
  rollSurvival: {
    commandTypes: ['ResolveCharacterCreationSurvival'],
    rollRequirement: { key: 'survival', dice: '2d6' }
  },
  resolveMishap: {
    commandTypes: ['ResolveCharacterCreationMishap'],
    rollRequirement: { key: 'mishap', dice: '2d6' }
  },
  confirmDeath: {
    commandTypes: ['ConfirmCharacterCreationDeath']
  },
  rollCommission: {
    commandTypes: ['ResolveCharacterCreationCommission'],
    rollRequirement: { key: 'commission', dice: '2d6' }
  },
  skipCommission: {
    commandTypes: ['SkipCharacterCreationCommission']
  },
  rollAdvancement: {
    commandTypes: ['ResolveCharacterCreationAdvancement'],
    rollRequirement: { key: 'advancement', dice: '2d6' }
  },
  skipAdvancement: {
    commandTypes: ['SkipCharacterCreationAdvancement']
  },
  completeSkills: {
    commandTypes: [
      'RollCharacterCreationTermSkill',
      'CompleteCharacterCreationSkills'
    ],
    rollRequirement: { key: 'termSkill', dice: '1d6' }
  },
  resolveAging: {
    commandTypes: [
      'ResolveCharacterCreationAging',
      'ResolveCharacterCreationAgingLosses'
    ],
    rollRequirement: { key: 'aging', dice: '2d6' }
  },
  decideAnagathics: {
    commandTypes: ['DecideCharacterCreationAnagathics']
  },
  rollReenlistment: {
    commandTypes: ['ResolveCharacterCreationReenlistment'],
    rollRequirement: { key: 'reenlistment', dice: '2d6' }
  },
  reenlist: {
    commandTypes: ['ReenlistCharacterCreationCareer']
  },
  leaveCareer: {
    commandTypes: ['LeaveCharacterCreationCareer']
  },
  forcedReenlist: {
    commandTypes: ['ReenlistCharacterCreationCareer']
  },
  resolveMusteringBenefit: {
    commandTypes: ['RollCharacterCreationMusteringBenefit'],
    rollRequirement: { key: 'musteringBenefit', dice: '2d6' }
  },
  continueCareer: {
    commandTypes: ['ContinueCharacterCreationAfterMustering']
  },
  finishMustering: {
    commandTypes: ['CompleteCharacterCreationMustering']
  },
  completeCreation: {
    commandTypes: ['FinalizeCharacterCreation']
  }
} satisfies Record<
  CareerCreationActionKey,
  Omit<LegalCareerCreationAction, 'key' | 'status'>
>

export const deriveLegalCareerCreationActions = (
  state: CareerCreationState,
  context: CareerCreationActionContext = {}
): LegalCareerCreationAction[] => {
  const options = {
    ...defaultActionContext,
    ...context
  }

  return deriveLegalCareerCreationActionKeys(state, context).map((key) => {
    if (key === 'selectCareer' && options.failedToQualify) {
      return {
        key,
        status: state.status,
        commandTypes: actionDefinitions.selectCareer.commandTypes,
        failedQualificationOptions: deriveFailedQualificationActionOptions(
          options.canEnterDraft
        )
      }
    }

    return {
      key,
      status: state.status,
      ...actionDefinitions[key]
    }
  })
}

export const deriveLegalCareerCreationActionKeysForProjection = (
  creation: CareerCreationActionProjection
): CareerCreationActionKey[] =>
  deriveLegalCareerCreationActionKeys(
    creation.state,
    deriveCareerCreationActionContext(creation)
  )

export const deriveCareerCreationActionPlan = (
  creation: CareerCreationActionProjection
): CareerCreationActionPlan => {
  const context = deriveCareerCreationActionContext(creation)

  return {
    status: creation.state.status,
    pendingDecisions: context.pendingDecisions ?? [],
    legalActions: deriveLegalCareerCreationActions(creation.state, context)
  }
}

export const projectCareerCreationActionPlan = <
  TCreation extends CareerCreationActionProjection
>(
  creation: TCreation
): TCreation & { actionPlan: CareerCreationActionPlan } => ({
  ...creation,
  actionPlan: deriveCareerCreationActionPlan(creation)
})
