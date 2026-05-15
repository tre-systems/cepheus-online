import type { CharacterCharacteristics, CharacteristicKey } from '../state'
import { clamp } from '../util'
import type {
  CareerCreationPendingDecision,
  InjuryLossResolution,
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

export const deriveSurvivalFailurePendingDecision = (
  outcome: SurvivalFailureOutcome
): CareerCreationPendingDecision => ({
  key: outcome.type === 'death' ? 'survivalResolution' : 'mishapResolution'
})

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

export const physicalInjuryLossTargets = [
  'str',
  'dex',
  'end'
] satisfies CharacteristicKey[]

export type InjurySecondaryChoice =
  | { mode: 'both_other_physical' }
  | { mode: 'one_other_physical'; characteristic: CharacteristicKey }

export type InjuryLossResolutionErrorCode =
  | 'injury_primary_target_required'
  | 'injury_invalid_primary_target'
  | 'injury_severity_roll_required'
  | 'injury_secondary_choice_required'
  | 'injury_invalid_secondary_target'

export interface InjuryLossResolutionError {
  code: InjuryLossResolutionErrorCode
  message: string
}

export type InjuryLossResolutionResult =
  | { ok: true; value: InjuryLossResolution }
  | { ok: false; error: InjuryLossResolutionError }

const err = (
  code: InjuryLossResolutionErrorCode,
  message: string
): InjuryLossResolutionResult => ({ ok: false, error: { code, message } })

const ok = (value: InjuryLossResolution): InjuryLossResolutionResult => ({
  ok: true,
  value
})

const injurySeverity = (roll: number | null | undefined): number | null =>
  typeof roll === 'number' ? clampD6(roll) : null

const remainingPhysicalTargets = (
  primary: CharacteristicKey
): CharacteristicKey[] =>
  physicalInjuryLossTargets.filter((target) => target !== primary)

const requirePrimaryTarget = (
  primary: CharacteristicKey | null | undefined,
  allowedTargets: readonly CharacteristicKey[]
): InjuryLossResolutionResult | null => {
  if (!primary) {
    return err(
      'injury_primary_target_required',
      'Choose the injured characteristic'
    )
  }
  if (!allowedTargets.includes(primary)) {
    return err(
      'injury_invalid_primary_target',
      `${primary} cannot receive this injury`
    )
  }

  return null
}

const patchCharacteristics = ({
  characteristics,
  selectedLosses
}: {
  characteristics: CharacterCharacteristics
  selectedLosses: InjuryLossResolution['selectedLosses']
}): InjuryLossResolution => {
  const characteristicPatch: InjuryLossResolution['characteristicPatch'] = {}

  for (const loss of selectedLosses) {
    const current =
      characteristicPatch[loss.characteristic] ??
      characteristics[loss.characteristic] ??
      0
    characteristicPatch[loss.characteristic] = clamp(
      current + loss.modifier,
      0,
      Number.MAX_SAFE_INTEGER
    )
  }

  return {
    selectedLosses: selectedLosses.map((loss) => ({ ...loss })),
    characteristicPatch
  }
}

export const resolveInjuryLosses = ({
  characteristics,
  injury,
  primaryCharacteristic,
  secondaryChoice,
  severityRoll
}: {
  characteristics: CharacterCharacteristics
  injury: InjuryOutcome
  primaryCharacteristic?: CharacteristicKey | null
  secondaryChoice?: InjurySecondaryChoice | null
  severityRoll?: number | null
}): InjuryLossResolutionResult => {
  if (injury.id === 'lightly_injured') {
    return ok(
      patchCharacteristics({
        characteristics,
        selectedLosses: []
      })
    )
  }

  if (injury.id === 'missing_eye_or_limb') {
    const primaryError = requirePrimaryTarget(primaryCharacteristic, [
      'str',
      'dex'
    ])
    if (primaryError) return primaryError
    const primary = primaryCharacteristic as CharacteristicKey

    return ok(
      patchCharacteristics({
        characteristics,
        selectedLosses: [{ characteristic: primary, modifier: -2 }]
      })
    )
  }

  const primaryError = requirePrimaryTarget(
    primaryCharacteristic,
    physicalInjuryLossTargets
  )
  if (primaryError) return primaryError
  const primary = primaryCharacteristic as CharacteristicKey

  if (injury.id === 'injured' || injury.id === 'scarred') {
    return ok(
      patchCharacteristics({
        characteristics,
        selectedLosses: [
          {
            characteristic: primary,
            modifier: injury.id === 'injured' ? -1 : -2
          }
        ]
      })
    )
  }

  const severity = injurySeverity(severityRoll)
  if (severity === null) {
    return err(
      'injury_severity_roll_required',
      'An injury severity roll is required'
    )
  }

  if (injury.id === 'severely_injured') {
    return ok(
      patchCharacteristics({
        characteristics,
        selectedLosses: [
          { characteristic: primary, modifier: -severity }
        ]
      })
    )
  }

  if (!secondaryChoice) {
    return err(
      'injury_secondary_choice_required',
      'Choose how to apply the remaining injury losses'
    )
  }

  const remainingTargets = remainingPhysicalTargets(primary)
  if (secondaryChoice.mode === 'one_other_physical') {
    if (!remainingTargets.includes(secondaryChoice.characteristic)) {
      return err(
        'injury_invalid_secondary_target',
        `${secondaryChoice.characteristic} cannot receive this injury`
      )
    }

    return ok(
      patchCharacteristics({
        characteristics,
        selectedLosses: [
          { characteristic: primary, modifier: -severity },
          { characteristic: secondaryChoice.characteristic, modifier: -4 }
        ]
      })
    )
  }

  return ok(
    patchCharacteristics({
      characteristics,
      selectedLosses: [
        { characteristic: primary, modifier: -severity },
        ...remainingTargets.map((characteristic) => ({
          characteristic,
          modifier: -2
        }))
      ]
    })
  )
}
