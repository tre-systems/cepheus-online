import type {
  Character,
  Characteristics,
  CombatState,
  NobleTitle,
  Piece,
  Ruleset,
  RulesetTable,
  SkillTableKey,
  Term
} from '@data/types'

interface Equipment {
  Name: string
}

export interface Career {
  name: string
  rank: number
}

const PSEUDO_HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const toHex = (v: number): string => PSEUDO_HEX.charAt(v)
export const fromHex = (v: string): number => PSEUDO_HEX.indexOf(v)

export const isNumeric = (value: string): boolean => /^-?\d+$/.test(value)

const skillTableKeys: SkillTableKey[] = [
  'personalDevelopment',
  'serviceSkills',
  'specialistSkills',
  'advEducation'
]

export const isSkillTableKey = (value: string): value is SkillTableKey =>
  skillTableKeys.includes(value as SkillTableKey)

export const getSkillFromTable = (
  score: number,
  tableName: string,
  career: string,
  ruleset: Ruleset
): string | null => {
  if (!isSkillTableKey(tableName)) return null
  const table = ruleset[tableName][career]
  if (!table) return null
  return table[score.toString()] ?? null
}

export const getModifierForCheck = (
  check: string,
  characteristics: Characteristics
): {target: string; modifier: number} => {
  const [characteristic, targetPlus] = check.split(' ')
  const target = targetPlus.replace('+', '')
  const modifier = characteristicModifier(
    characteristics[characteristic.toLowerCase() as keyof Characteristics]
  )

  return {target, modifier}
}

export const isSuccess = (
  characteristics: Characteristics,
  {check, score}: {check: string; score: number}
): boolean => {
  if (check.includes(' ')) {
    const {target, modifier} = getModifierForCheck(check, characteristics)

    return score + modifier >= +target
  }
  const target = +check.replace('+', '')

  return score >= target
}

export const characteristicModifier = (
  characteristic: number | null | undefined
): number => (characteristic != null ? Math.floor(characteristic / 3) - 2 : 0)

export const updateCharacteristic = (
  characteristics: Characteristics,
  update: string
): Characteristics => {
  const [modifier, characteristic] = update.split(' ')
  const mod =
    modifier.charAt(0) === '+'
      ? +modifier.replace('+', '')
      : -modifier.replace('-', '')
  const key = characteristic.toLowerCase() as keyof Characteristics

  return {
    ...characteristics,
    [key]: (characteristics[key] ?? 0) + mod
  }
}

export const getUppCharacteristics = (
  characteristics: Characteristics
): string => {
  const c = Object.values(characteristics).reduce(
    (a: string, v: number | null | undefined) => a + toHex(v as number),
    ''
  )

  return c === '000000' ? '' : c
}

export const getTitle = (
  character: Character,
  nobleTitle: NobleTitle
): string =>
  character.displayTitle
    ? (nobleTitle[character?.characteristics?.soc as keyof NobleTitle]?.Title[
        character.gender as 'Male' | 'Female'
      ] ?? '')
    : ''

export const displayCharacter = (
  character: Character,
  nobleTitle: NobleTitle | null
): string => {
  const {name, age} = character
  const title = nobleTitle ? getTitle(character, nobleTitle) : ''

  const characteristics = getUppCharacteristics(
    character.characteristics as Characteristics
  )
  const terms = (character?.terms ?? []) as Term[]
  const careers = Object.entries(
    terms
      .map((t: Term) => t.career)
      .filter((career): career is string => Boolean(career))
      .reduce<Record<string, number>>((acc, career) => {
        const termCount = acc[career] ?? 0

        acc[career] = termCount + 1

        return acc
      }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key} (${value} term${value > 1 ? 's' : ''})`)
    .join(', ')

  const equipment = ((character?.equipment ?? []) as Equipment[]).map(
    (i: Equipment) => i.Name
  )

  if (character?.credits) {
    equipment.push(`Cr${character?.credits}`)
  }

  return `${title ? `${title} ` : ''}${name}   ${characteristics}  Age ${age}
${careers}
${getSkills(character).join(', ')}
${equipment.join(', ')}
`
}

export const parseSkill = (skill: string): {name: string; level: string} => ({
  name: skill?.split(/-(?=[^-]+$)/)?.[0],
  level: skill?.split(/-(?=[^-]+$)/)?.[1]
})

export const tallyAndSortSkills = (allSkills: string[]): string[] =>
  Object.entries(
    allSkills
      .slice()
      .filter(s => !isCharMod(s))
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc: Record<string, number>, s) => {
        const {name, level} = parseSkill(s)
        const accLevel = acc[name] ?? 0

        acc[name] = (+level || 0) + accLevel

        return acc
      }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key}-${value}`)

export const getPrimaryEdSkillsSelection = (
  character: Character,
  homeWorldSkillsByLawLevel: Record<string, string>,
  homeWorldSkillsByTradeCode: Record<string, string>,
  primaryEducationSkillsData: string[]
): Array<{name: string; preselected: boolean}> => {
  if (!hasHomeWorld(character)) {
    return []
  }

  const skills = primaryEducationSkillsData.map(name => ({
    name,
    preselected: false
  }))

  const total = totalBackgroundSkills(character)

  const lawLevelSkill = {
    name: homeWorldSkillsByLawLevel[character.homeWorld?.lawLevel ?? ''],
    preselected: total > 1
  }

  const tradeCodeSkill = {
    name: homeWorldSkillsByTradeCode[character.homeWorld?.tradeCodes ?? ''],
    preselected: total > 1
  }

  const primEdSkills = [lawLevelSkill, tradeCodeSkill]

  if (total > 2) {
    primEdSkills.push(
      ...skills.filter(
        ({name}) => name !== lawLevelSkill.name && name !== tradeCodeSkill.name
      )
    )
  }

  return primEdSkills
}

export const cascadeSkillWithLevel = (skill: string, level: number): string =>
  skill.replace('*', `-${level}`)

export const getBackgroundSkills = (
  character: Character,
  homeWorldSkillsByLawLevel: Record<string, string>,
  homeWorldSkillsByTradeCode: Record<string, string>,
  primaryEducationSkillsData: string[]
): {backgroundSkills: string[]; cascadeSkills: string[]} => {
  if (!hasHomeWorld(character)) {
    return {
      backgroundSkills: [],
      cascadeSkills: []
    }
  }

  const primEdSkills = getPrimaryEdSkillsSelection(
    character,
    homeWorldSkillsByLawLevel,
    homeWorldSkillsByTradeCode,
    primaryEducationSkillsData
  )

  const preselectedPrimEdSkillNames = primEdSkills
    .filter(s => s.preselected)
    .map(s => s.name)

  const backgroundSkills = preselectedPrimEdSkillNames
    .filter(s => !isCascade(s))
    .map(s => `${s}-0`)

  const cascadeSkills = preselectedPrimEdSkillNames
    .filter(s => isCascade(s))
    .map(s => cascadeSkillWithLevel(s, 0))

  return {
    backgroundSkills,
    cascadeSkills
  }
}

export const hasPrimaryEducation = (character: Character): boolean =>
  character?.cascadeSkills?.length === 0 &&
  character?.backgroundSkills?.length === totalBackgroundSkills(character)

export const hasCharacteristics = (character: Character): boolean =>
  Object.values(character.characteristics as Characteristics).every(c => !!c)

export const hasHomeWorld = (
  character: Character
): boolean | '' | 0 | undefined =>
  character?.homeWorld?.lawLevel && character?.homeWorld?.tradeCodes

export const totalBackgroundSkills = (character: Character): number =>
  3 + characteristicModifier(character?.characteristics?.edu)

export const isCascade = (skill: string): boolean => skill.includes('*')
export const isCharMod = (i: string): boolean => i.toString().startsWith('+')

export const currentTerm = (character: Character): Term | undefined =>
  character?.terms?.[(character.terms?.length ?? 0) - 1] as Term | undefined

export const isDead = (character: Character): boolean =>
  (character.terms as Term[])?.some(t => t.survival === 0)

export const currentCareerBasics = (
  character: Character,
  careerBasics: RulesetTable
): Record<string, string> | undefined =>
  careerBasics[currentTerm(character)?.career ?? '']

export const currentCareerRanksAndSkills = (
  character: Character,
  ranksAndSkills: RulesetTable
): Record<string, string> | undefined =>
  ranksAndSkills[currentTerm(character)?.career ?? '']

// export const rankName = (career, careerData) => {
//   const rank = careerData?.ranksAndSkills[career.name][career.rank]
//   const rankSplit = rank.split('[')
//   return rankSplit[0].trim()
// }

export const currentRank = (character: Character, career: string): number =>
  (character.careers as Career[])?.find((c: Career) => c.name === career)
    ?.rank ?? 0

export const getRankAndBonusSkill = (
  career: string,
  rank: number,
  ruleset: {ranksAndSkills: RulesetTable}
): {rank: string; bonusSkill: string} => {
  const ranksAndSkills = ruleset.ranksAndSkills[career]

  const rankAndSkill = ranksAndSkills[rank]
  const rankSplit = rankAndSkill.split('[')

  return {
    rank: rankSplit[0].trim(),
    bonusSkill: rankSplit[1]?.replace(']', '')
  }
}

export const canRollCommission = (
  character: Character,
  careerBasics: RulesetTable
): boolean => {
  const term = currentTerm(character)
  const career = currentCareerBasics(character, careerBasics)

  if (!term || !career) {
    return false
  }

  const currentRank = (character?.careers as Career[])?.find(
    (c: Career) => c.name === term?.career
  )?.rank

  return (
    character?.cascadeSkills?.length === 0 &&
    !!term?.survival &&
    !term?.commission?.skipped &&
    !(term?.commission?.roll ?? false) &&
    career['Commission'] !== '-' &&
    currentRank === 0
  )
}

export const canRollAdvancement = (
  character: Character,
  careerBasics: RulesetTable
): boolean => {
  const term = currentTerm(character)
  const career = currentCareerBasics(character, careerBasics)

  if (!term || !career) {
    return false
  }

  const currentRank =
    (character?.careers as Career[])?.find(
      (c: Career) => c.name === term?.career
    )?.rank ?? 0

  return (
    character?.cascadeSkills?.length === 0 &&
    (term?.survival ?? false) &&
    currentRank > 0 &&
    !term?.advancement?.skipped &&
    !(term?.advancement?.roll ?? false)
  )
}

export const advancementComplete = (character: Character): boolean => {
  const term = currentTerm(character)

  if (!term) {
    return false
  }

  if (term?.advancement?.skipped || term?.advancement?.roll === -1) {
    return true
  }

  if (!term?.advancement) {
    return true
  }

  return !!(term?.advancement?.roll && term?.advancement?.skill)
}

export const commissionComplete = (character: Character): boolean => {
  const term = currentTerm(character)

  const currentRank =
    (character?.careers as Career[])?.find(
      (c: Career) => c.name === term?.career
    )?.rank ?? 0

  if (!term) {
    return false
  }

  if (currentRank > 0) {
    return true
  }

  if (term?.commission?.skipped || term?.commission?.roll === -1) {
    return true
  }

  if (!term?.commission) {
    return true
  }

  return !!(term?.commission?.roll && term?.commission?.skill)
}

export const mustAge = (character: Character): boolean =>
  (character.age ?? 0) < 18 + (character.terms?.length ?? 0) * 4

export const anagathicsModifier = (character: Character): number =>
  (character.terms as Term[]).reduce(
    (acc: number, t: Term) => acc + (t.anagathics ?? 0),
    0
  )

export const noOutstandingSelections = (character: Character): boolean =>
  character?.characteristicChanges?.length === 0 &&
  character?.cascadeSkills?.length === 0

type SurvivalOutcome = 'pass' | 'fail'
type PromotionOutcome = 'pass' | 'fail' | 'skip' | 'na'
type ReenlistmentOutcome = 'forced' | 'allowed' | 'blocked' | 'retire'
type ReenlistmentDecision = 'reenlist' | 'leave' | 'na'
type TermOutcomeResult = 'MISHAP' | 'MUSTERING_OUT' | 'NEXT_TERM'

export interface TermOutcome {
  id: string
  survival: SurvivalOutcome
  commission: PromotionOutcome
  advancement: PromotionOutcome
  reenlistment: ReenlistmentOutcome
  decision: ReenlistmentDecision
  result: TermOutcomeResult
}

export const enumerateTermOutcomes = ({
  canCommission = false,
  canAdvance = false,
  canReenlist = true,
  mustRetire = false
}: {
  canCommission?: boolean
  canAdvance?: boolean
  canReenlist?: boolean
  mustRetire?: boolean
}): TermOutcome[] => {
  const outcomes: TermOutcome[] = [
    {
      id: 'survival-fail',
      survival: 'fail',
      commission: 'na',
      advancement: 'na',
      reenlistment: 'blocked',
      decision: 'na',
      result: 'MISHAP'
    }
  ]

  const promotionPaths: Array<{
    commission: PromotionOutcome
    advancement: PromotionOutcome
  }> = []

  if (canCommission) {
    promotionPaths.push(
      ...(['pass', 'fail', 'skip'] as const).map(outcome => ({
        commission: outcome,
        advancement: 'na' as const
      }))
    )
  }

  if (canAdvance) {
    promotionPaths.push(
      ...(['pass', 'fail', 'skip'] as const).map(outcome => ({
        commission: 'na' as const,
        advancement: outcome
      }))
    )
  }

  if (promotionPaths.length === 0) {
    promotionPaths.push({commission: 'na', advancement: 'na'})
  }

  const reenlistmentPaths: Array<{
    reenlistment: ReenlistmentOutcome
    decision: ReenlistmentDecision
    result: TermOutcomeResult
  }> = []

  if (mustRetire) {
    reenlistmentPaths.push({
      reenlistment: 'retire',
      decision: 'leave',
      result: 'MUSTERING_OUT'
    })
  } else if (!canReenlist) {
    reenlistmentPaths.push({
      reenlistment: 'blocked',
      decision: 'na',
      result: 'MUSTERING_OUT'
    })
  } else {
    reenlistmentPaths.push(
      {
        reenlistment: 'forced',
        decision: 'na',
        result: 'NEXT_TERM'
      },
      {
        reenlistment: 'allowed',
        decision: 'reenlist',
        result: 'NEXT_TERM'
      },
      {
        reenlistment: 'allowed',
        decision: 'leave',
        result: 'MUSTERING_OUT'
      },
      {
        reenlistment: 'blocked',
        decision: 'na',
        result: 'MUSTERING_OUT'
      }
    )
  }

  for (const promotion of promotionPaths) {
    for (const reenlistment of reenlistmentPaths) {
      const idParts = [
        'survival-pass',
        `commission-${promotion.commission}`,
        `advancement-${promotion.advancement}`,
        `reenlist-${reenlistment.reenlistment}`,
        `decision-${reenlistment.decision}`
      ]
      outcomes.push({
        id: idParts.join('__'),
        survival: 'pass',
        commission: promotion.commission,
        advancement: promotion.advancement,
        reenlistment: reenlistment.reenlistment,
        decision: reenlistment.decision,
        result: reenlistment.result
      })
    }
  }

  return outcomes
}

export const requireCommissionSkill = (
  character: Character
): boolean | undefined => {
  const term = currentTerm(character)

  if (!term) {
    return false
  }

  return (
    (term?.commission?.roll ?? false) && !(term?.commission?.skill ?? false)
  )
}

export const requireAdvancementSkill = (
  character: Character
): boolean | undefined => {
  const term = currentTerm(character)

  if (!term) {
    return false
  }

  return (
    (term?.advancement?.roll ?? false) && !(term?.advancement?.skill ?? false)
  )
}

export const hasSkillsAndTraining = (
  character: Character,
  careerBasics: RulesetTable
): boolean => {
  const term = currentTerm(character)
  const career = currentCareerBasics(character, careerBasics)

  if (!term) {
    return false
  }

  const skillCount = career?.Commission === '-' ? 2 : 1

  return term?.skillsAndTraining?.length === skillCount
}

export const cashBenefitsForCurrentCareer = (character: Character): number => {
  const term = currentTerm(character)
  if (!term) return 0
  return (character.terms as Term[])
    .filter((t: Term) => t.career === term.career)
    .reduce(
      (acc: number, t: Term) =>
        acc + t.benefits.filter((b: string) => isNumeric(b)).length,
      0
    )
}

export const currentRankIndex = (character: Character): number => {
  const term = currentTerm(character)

  return (
    (character?.careers as Career[])?.find(
      (c: Career) => c.name === term?.career
    )?.rank ?? 0
  )
}

export const hasBenefits = (character: Character): boolean => {
  const term = currentTerm(character)

  if (!term) {
    return false
  }

  const termsInCareer = (character.terms as Term[]).filter(
    (t: Term) => t.career === term.career
  ).length

  const benefitsReceived = (character.terms as Term[]).reduce(
    (acc: number, t: Term) =>
      t.career === term.career ? acc + t.benefits.length : acc,
    0
  )

  const currentRank = currentRankIndex(character)

  const rankBonus = currentRank > 3 ? currentRank - 3 : 0

  const numberOfBenefits = termsInCareer + rankBonus

  return benefitsReceived === numberOfBenefits
}

export const getSkills = (character: Character): string[] =>
  tallyAndSortSkills([
    ...(character.backgroundSkills ?? []),
    ...(character.skills ?? []),
    ...((character.terms as Term[]) ?? []).reduce(
      (acc: string[], t: Term) => [...acc, ...(t.skills ?? [])],
      [] as string[]
    )
  ])

export const hasSkill = (character: Character, skillName: string): boolean =>
  !!getSkills(character).find(s => s.startsWith(skillName))

export const getHeath = (
  characteristics: Characteristics | null | undefined
): number =>
  (characteristics?.str ?? 0) +
  (characteristics?.dex ?? 0) +
  (characteristics?.end ?? 0)

export const getDamageLevel = (
  character: Character,
  combatState: CombatState | null | undefined
): number => {
  const fullHealth = getHeath(character?.characteristics as Characteristics)

  const currentHealth = getHeath(combatState?.characteristics)
  const damage = 1 - currentHealth / fullHealth

  return damage > 0 ? damage : 0
}

export const getCurrentInitiative = (
  character: Character,
  pieces: Record<string, Piece> | undefined
): number | undefined => {
  const anyConscious = pieces
    ? Object.values(pieces)?.some(piece => !piece?.unconscious)
    : true

  if (!anyConscious || !character?.initiative) {
    return undefined
  }
  let mod = 0

  if (character?.haste) {
    mod = 2
  }

  return character?.initiative + mod - (character?.reactions ?? 0) * 2
}
