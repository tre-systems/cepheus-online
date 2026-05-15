import {
  canRollCashBenefit,
  deriveCareerTermCashBenefitCount,
  deriveCareerTermMusteringBenefitCount,
  deriveRemainingCareerBenefits
} from './benefits'
import { derivePrimaryEducationSkillOptions } from './background-skills'
import {
  CEPHEUS_SRD_CAREERS,
  CEPHEUS_SRD_RULESET,
  type CepheusCareerDefinition
} from './cepheus-srd-ruleset'
import {
  characteristicModifier,
  deriveBasicTrainingPlan,
  parseCareerCheck
} from './career-rules'
import {
  careerSkillWithLevel,
  formatCareerSkill,
  isCascadeCareerSkill,
  normalizeCareerSkill,
  parseCareerSkill
} from './skills'
import { canCompleteCreation, canOfferNewCareer } from './term-lifecycle'
import type {
  CascadeSkillChoice,
  BasicTrainingActionOption,
  CareerChoiceCheckOption,
  CareerChoiceOptions,
  CareerCreationActionContext,
  CareerCreationActionKey,
  CareerCreationActionPlan,
  CareerCreationActionPlanOptions,
  CareerCreationActionProjection,
  CareerCreationTermSkillTable,
  CareerCreationPendingDecision,
  CareerCreationPendingDecisionKey,
  CareerCreationReenlistmentOutcome,
  CareerCreationState,
  HomeworldChoiceOptions,
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

type ProjectedCareerTerm = NonNullable<
  CareerCreationActionProjection['terms']
>[number]

const hasResolvedSurvivalForRules = (term: ProjectedCareerTerm): boolean =>
  term.facts?.survival !== undefined || term.survival !== undefined

const basicTrainingSkillCountForRules = (term: ProjectedCareerTerm): number =>
  term.facts?.basicTrainingSkills?.length ?? term.skillsAndTraining.length

const termSkillRollCountForRules = (term: ProjectedCareerTerm): number =>
  term.facts?.termSkillRolls?.length ?? term.skills.length

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
    .reduce(
      (total, term) => total + deriveCareerTermMusteringBenefitCount(term),
      0
    ) ?? 0

const rankInCareer = (
  creation: CareerCreationActionProjection,
  career: string
): number => creation.careers?.find((entry) => entry.name === career)?.rank ?? 0

const hasAnagathicsDecisionForActiveTerm = (
  creation: CareerCreationActionProjection
): boolean => {
  const termIndex = (creation.terms?.length ?? 0) - 1
  if (termIndex < 0) return false

  return creation.terms?.[termIndex]?.facts?.anagathicsDecision !== undefined
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

  return hasResolvedSurvivalForRules(term)
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
] as const

const termSkillTableLabels: Record<CareerCreationTermSkillTable, string> = {
  personalDevelopment: 'Personal development',
  serviceSkills: 'Service skills',
  specialistSkills: 'Specialist skills',
  advancedEducation: 'Advanced education'
}

const backgroundSkillValue = (skill: string): string =>
  isCascadeCareerSkill(skill)
    ? careerSkillWithLevel(skill, 0)
    : formatCareerSkill({ name: skill, level: 0 })

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
    basicTrainingSkillCountForRules(term) === 0
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
    termSkillRollCountForRules(term) < (creation.requiredTermSkillCount ?? 1)
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
  const projectedOutcome = term.facts?.reenlistment?.outcome
  if (projectedOutcome) return projectedOutcome
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

const deriveTermSkillTableOptions = (
  creation: CareerCreationActionProjection | undefined,
  context: CareerCreationActionContext,
  { characteristics }: CareerCreationActionPlanOptions
): NonNullable<LegalCareerCreationAction['termSkillTableOptions']> => {
  if (!creation || creation.state.status !== 'SKILLS_TRAINING') return []
  if (
    (context.pendingDecisions ?? []).some(
      (decision) => decision.key !== 'skillTrainingSelection'
    )
  ) {
    return []
  }

  const term = lastTerm(creation)
  if (!term?.career) return []
  const required =
    context.requiredTermSkillCount ??
    defaultActionContext.requiredTermSkillCount
  if (termSkillRollCountForRules(term) >= required) return []

  return (Object.keys(termSkillTableLabels) as CareerCreationTermSkillTable[])
    .filter(
      (table) =>
        table !== 'advancedEducation' || (characteristics?.edu ?? 0) >= 8
    )
    .map((table) => ({ table, label: termSkillTableLabels[table] }))
}

const deriveBasicTrainingOptions = (
  creation: CareerCreationActionProjection | undefined
): BasicTrainingActionOption | undefined => {
  if (!creation || creation.state.status !== 'BASIC_TRAINING') return undefined
  const term = lastTerm(creation)
  if (!term?.career) return undefined

  const previousTerms = creation.terms?.slice(0, -1) ?? []
  const plan = deriveBasicTrainingPlan({
    career: term.career,
    serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
    completedTermCount: previousTerms.length,
    previousCareerNames: previousTerms.map(
      (previousTerm) => previousTerm.career
    )
  })
  if (plan.kind === 'none') return { kind: 'none', skills: [] }

  return {
    kind: plan.kind,
    skills: plan.skills
      .map((skill) => normalizeCareerSkill(skill, 0))
      .filter((skill): skill is string => skill !== null)
  }
}

const deriveCashBenefitsReceived = (
  creation: CareerCreationActionProjection
): number =>
  (creation.terms ?? []).reduce(
    (total, term) => total + deriveCareerTermCashBenefitCount(term),
    0
  )

const deriveMusteringBenefitOptions = (
  creation: CareerCreationActionProjection | undefined,
  context: CareerCreationActionContext
): NonNullable<LegalCareerCreationAction['musteringBenefitOptions']> => {
  if (!creation || creation.state.status !== 'MUSTERING_OUT') return []
  if (
    (context.pendingDecisions ?? []).some(
      (decision) => decision.key !== 'musteringBenefitSelection'
    )
  ) {
    return []
  }
  if ((context.remainingMusteringBenefits ?? 0) <= 0) return []

  const kinds = canRollCashBenefit({
    cashBenefitsReceived: deriveCashBenefitsReceived(creation)
  })
    ? (['cash', 'material'] as const)
    : (['material'] as const)

  const options: Array<
    NonNullable<LegalCareerCreationAction['musteringBenefitOptions']>[number]
  > = []
  const seen = new Set<string>()
  for (const term of creation.terms ?? []) {
    if (seen.has(term.career)) continue
    seen.add(term.career)
    if (
      deriveRemainingCareerBenefits({
        termsInCareer: termsInCareer(creation, term.career),
        currentRank: rankInCareer(creation, term.career),
        benefitsReceived: benefitsReceivedInCareer(creation, term.career)
      }) <= 0
    ) {
      continue
    }
    for (const kind of kinds) options.push({ career: term.career, kind })
  }

  return options
}

export const deriveCareerCreationCascadeSkillChoices = (
  pendingCascadeSkills: readonly string[]
): CascadeSkillChoice[] => {
  const choices: CascadeSkillChoice[] = []

  for (const cascadeSkill of pendingCascadeSkills) {
    const parsed = parseCareerSkill(cascadeSkill)
    if (!parsed) continue

    const options = CEPHEUS_SRD_RULESET.cascadeSkills[parsed.name] ?? []
    choices.push({
      cascadeSkill,
      label: parsed.name,
      level: parsed.level,
      options: options.map((option) => ({
        value: isCascadeCareerSkill(option)
          ? careerSkillWithLevel(option, parsed.level)
          : formatCareerSkill({ name: option, level: parsed.level }),
        label: option,
        cascade: isCascadeCareerSkill(option)
      }))
    })
  }

  return choices
}

const deriveHomeworldChoiceOptions = (
  creation: CareerCreationActionProjection,
  { characteristics }: CareerCreationActionPlanOptions
): HomeworldChoiceOptions | null => {
  if (creation.state.status !== 'HOMEWORLD') return null

  const homeworld = creation.homeworld ?? undefined
  const backgroundSkills = derivePrimaryEducationSkillOptions({
    edu: characteristics?.edu,
    homeworld,
    rules: CEPHEUS_SRD_RULESET
  }).map((option) => ({
    value: backgroundSkillValue(option.name),
    label: option.name,
    preselected: option.preselected,
    cascade: isCascadeCareerSkill(option.name)
  }))

  return {
    lawLevels: Object.keys(CEPHEUS_SRD_RULESET.homeWorldSkillsByLawLevel),
    tradeCodes: Object.keys(CEPHEUS_SRD_RULESET.homeWorldSkillsByTradeCode),
    backgroundSkills
  }
}

const deriveCareerChoiceCheckOption = ({
  label,
  requirement,
  characteristics
}: {
  label: string
  requirement: string
  characteristics: NonNullable<
    CareerCreationActionPlanOptions['characteristics']
  >
}): CareerChoiceCheckOption => {
  const check = parseCareerCheck(requirement)

  return {
    label,
    requirement,
    available: check !== null,
    characteristic: check?.characteristic ?? null,
    target: check?.target ?? null,
    modifier:
      check?.characteristic === undefined || check.characteristic === null
        ? 0
        : characteristicModifier(characteristics[check.characteristic])
  }
}

const deriveCareerChoiceOptions = (
  creation: CareerCreationActionProjection,
  { characteristics = {} }: CareerCreationActionPlanOptions
): CareerChoiceOptions | null => {
  if (creation.state.status !== 'CAREER_SELECTION') return null
  const activeCareer = lastTerm(creation)?.career ?? null

  return {
    careers: CEPHEUS_SRD_CAREERS.map((career: CepheusCareerDefinition) => ({
      key: career.name,
      label: career.name,
      selected: activeCareer === career.name,
      qualification: deriveCareerChoiceCheckOption({
        label: 'Qualification',
        requirement: career.qualification,
        characteristics
      }),
      survival: deriveCareerChoiceCheckOption({
        label: 'Survival',
        requirement: career.survival,
        characteristics
      }),
      commission: deriveCareerChoiceCheckOption({
        label: 'Commission',
        requirement: career.commission,
        characteristics
      }),
      advancement: deriveCareerChoiceCheckOption({
        label: 'Advancement',
        requirement: career.advancement,
        characteristics
      })
    }))
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
  context: CareerCreationActionContext = {},
  actionOptions: CareerCreationActionPlanOptions & {
    creation?: CareerCreationActionProjection
  } = {}
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

    if (key === 'completeSkills') {
      return {
        key,
        status: state.status,
        ...actionDefinitions[key],
        termSkillTableOptions: deriveTermSkillTableOptions(
          actionOptions.creation,
          context,
          actionOptions
        )
      }
    }

    if (key === 'completeBasicTraining') {
      const basicTrainingOptions = deriveBasicTrainingOptions(
        actionOptions.creation
      )
      return {
        key,
        status: state.status,
        ...actionDefinitions[key],
        ...(basicTrainingOptions ? { basicTrainingOptions } : {})
      }
    }

    if (key === 'resolveMusteringBenefit') {
      return {
        key,
        status: state.status,
        ...actionDefinitions[key],
        musteringBenefitOptions: deriveMusteringBenefitOptions(
          actionOptions.creation,
          context
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
  creation: CareerCreationActionProjection,
  options: CareerCreationActionPlanOptions = {}
): CareerCreationActionPlan => {
  const context = deriveCareerCreationActionContext(creation)
  const cascadeSkillChoices = deriveCareerCreationCascadeSkillChoices(
    creation.pendingCascadeSkills ?? []
  )
  const homeworldChoiceOptions = deriveHomeworldChoiceOptions(creation, options)
  const careerChoiceOptions = deriveCareerChoiceOptions(creation, options)

  return {
    status: creation.state.status,
    pendingDecisions: context.pendingDecisions ?? [],
    legalActions: deriveLegalCareerCreationActions(creation.state, context, {
      ...options,
      creation
    }),
    ...(cascadeSkillChoices.length > 0 ? { cascadeSkillChoices } : {}),
    ...(homeworldChoiceOptions ? { homeworldChoiceOptions } : {}),
    ...(careerChoiceOptions ? { careerChoiceOptions } : {})
  }
}

export const projectCareerCreationActionPlan = <
  TCreation extends CareerCreationActionProjection
>(
  creation: TCreation,
  options: CareerCreationActionPlanOptions = {}
): TCreation & { actionPlan: CareerCreationActionPlan } => ({
  ...creation,
  actionPlan: deriveCareerCreationActionPlan(creation, options)
})
