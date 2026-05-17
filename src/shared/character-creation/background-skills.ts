import { characteristicModifier } from './career-rules'
import {
  careerSkillWithLevel,
  formatCareerSkill,
  isCascadeCareerSkill
} from './skills'

export interface BackgroundHomeworld {
  lawLevel?: string | null
  tradeCodes?: string | readonly string[] | null
}

export interface BackgroundSkillRules {
  homeWorldSkillsByLawLevel: Record<string, string>
  homeWorldSkillsByTradeCode: Record<string, string>
  primaryEducationSkillsData: readonly string[]
}

export interface PrimaryEducationSkillOption {
  name: string
  preselected: boolean
}

export interface BackgroundSkillPlan {
  backgroundSkills: string[]
  pendingCascadeSkills: string[]
}

export const deriveTotalBackgroundSkillAllowance = (
  edu: number | null | undefined
): number => 3 + characteristicModifier(edu)

export const hasBackgroundHomeworld = (
  homeworld: BackgroundHomeworld | null | undefined
): boolean =>
  Boolean(homeworld?.lawLevel && normalizeTradeCodes(homeworld).length > 0)

export const deriveHomeworldBackgroundSkillNames = ({
  homeworld,
  rules
}: {
  homeworld: BackgroundHomeworld | null | undefined
  rules: Pick<
    BackgroundSkillRules,
    'homeWorldSkillsByLawLevel' | 'homeWorldSkillsByTradeCode'
  >
}): string[] => {
  if (!homeworld) return []

  const skills: string[] = []
  const lawLevelSkill =
    rules.homeWorldSkillsByLawLevel[homeworld.lawLevel ?? '']

  if (lawLevelSkill) skills.push(lawLevelSkill)

  for (const tradeCode of normalizeTradeCodes(homeworld)) {
    const tradeCodeSkill = rules.homeWorldSkillsByTradeCode[tradeCode]
    if (tradeCodeSkill) skills.push(tradeCodeSkill)
  }

  return uniqueSkills(skills)
}

export const derivePrimaryEducationSkillOptions = ({
  edu,
  homeworld,
  rules
}: {
  edu: number | null | undefined
  homeworld: BackgroundHomeworld | null | undefined
  rules: BackgroundSkillRules
}): PrimaryEducationSkillOption[] => {
  if (!hasBackgroundHomeworld(homeworld)) return []

  const allowance = deriveTotalBackgroundSkillAllowance(edu)
  const homeworldSkills =
    allowance > 1
      ? deriveHomeworldBackgroundSkillNames({ homeworld, rules })
      : []

  const options = homeworldSkills.map((name) => ({
    name,
    preselected: true
  }))

  if (allowance > homeworldSkills.length) {
    const preselected = new Set(homeworldSkills)

    options.push(
      ...rules.primaryEducationSkillsData
        .filter((name) => !preselected.has(name))
        .map((name) => ({ name, preselected: false }))
    )
  }

  return options
}

export const deriveBackgroundSkillPlan = ({
  edu,
  homeworld,
  rules
}: {
  edu: number | null | undefined
  homeworld: BackgroundHomeworld | null | undefined
  rules: BackgroundSkillRules
}): BackgroundSkillPlan => {
  const preselectedSkillNames = derivePrimaryEducationSkillOptions({
    edu,
    homeworld,
    rules
  })
    .filter((skill) => skill.preselected)
    .map((skill) => skill.name)

  return {
    backgroundSkills: preselectedSkillNames
      .filter((skill) => !isCascadeCareerSkill(skill))
      .map((skill) => formatCareerSkill({ name: skill, level: 0 })),
    pendingCascadeSkills: preselectedSkillNames
      .filter(isCascadeCareerSkill)
      .map((skill) => careerSkillWithLevel(skill, 0))
  }
}

const normalizeTradeCodes = (
  homeworld: BackgroundHomeworld | null | undefined
): string[] => {
  const tradeCodes = homeworld?.tradeCodes
  if (!tradeCodes) return []

  return typeof tradeCodes === 'string' ? [tradeCodes] : [...tradeCodes]
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
