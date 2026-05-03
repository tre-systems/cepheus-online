import type { CareerSkill, CascadeSkillResolution } from './types'

export const isCascadeCareerSkill = (skill: string): boolean =>
  skill.includes('*')

export const formatCareerSkill = ({ name, level }: CareerSkill): string =>
  `${name}-${level}`

export const parseCareerSkill = (skill: string): CareerSkill | null => {
  const trimmed = skill.trim()
  if (!trimmed) return null

  const parsed = /^(.*?)-(-?\d+)$/.exec(trimmed)
  if (!parsed) return { name: trimmed, level: 0 }

  const name = parsed[1].trim()
  if (!name) return null

  return {
    name,
    level: Number(parsed[2])
  }
}

export const careerSkillWithLevel = (
  skill: string,
  level: number
): string => skill.trim().replace('*', `-${level}`)

export const normalizeCareerSkill = (
  skill: string,
  defaultLevel = 1
): string | null => {
  const trimmed = skill.trim()
  if (!trimmed) return null

  if (isCascadeCareerSkill(trimmed)) {
    return careerSkillWithLevel(trimmed, defaultLevel)
  }

  const parsed = parseCareerSkill(trimmed)
  if (!parsed) return null

  return formatCareerSkill({
    name: parsed.name,
    level: /-(-?\d+)$/.test(trimmed) ? parsed.level : defaultLevel
  })
}

export const tallyCareerSkills = (skills: readonly string[]): string[] => {
  const totals = new Map<string, number>()

  for (const skill of skills) {
    if (isCascadeCareerSkill(skill)) continue
    const parsed = parseCareerSkill(skill)
    if (!parsed) continue
    totals.set(parsed.name, (totals.get(parsed.name) ?? 0) + parsed.level)
  }

  return [...totals.entries()]
    .sort(([leftName, leftLevel], [rightName, rightLevel]) => {
      if (rightLevel !== leftLevel) return rightLevel - leftLevel
      return leftName.localeCompare(rightName)
    })
    .map(([name, level]) => formatCareerSkill({ name, level }))
}

export const resolveCascadeCareerSkill = ({
  pendingCascadeSkills,
  backgroundSkills = [],
  careerSkills = [],
  termSkills = [],
  cascadeSkill,
  selection,
  basicTraining = false
}: {
  pendingCascadeSkills: readonly string[]
  backgroundSkills?: readonly string[]
  careerSkills?: readonly string[]
  termSkills?: readonly string[]
  cascadeSkill: string
  selection: string
  basicTraining?: boolean
}): CascadeSkillResolution => {
  const remaining = pendingCascadeSkills.filter((skill) => skill !== cascadeSkill)
  const parsed = parseCareerSkill(cascadeSkill)
  const level = parsed?.level ?? 0

  if (isCascadeCareerSkill(selection)) {
    return {
      pendingCascadeSkills: [...remaining, careerSkillWithLevel(selection, level)],
      backgroundSkills: [...backgroundSkills],
      careerSkills: [...careerSkills],
      termSkills: [...termSkills]
    }
  }

  const resolvedSkill = formatCareerSkill({
    name: selection.trim(),
    level
  })

  return {
    pendingCascadeSkills: remaining,
    backgroundSkills: basicTraining
      ? [...backgroundSkills, resolvedSkill]
      : [...backgroundSkills],
    careerSkills: basicTraining
      ? [...careerSkills]
      : [...careerSkills, resolvedSkill],
    termSkills: [...termSkills, resolvedSkill]
  }
}
