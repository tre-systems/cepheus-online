import {
  formatCareerSkill,
  isCascadeCareerSkill,
  parseCareerSkill
} from './skills'
import type {
  CareerCreationTermSkillFact,
  CareerTerm,
  CareerCreationTermSkillTable
} from './types'

export interface CareerTermSkillRollSummary {
  table: CareerCreationTermSkillTable
  roll: number
  skill: string
}

const uniqueSkills = (skills: readonly string[]): string[] => {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const skill of skills) {
    if (seen.has(skill)) continue
    seen.add(skill)
    unique.push(skill)
  }
  return unique
}

export const hasProjectedCareerTermFacts = (
  term: Pick<CareerTerm, 'facts'>
): boolean => term.facts !== undefined

export const resolveCareerTermCascadeSkill = (
  term: Pick<CareerTerm, 'facts'>,
  cascadeSkill: string | null
): string | null => {
  if (!cascadeSkill) return null

  let current = cascadeSkill
  const visited = new Set<string>()

  while (!visited.has(current)) {
    visited.add(current)
    const selection = term.facts?.termCascadeSelections?.find(
      (entry) => entry.cascadeSkill === current
    )?.selection

    if (!selection) return null
    if (isCascadeCareerSkill(selection)) {
      const level = parseCareerSkill(current)?.level ?? 0
      current = selection.trim().replace('*', `-${level}`)
      continue
    }

    return formatCareerSkill({
      name: selection.trim(),
      level: parseCareerSkill(current)?.level ?? 0
    })
  }

  return null
}

export const deriveCareerTermSkillFactValue = (
  term: Pick<CareerTerm, 'facts'>,
  termSkill: CareerCreationTermSkillFact,
  {
    includePendingCascade = false,
    includeCharacteristicGain = false
  }: {
    includePendingCascade?: boolean
    includeCharacteristicGain?: boolean
  } = {}
): string | null => {
  if (termSkill.skill) return termSkill.skill
  const resolvedCascade = resolveCareerTermCascadeSkill(
    term,
    termSkill.pendingCascadeSkill
  )
  if (resolvedCascade) return resolvedCascade
  if (includePendingCascade && termSkill.pendingCascadeSkill) {
    return termSkill.pendingCascadeSkill
  }
  if (includeCharacteristicGain && termSkill.characteristic) {
    return termSkill.rawSkill
  }
  return null
}

export const deriveCareerTermSkillRollSummaries = (
  term: Pick<CareerTerm, 'facts'>
): CareerTermSkillRollSummary[] =>
  (term.facts?.termSkillRolls ?? []).map((termSkill) => ({
    table: termSkill.table,
    roll: termSkill.roll.total,
    skill:
      deriveCareerTermSkillFactValue(term, termSkill, {
        includePendingCascade: true,
        includeCharacteristicGain: true
      }) ?? termSkill.rawSkill
  }))

export const deriveCareerTermSkillFactValues = (
  term: Pick<CareerTerm, 'facts'>,
  options: {
    includePendingCascade?: boolean
    includeCharacteristicGain?: boolean
  } = {}
): string[] =>
  uniqueSkills(
    (term.facts?.termSkillRolls ?? []).flatMap((termSkill) => {
      const skill = deriveCareerTermSkillFactValue(term, termSkill, options)
      return skill ? [skill] : []
    })
  )

export const deriveCareerTermTrainingSkillsFromFacts = (
  term: Pick<CareerTerm, 'facts'>,
  options: {
    includePendingCascade?: boolean
    includeCharacteristicGain?: boolean
  } = {}
): string[] =>
  uniqueSkills([
    ...(term.facts?.basicTrainingSkills ?? []),
    ...deriveCareerTermSkillFactValues(term, options)
  ])
