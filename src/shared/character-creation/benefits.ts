import type { BenefitKind, BenefitTables, CareerBenefit } from './types'

export const deriveCareerBenefitCount = ({
  termsInCareer,
  currentRank
}: {
  termsInCareer: number
  currentRank: number
}): number => termsInCareer + Math.max(0, currentRank - 3)

export const deriveRemainingCareerBenefits = ({
  termsInCareer,
  currentRank,
  benefitsReceived
}: {
  termsInCareer: number
  currentRank: number
  benefitsReceived: number
}): number =>
  Math.max(
    0,
    deriveCareerBenefitCount({ termsInCareer, currentRank }) - benefitsReceived
  )

export const resolveCareerBenefit = ({
  tables,
  career,
  roll,
  kind
}: {
  tables: BenefitTables
  career: string
  roll: number
  kind: BenefitKind
}): CareerBenefit => {
  const key = String(roll)
  if (kind === 'cash') {
    const rawCash = tables.cashBenefits[career]?.[key] ?? 0
    const credits =
      typeof rawCash === 'number' ? rawCash : Number.parseInt(rawCash, 10)
    const resolvedCredits = Number.isFinite(credits) ? credits : 0
    return {
      kind: 'cash',
      value: String(resolvedCredits),
      credits: resolvedCredits
    }
  }

  const value = tables.materialBenefits[career]?.[key] ?? 'Unknown Benefit'
  return {
    kind: 'material',
    value,
    credits: 0
  }
}
