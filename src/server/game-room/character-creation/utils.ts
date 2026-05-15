import type { CharacterCreationProjection } from '../../../shared/state'

export const deriveProjectedCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => {
  let projectedRank: number | null = null
  let hasProjectedCareerFacts = false
  for (const term of creation.terms) {
    if (term.career !== career) continue
    hasProjectedCareerFacts =
      hasProjectedCareerFacts || Object.keys(term.facts ?? {}).length > 0
    const advancement = term.facts?.advancement
    if (
      advancement &&
      !advancement.skipped &&
      advancement.rank?.career === career
    ) {
      projectedRank = advancement.rank.newRank
    }
  }

  if (hasProjectedCareerFacts) return projectedRank ?? 0

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
