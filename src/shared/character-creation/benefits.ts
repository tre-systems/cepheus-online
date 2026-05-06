import type { BenefitKind, BenefitTables, CareerBenefit } from './types'

export const deriveCareerBenefitCount = ({
  termsInCareer,
  currentRank
}: {
  termsInCareer: number
  currentRank: number
}): number =>
  termsInCareer + Math.min(3, Math.ceil(Math.max(0, currentRank) / 2))

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

export const deriveCashBenefitRollModifier = ({
  retired = false,
  hasGambling = false
}: {
  retired?: boolean
  hasGambling?: boolean
}): number => Number(retired) + Number(hasGambling)

export const deriveMaterialBenefitRollModifier = ({
  currentRank
}: {
  currentRank: number
}): number => (currentRank > 4 ? 1 : 0)

const clampedBenefitRoll = (
  table: Record<string, unknown> | undefined,
  roll: number
): string => {
  const rolls = Object.keys(table ?? {})
    .map((key) => Number(key))
    .filter(Number.isFinite)
  if (rolls.length === 0) return String(roll)
  return String(Math.max(Math.min(...rolls), Math.min(Math.max(...rolls), roll)))
}

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
  if (kind === 'cash') {
    const table = tables.cashBenefits[career]
    const rawCash = table?.[clampedBenefitRoll(table, roll)] ?? 0
    const credits =
      typeof rawCash === 'number' ? rawCash : Number.parseInt(rawCash, 10)
    const resolvedCredits = Number.isFinite(credits) ? credits : 0
    return {
      kind: 'cash',
      value: String(resolvedCredits),
      credits: resolvedCredits
    }
  }

  const table = tables.materialBenefits[career]
  const value =
    table?.[clampedBenefitRoll(table, roll)] ?? 'Unknown Benefit'
  return {
    kind: 'material',
    value,
    credits: 0
  }
}
