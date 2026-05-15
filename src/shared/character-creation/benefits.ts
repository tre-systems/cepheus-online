import type { CharacteristicKey } from '../state'
import type {
  BenefitKind,
  BenefitTables,
  CareerBenefit,
  CareerTerm
} from './types'

export const CEPHEUS_SRD_MAX_CASH_BENEFITS = 3

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

const hasSemanticTermFacts = (term: Pick<CareerTerm, 'facts'>): boolean =>
  Object.keys(term.facts ?? {}).length > 0

export const deriveCareerTermMusteringBenefitCount = (
  term: Pick<CareerTerm, 'benefits' | 'facts'>
): number =>
  hasSemanticTermFacts(term)
    ? deriveProjectedCareerTermMusteringBenefitCount(term)
    : deriveLegacyCareerTermMusteringBenefitCount(term)

export const deriveCareerTermCashBenefitCount = (
  term: Pick<CareerTerm, 'benefits' | 'facts'>
): number =>
  hasSemanticTermFacts(term)
    ? deriveProjectedCareerTermCashBenefitCount(term)
    : deriveLegacyCareerTermCashBenefitCount(term)

const careerTermBenefitEffect = (
  term: Pick<CareerTerm, 'facts'>
): 'forfeit_current_term' | 'lose_all' | null =>
  term.facts?.mishap?.outcome.benefitEffect ?? null

export const deriveCareerBenefitEligibleTermCount = ({
  terms,
  career
}: {
  terms: readonly Pick<CareerTerm, 'career' | 'facts'>[]
  career: string
}): number => {
  const careerTerms = terms.filter((term) => term.career === career)
  if (
    careerTerms.some((term) => careerTermBenefitEffect(term) === 'lose_all')
  ) {
    return 0
  }

  return careerTerms.filter(
    (term) => careerTermBenefitEffect(term) !== 'forfeit_current_term'
  ).length
}

export const deriveCareerBenefitsReceivedCount = ({
  terms,
  career
}: {
  terms: readonly Pick<CareerTerm, 'career' | 'benefits' | 'facts'>[]
  career: string
}): number =>
  terms
    .filter((term) => term.career === career)
    .reduce(
      (total, term) => total + deriveCareerTermMusteringBenefitCount(term),
      0
    )

export const deriveRemainingCareerBenefitsForCareer = ({
  terms,
  career,
  currentRank
}: {
  terms: readonly Pick<CareerTerm, 'career' | 'benefits' | 'facts'>[]
  career: string
  currentRank: number
}): number => {
  const eligibleTerms = deriveCareerBenefitEligibleTermCount({ terms, career })
  if (eligibleTerms <= 0) return 0

  return Math.max(
    0,
    deriveCareerBenefitCount({
      termsInCareer: eligibleTerms,
      currentRank
    }) - deriveCareerBenefitsReceivedCount({ terms, career })
  )
}

export const deriveProjectedCareerTermMusteringBenefitCount = (
  term: Pick<CareerTerm, 'facts'>
): number => term.facts?.musteringBenefits?.length ?? 0

export const deriveProjectedCareerTermCashBenefitCount = (
  term: Pick<CareerTerm, 'facts'>
): number =>
  term.facts?.musteringBenefits?.filter((benefit) => benefit.kind === 'cash')
    .length ?? 0

export const deriveLegacyCareerTermMusteringBenefitCount = (
  term: Pick<CareerTerm, 'benefits'>
): number => term.benefits.length

export const deriveLegacyCareerTermCashBenefitCount = (
  term: Pick<CareerTerm, 'benefits'>
): number =>
  term.benefits.filter((benefit) => /^\d+$/.test(benefit.trim())).length

export const deriveRemainingCashBenefits = ({
  cashBenefitsReceived,
  maxCashBenefits = CEPHEUS_SRD_MAX_CASH_BENEFITS
}: {
  cashBenefitsReceived: number
  maxCashBenefits?: number
}): number =>
  Math.max(0, Math.max(0, maxCashBenefits) - Math.max(0, cashBenefitsReceived))

export const canRollCashBenefit = ({
  cashBenefitsReceived,
  maxCashBenefits = CEPHEUS_SRD_MAX_CASH_BENEFITS
}: {
  cashBenefitsReceived: number
  maxCashBenefits?: number
}): boolean =>
  deriveRemainingCashBenefits({ cashBenefitsReceived, maxCashBenefits }) > 0

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

export type MaterialBenefitEffect =
  | { kind: 'none' }
  | {
      kind: 'characteristic'
      characteristic: CharacteristicKey
      modifier: number
    }
  | { kind: 'equipment'; item: string }

const characteristicLabels: Record<string, CharacteristicKey> = {
  str: 'str',
  dex: 'dex',
  end: 'end',
  int: 'int',
  edu: 'edu',
  soc: 'soc'
}

export const normalizeMaterialBenefitValue = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

export const deriveMaterialBenefitEffect = (
  value: string
): MaterialBenefitEffect => {
  const normalized = normalizeMaterialBenefitValue(value)
  if (!normalized || normalized === '-') return { kind: 'none' }

  const characteristicMatch = /^\+(\d+)\s+(str|dex|end|int|edu|soc)$/i.exec(
    normalized
  )
  if (characteristicMatch) {
    const modifier = Number.parseInt(characteristicMatch[1] ?? '', 10)
    const characteristic =
      characteristicLabels[characteristicMatch[2]?.toLowerCase() ?? '']
    if (Number.isFinite(modifier) && characteristic) {
      return { kind: 'characteristic', characteristic, modifier }
    }
  }

  return { kind: 'equipment', item: normalized }
}

const clampedBenefitRoll = (
  table: Record<string, unknown> | undefined,
  roll: number
): string => {
  const rolls = Object.keys(table ?? {})
    .map((key) => Number(key))
    .filter(Number.isFinite)
  if (rolls.length === 0) return String(roll)
  return String(
    Math.max(Math.min(...rolls), Math.min(Math.max(...rolls), roll))
  )
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
  const value = normalizeMaterialBenefitValue(
    table?.[clampedBenefitRoll(table, roll)] ?? 'Unknown Benefit'
  )
  return {
    kind: 'material',
    value,
    credits: 0
  }
}
