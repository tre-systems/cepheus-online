import type {
  InjuryOutcome,
  SurvivalFailureOutcome,
  SurvivalFailureRollFact,
  SurvivalMishapOutcome,
  SurvivalMishapRollFact
} from './types'

const clampD6 = (roll: number): number =>
  Math.max(1, Math.min(6, Math.trunc(roll)))

const SURVIVAL_MISHAPS = [
  {
    id: 'injured_in_action',
    description:
      'Injured in action. Treat as injury table result 2, or roll twice and take the lower result.',
    discharge: 'honorable',
    benefitEffect: 'forfeit_current_term',
    debtCredits: 0,
    extraServiceYears: 0,
    injury: {
      type: 'fixed',
      injuryRoll: 2,
      alternative: 'roll_twice_take_lower'
    }
  },
  {
    id: 'honorable_discharge',
    description: 'Honorably discharged from the service.',
    discharge: 'honorable',
    benefitEffect: 'forfeit_current_term',
    debtCredits: 0,
    extraServiceYears: 0,
    injury: null
  },
  {
    id: 'legal_battle_debt',
    description:
      'Honorably discharged after a long legal battle, creating Cr10,000 debt.',
    discharge: 'honorable',
    benefitEffect: 'forfeit_current_term',
    debtCredits: 10000,
    extraServiceYears: 0,
    injury: null
  },
  {
    id: 'dishonorable_discharge',
    description: 'Dishonorably discharged from the service. Lose all benefits.',
    discharge: 'dishonorable',
    benefitEffect: 'lose_all',
    debtCredits: 0,
    extraServiceYears: 0,
    injury: null
  },
  {
    id: 'prison_discharge',
    description:
      'Dishonorably discharged after serving an extra 4 years in prison. Lose all benefits.',
    discharge: 'dishonorable',
    benefitEffect: 'lose_all',
    debtCredits: 0,
    extraServiceYears: 4,
    injury: null
  },
  {
    id: 'medical_discharge',
    description:
      'Medically discharged from the service. Roll on the Injury table.',
    discharge: 'medical',
    benefitEffect: 'forfeit_current_term',
    debtCredits: 0,
    extraServiceYears: 0,
    injury: { type: 'roll' }
  }
] as const satisfies readonly Omit<SurvivalMishapOutcome, 'career' | 'roll'>[]

const INJURIES = [
  {
    id: 'nearly_killed',
    description:
      'Nearly killed. Reduce one physical characteristic by 1D6, and reduce both other physical characteristics by 2 or one by 4.',
    crisisRisk: true
  },
  {
    id: 'severely_injured',
    description: 'Severely injured. Reduce one physical characteristic by 1D6.',
    crisisRisk: true
  },
  {
    id: 'missing_eye_or_limb',
    description: 'Missing eye or limb. Reduce Strength or Dexterity by 2.',
    crisisRisk: true
  },
  {
    id: 'scarred',
    description:
      'Scarred and injured. Reduce any one physical characteristic by 2.',
    crisisRisk: true
  },
  {
    id: 'injured',
    description: 'Injured. Reduce any physical characteristic by 1.',
    crisisRisk: true
  },
  {
    id: 'lightly_injured',
    description: 'Lightly injured. No permanent effect.',
    crisisRisk: false
  }
] as const satisfies readonly Omit<InjuryOutcome, 'career' | 'roll'>[]

export const resolveSurvivalMishapOutcome = ({
  career,
  roll
}: {
  career: string
  roll: SurvivalMishapRollFact
}): SurvivalMishapOutcome => {
  const tableRoll = clampD6(roll.total)
  const mishap = SURVIVAL_MISHAPS[tableRoll - 1]

  return {
    ...mishap,
    career,
    roll: tableRoll
  }
}

export const resolveSurvivalFailureOutcome = ({
  career,
  survival,
  mishap
}: {
  career: string
  survival: SurvivalFailureRollFact
  mishap?: SurvivalMishapRollFact
}): SurvivalFailureOutcome => {
  if (!mishap) {
    return {
      type: 'death',
      career,
      survival,
      reason: 'failed_survival'
    }
  }

  return {
    type: 'mishap',
    career,
    survival,
    mishap: resolveSurvivalMishapOutcome({ career, roll: mishap }),
    forcedCareerExit: true,
    servedYears: 2,
    forfeitCurrentTermBenefit: true
  }
}

export const resolveInjuryOutcome = ({
  career,
  roll
}: {
  career: string
  roll: SurvivalMishapRollFact
}): InjuryOutcome => {
  const tableRoll = clampD6(roll.total)
  const injury = INJURIES[tableRoll - 1]

  return {
    ...injury,
    career,
    roll: tableRoll
  }
}
