import type {
  CharacterCharacteristics,
  CharacterCreationProjection,
  CharacterEquipmentItem,
  CharacterState,
  CharacteristicKey
} from '../../../../shared/state'
import type {
  CareerCreationCheckFact,
  CareerTerm
} from '../../../../shared/characterCreation'
import {
  deriveMaterialBenefitEffect,
  parseCareerSkill
} from '../../../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../../../shared/character-creation/cepheus-srd-ruleset'

const uppCharacteristicOrder: CharacteristicKey[] = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
]

const uppDigits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const formatUppCharacteristic = (
  value: number | null | undefined
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '?'
  }
  const normalized = Math.trunc(value)
  if (normalized < 0) return '?'
  return uppDigits[normalized] ?? '?'
}

export const deriveCharacterUpp = (
  characteristics: Partial<CharacterCharacteristics> | null | undefined
): string =>
  uppCharacteristicOrder
    .map((key) => formatUppCharacteristic(characteristics?.[key]))
    .join('')

const characteristicLabels: Record<CharacteristicKey, string> = {
  str: 'Str',
  dex: 'Dex',
  end: 'End',
  int: 'Int',
  edu: 'Edu',
  soc: 'Soc'
}

const characteristicModifier = (
  value: number | null | undefined
): number | null =>
  value === null || value === undefined || !Number.isFinite(value)
    ? null
    : Math.floor(value / 3) - 2

const formatModifier = (modifier: number | null): string =>
  modifier === null || modifier === 0
    ? ''
    : modifier > 0
      ? `+${modifier}`
      : String(modifier)

const formatSignedModifier = (modifier: number): string =>
  modifier > 0 ? `+${modifier}` : String(modifier)

export const deriveCharacteristicExportLine = (
  characteristics: Partial<CharacterCharacteristics> | null | undefined
): string =>
  uppCharacteristicOrder
    .map((key) => {
      const value = characteristics?.[key]
      const modifier = characteristicModifier(value)
      const valueText =
        value === null || value === undefined || !Number.isFinite(value)
          ? '?'
          : String(Math.trunc(value))
      const modifierText = formatModifier(modifier)
      return `${characteristicLabels[key]} ${valueText}${modifierText ? ` (${modifierText})` : ''}`
    })
    .join(', ')

export const isCharacterCreationFinal = (
  character: Pick<CharacterState, 'creation'> | null | undefined
): boolean =>
  character?.creation?.creationComplete === true ||
  character?.creation?.state.status === 'PLAYABLE'

const listValue = (items: readonly string[]): string =>
  items.length > 0 ? items.join(', ') : 'None'

export const sortSkillsForExport = (skills: readonly string[]): string[] =>
  [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))].sort(
    (left, right) => {
      const leftSkill = parseCareerSkill(left)
      const rightSkill = parseCareerSkill(right)
      const leftLevel = leftSkill?.level ?? 0
      const rightLevel = rightSkill?.level ?? 0
      if (rightLevel !== leftLevel) return rightLevel - leftLevel
      return (leftSkill?.name ?? left).localeCompare(rightSkill?.name ?? right)
    }
  )

const equipmentValue = (
  equipment: readonly CharacterEquipmentItem[] | null | undefined
): string => {
  if (!equipment || equipment.length === 0) return 'None'

  return equipment
    .map((item) => {
      const quantity = Math.max(1, item.quantity)
      return `${item.name} x${quantity}${item.notes ? ` (${item.notes})` : ''}`
    })
    .join('; ')
}

const skillBaseName = (skill: string): string =>
  (parseCareerSkill(skill)?.name ?? skill.replace(/-\d+$/, '')).trim()

const sourceSkillName = (skill: string): string =>
  skill.replace(/\*$/, '').trim()

const sourceSkillMatches = (
  sourceSkill: string,
  characterSkill: string
): boolean => {
  const sourceName = sourceSkillName(sourceSkill)
  const skillName = skillBaseName(characterSkill)
  if (sourceName === skillName) return true
  return (
    CEPHEUS_SRD_RULESET.cascadeSkills[sourceName]?.includes(skillName) ?? false
  )
}

const backgroundSkillSourceValue = (
  creation: CharacterCreationProjection | null | undefined
): string | null => {
  const skills = creation?.backgroundSkills ?? []
  if (skills.length === 0) return null

  const homeworld = creation?.homeworld
  const lawSkill = homeworld?.lawLevel
    ? CEPHEUS_SRD_RULESET.homeWorldSkillsByLawLevel[homeworld.lawLevel]
    : null
  const tradeSkillSources = (homeworld?.tradeCodes ?? [])
    .map((tradeCode) => ({
      tradeCode,
      skill: CEPHEUS_SRD_RULESET.homeWorldSkillsByTradeCode[tradeCode]
    }))
    .filter((entry): entry is { tradeCode: string; skill: string } =>
      Boolean(entry.skill)
    )

  return skills
    .map((skill) => {
      const sources: string[] = []
      if (lawSkill && sourceSkillMatches(lawSkill, skill)) {
        sources.push(`law ${homeworld?.lawLevel}`)
      }
      for (const { tradeCode, skill: tradeSkill } of tradeSkillSources) {
        if (sourceSkillMatches(tradeSkill, skill)) {
          sources.push(`trade ${tradeCode}`)
        }
      }
      if (sources.length === 0) sources.push('primary education')
      return `${skill} (${sources.join(', ')})`
    })
    .join(', ')
}

const careerRankTitles = (
  creation: CharacterCreationProjection | null | undefined
): Map<string, string> => {
  const titles = new Map<string, string>()
  for (const term of creation?.terms ?? []) {
    const advancement = term.facts?.advancement
    const rank = advancement && !advancement.skipped ? advancement.rank : null
    if (rank?.title) titles.set(rank.career, rank.title)
  }
  return titles
}

const careerValue = (
  creation: CharacterCreationProjection | null | undefined
): string => {
  if (!creation || creation.careers.length === 0) return 'None'

  const titles = careerRankTitles(creation)
  return creation.careers
    .map((career) => {
      const title = titles.get(career.name)
      return `${career.name} rank ${career.rank}${title ? ` (${title})` : ''}`
    })
    .join('; ')
}

const formatCheckFact = (
  label: string,
  passed: boolean,
  check: CareerCreationCheckFact
): string => {
  const characteristic = check.characteristic
    ? `${characteristicLabels[check.characteristic]} `
    : ''
  return `${label} ${passed ? 'passed' : 'failed'} ${check.total} vs ${check.target} (${characteristic}DM ${formatSignedModifier(check.modifier)})`
}

const qualificationValue = (
  qualification: NonNullable<CareerTerm['facts']>['qualification']
): string | null => {
  if (!qualification) return null
  const previousCareerText =
    qualification.previousCareerCount > 0
      ? `, previous career DM ${formatSignedModifier(-2 * qualification.previousCareerCount)}`
      : ''
  return `${formatCheckFact('qualification', qualification.passed, qualification.qualification)}${previousCareerText}`
}

const termSkillValue = (term: CareerTerm): string | null => {
  const skills = sortSkillsForExport([
    ...term.skills,
    ...term.skillsAndTraining,
    ...(term.facts?.basicTrainingSkills ?? [])
  ])
  return skills.length > 0 ? `skills ${listValue(skills)}` : null
}

const termSkillTableLabels: Record<string, string> = {
  personalDevelopment: 'personal development',
  serviceSkills: 'service skills',
  specialistSkills: 'specialist skills',
  advancedEducation: 'advanced education'
}

const formatTermSkillFactResult = (
  roll: NonNullable<NonNullable<CareerTerm['facts']>['termSkillRolls']>[number]
): string => {
  if (roll.skill) return roll.skill
  if (roll.characteristic) {
    return `${characteristicLabels[roll.characteristic.key]} ${formatSignedModifier(roll.characteristic.modifier)}`
  }
  if (roll.pendingCascadeSkill) {
    return `${roll.rawSkill} -> ${roll.pendingCascadeSkill}`
  }
  return roll.rawSkill
}

const basicTrainingValue = (term: CareerTerm): string | null => {
  const skills = sortSkillsForExport(term.facts?.basicTrainingSkills ?? [])
  return skills.length > 0 ? `basic training ${listValue(skills)}` : null
}

const termSkillRollValue = (term: CareerTerm): string | null => {
  const rolls = term.facts?.termSkillRolls ?? []
  if (rolls.length === 0) return null

  return `term skills ${rolls
    .map((roll) => {
      const table = termSkillTableLabels[roll.table] ?? roll.table
      const rolled =
        roll.roll.total === roll.tableRoll
          ? `roll ${roll.roll.total}`
          : `roll ${roll.roll.total} = table ${roll.tableRoll}`
      return `${table} ${rolled}: ${formatTermSkillFactResult(roll)}`
    })
    .join(', ')}`
}

const termCascadeSelectionValue = (term: CareerTerm): string | null => {
  const selections = term.facts?.termCascadeSelections ?? []
  if (selections.length === 0) return null

  return `cascade choices ${selections
    .map((selection) => `${selection.cascadeSkill} -> ${selection.selection}`)
    .join(', ')}`
}

const termBenefitValue = (term: CareerTerm): string | null => {
  const benefits = term.facts?.musteringBenefits
  if (benefits && benefits.length > 0) {
    return `benefits ${benefits
      .map((benefit) => {
        const roll =
          benefit.modifier === 0
            ? `roll ${benefit.roll.total}`
            : `roll ${benefit.roll.total} ${formatSignedModifier(benefit.modifier)} DM = table ${benefit.tableRoll}`
        if (benefit.kind === 'cash') return `Cr${benefit.credits} (${roll})`

        const effect = deriveMaterialBenefitEffect(benefit.value)
        const value =
          effect.kind === 'none'
            ? 'No material benefit'
            : effect.kind === 'characteristic'
              ? `${characteristicLabels[effect.characteristic]} ${formatSignedModifier(effect.modifier)}`
              : effect.item
        return `${value} (${roll})`
      })
      .join(', ')}`
  }
  return term.benefits.length > 0
    ? `benefits ${listValue(term.benefits)}`
    : null
}

const agingChangeValue = (
  change: NonNullable<
    NonNullable<CareerTerm['facts']>['aging']
  >['characteristicChanges'][number]
): string =>
  `${change.type.toLowerCase()} ${formatSignedModifier(change.modifier)}`

const agingLossValue = (
  loss: NonNullable<
    NonNullable<CareerTerm['facts']>['agingLosses']
  >['selectedLosses'][number]
): string =>
  `${characteristicLabels[loss.characteristic]} ${formatSignedModifier(loss.modifier)} (${loss.type.toLowerCase()})`

const termHistoryLine = (term: CareerTerm, index: number): string => {
  const facts = term.facts
  const parts: string[] = []
  if (term.draft === 1 && facts?.draft) {
    parts.push(
      `drafted ${facts.draft.acceptedCareer} from table ${facts.draft.tableRoll} (roll ${facts.draft.roll.total})`
    )
  } else if (facts?.qualification) {
    const qualification = qualificationValue(facts.qualification)
    if (qualification) parts.push(qualification)
  }
  if (facts?.survival) {
    parts.push(
      formatCheckFact(
        'survival',
        facts.survival.passed,
        facts.survival.survival
      )
    )
  } else if (term.survival != null) {
    parts.push(`survival ${term.survival}`)
  }
  if (facts?.commission) {
    parts.push(
      facts.commission.skipped
        ? 'commission skipped'
        : formatCheckFact(
            'commission',
            facts.commission.passed,
            facts.commission.commission
          )
    )
  }
  if (facts?.advancement) {
    parts.push(
      facts.advancement.skipped
        ? 'advancement skipped'
        : `${formatCheckFact(
            'advancement',
            facts.advancement.passed,
            facts.advancement.advancement
          )}${
            facts.advancement.rank
              ? ` to rank ${facts.advancement.rank.newRank}${facts.advancement.rank.title ? ` (${facts.advancement.rank.title})` : ''}`
              : ''
          }`
    )
  } else if (term.advancement != null) {
    parts.push(`advancement ${term.advancement}`)
  }
  const termSkills = termSkillValue(term)
  if (termSkills) parts.push(termSkills)
  const basicTraining = basicTrainingValue(term)
  if (basicTraining) parts.push(basicTraining)
  const termSkillRolls = termSkillRollValue(term)
  if (termSkillRolls) parts.push(termSkillRolls)
  const cascadeSelections = termCascadeSelectionValue(term)
  if (cascadeSelections) parts.push(cascadeSelections)
  if (facts?.aging) {
    const agingChanges =
      facts.aging.characteristicChanges.length > 0
        ? facts.aging.characteristicChanges.map(agingChangeValue).join(', ')
        : 'no effect'
    parts.push(`aging ${facts.aging.roll.total}: ${agingChanges}`)
  }
  if (facts?.agingLosses && facts.agingLosses.selectedLosses.length > 0) {
    parts.push(
      `aging losses ${facts.agingLosses.selectedLosses.map(agingLossValue).join(', ')}`
    )
  }
  if (facts?.anagathicsDecision) {
    const anagathicsCost =
      facts.anagathicsDecision.useAnagathics && term.anagathicsCost != null
        ? ` (Cr${term.anagathicsCost})`
        : ''
    parts.push(
      facts.anagathicsDecision.useAnagathics
        ? `used anagathics${anagathicsCost}`
        : 'no anagathics'
    )
  }
  if (facts?.reenlistment) {
    parts.push(
      `${formatCheckFact('reenlistment', facts.reenlistment.reenlistment.success, facts.reenlistment.reenlistment)}: ${facts.reenlistment.outcome}`
    )
  } else if (term.reEnlistment != null) {
    parts.push(`reenlistment ${term.reEnlistment}`)
  }
  const benefits = termBenefitValue(term)
  if (benefits) parts.push(benefits)
  if (term.complete) parts.push('term complete')

  return `Term ${index + 1}: ${term.career}${parts.length > 0 ? ` - ${parts.join('; ')}` : ''}`
}

const appendIndentedSection = (
  lines: string[],
  title: string,
  values: readonly string[]
): void => {
  if (values.length === 0) return
  lines.push(`${title}:`, ...values.map((value) => `- ${value}`))
}

export interface CharacterExportViewModel {
  title: string
  upp: string
  characteristics: string
  type: string
  age: string
  homeworld: string
  backgroundSkills: string | null
  careers: string
  terms: number
  skills: string
  credits: string
  equipment: string
  careerHistory: string[]
  notes: string | null
}

export const deriveCharacterExportViewModel = (
  character: CharacterState | null | undefined
): CharacterExportViewModel | null => {
  if (!character || !isCharacterCreationFinal(character)) return null

  const creation = character.creation
  const homeworld = creation?.homeworld
  return {
    title: character.name.trim() || 'Unnamed character',
    upp: deriveCharacterUpp(character.characteristics),
    characteristics: deriveCharacteristicExportLine(character.characteristics),
    type: character.type,
    age: character.age == null ? '-' : String(character.age),
    homeworld: `${homeworld?.name || 'Unspecified'}${homeworld?.lawLevel ? `, ${homeworld.lawLevel}` : ''}${homeworld?.tradeCodes?.length ? `, ${homeworld.tradeCodes.join(', ')}` : ''}`,
    backgroundSkills: backgroundSkillSourceValue(creation),
    careers: careerValue(creation),
    terms: creation?.terms.length ?? 0,
    skills: listValue(sortSkillsForExport(character.skills)),
    credits: `Cr${character.credits}`,
    equipment: equipmentValue(character.equipment),
    careerHistory: (creation?.terms ?? []).map(termHistoryLine),
    notes: character.notes.trim() || null
  }
}

export const derivePlainCharacterExport = (
  character: CharacterState | null | undefined
): string | null => {
  const view = deriveCharacterExportViewModel(character)
  if (!view) return null

  const lines = [
    view.title,
    `UPP: ${view.upp}`,
    `Characteristics: ${view.characteristics}`,
    `Type: ${view.type}`,
    `Age: ${view.age}`,
    `Homeworld: ${view.homeworld}`,
    ...(view.backgroundSkills
      ? [`Background Skills: ${view.backgroundSkills}`]
      : []),
    `Careers: ${view.careers}`,
    `Terms: ${view.terms}`,
    `Skills: ${view.skills}`,
    `Credits: ${view.credits}`,
    `Equipment: ${view.equipment}`
  ]

  appendIndentedSection(lines, 'Career History', view.careerHistory)

  if (view.notes) lines.push('Notes:', view.notes)

  return lines.join('\n')
}
