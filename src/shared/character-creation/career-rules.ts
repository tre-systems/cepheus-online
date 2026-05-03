import type { CharacterCharacteristics, CharacteristicKey } from '../state'
import type { BasicTrainingPlan, CareerBasics, CareerBasicsTable, CareerCheck, CareerRollOutcome, CareerSkillTable, SurvivalPromotionOptions } from './types'

export const characteristicModifier = (
  characteristic: number | null | undefined
): number => (characteristic == null ? 0 : Math.floor(characteristic / 3) - 2)

export const parseCareerCheck = (check: string): CareerCheck | null => {
  const trimmed = check.trim()
  if (!trimmed || trimmed === '-') return null

  const plainTarget = /^(\d+)\+$/.exec(trimmed)
  if (plainTarget) {
    return { characteristic: null, target: Number(plainTarget[1]) }
  }

  const characteristicTarget =
    /^(Str|Dex|End|Int|Edu|Soc)\s+(\d+)\+$/i.exec(trimmed)
  if (!characteristicTarget) return null

  return {
    characteristic: characteristicTarget[1].toLowerCase() as CharacteristicKey,
    target: Number(characteristicTarget[2])
  }
}

export const evaluateCareerCheck = ({
  check,
  characteristics,
  roll,
  dm = 0
}: {
  check: string
  characteristics: Partial<CharacterCharacteristics>
  roll: number
  dm?: number
}): CareerRollOutcome | null => {
  const parsed = parseCareerCheck(check)
  if (!parsed) return null

  const modifier =
    dm +
    (parsed.characteristic
      ? characteristicModifier(characteristics[parsed.characteristic])
      : 0)
  const total = roll + modifier

  return {
    check: parsed,
    modifier,
    total,
    success: total >= parsed.target
  }
}

export const deriveCareerQualificationDm = (
  previousCareerCount: number
): number => (previousCareerCount > 0 ? previousCareerCount * -2 : 0)

export const availableCareerNames = (
  careerBasics: CareerBasicsTable,
  servedCareerNames: readonly string[] = []
): string[] => {
  const unavailable = new Set(
    servedCareerNames.filter((career) => career !== 'Drifter')
  )

  return Object.keys(careerBasics).filter((career) => !unavailable.has(career))
}

export const deriveBasicTrainingPlan = ({
  career,
  serviceSkills,
  completedTermCount,
  previousCareerNames
}: {
  career: string
  serviceSkills: CareerSkillTable
  completedTermCount: number
  previousCareerNames: readonly string[]
}): BasicTrainingPlan => {
  const skills = Object.values(serviceSkills[career] ?? {})
  if (skills.length === 0) return { kind: 'none', skills: [] }

  if (completedTermCount === 0) {
    return { kind: 'all', skills }
  }

  const careerTerms = previousCareerNames.filter((name) => name === career)
  return careerTerms.length === 0
    ? { kind: 'choose-one', skills }
    : { kind: 'none', skills: [] }
}

export const deriveSurvivalPromotionOptions = (
  careerBasics: Pick<CareerBasics, 'Commission' | 'Advancement'>,
  currentRank: number
): SurvivalPromotionOptions => ({
  canCommission: currentRank === 0 && careerBasics.Commission !== '-',
  canAdvance: currentRank > 0 && careerBasics.Advancement !== '-'
})
