import type { CharacterCreationProjection } from '../../../shared/state'

export const deriveProjectedCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => {
  let projectedRank: number | null = null
  for (const term of creation.terms) {
    if (term.career !== career) continue
    const advancement = term.facts?.advancement
    if (
      advancement &&
      !advancement.skipped &&
      advancement.rank?.career === career
    ) {
      projectedRank = advancement.rank.newRank
    }
  }

  return (
    projectedRank ??
    creation.careers.find((entry) => entry.name === career)?.rank ??
    0
  )
}

export const uniqueSkills = (skills: readonly string[]): string[] => {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const skill of skills) {
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(skill)
  }

  return unique
}
