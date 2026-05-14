import type {
  CharacterCharacteristics,
  CharacterCreationProjection,
  CharacterEquipmentItem,
  CharacterState,
  CharacteristicKey
} from '../../../../shared/state'
import type { CareerTerm } from '../../../../shared/characterCreation'
import {
  deriveMaterialBenefitEffect,
  parseCareerSkill
} from '../../../../shared/characterCreation'

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

const formatCheck = (
  label: string,
  passed: boolean,
  total: number | null | undefined
): string =>
  `${label} ${passed ? 'passed' : 'failed'}${total == null ? '' : ` ${total}`}`

const termSkillValue = (term: CareerTerm): string | null => {
  const skills = sortSkillsForExport([
    ...term.skills,
    ...term.skillsAndTraining,
    ...(term.facts?.basicTrainingSkills ?? [])
  ])
  return skills.length > 0 ? `skills ${listValue(skills)}` : null
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

const termHistoryLine = (term: CareerTerm, index: number): string => {
  const facts = term.facts
  const parts: string[] = []
  if (term.draft === 1 && facts?.draft) {
    parts.push(
      `drafted ${facts.draft.acceptedCareer} ${facts.draft.roll.total}`
    )
  } else if (facts?.qualification) {
    parts.push(
      formatCheck(
        'qualified',
        facts.qualification.passed,
        facts.qualification.qualification.total
      )
    )
  }
  if (facts?.survival) {
    parts.push(
      formatCheck(
        'survival',
        facts.survival.passed,
        facts.survival.survival.total
      )
    )
  } else if (term.survival != null) {
    parts.push(`survival ${term.survival}`)
  }
  if (facts?.commission) {
    parts.push(
      facts.commission.skipped
        ? 'commission skipped'
        : formatCheck(
            'commission',
            facts.commission.passed,
            facts.commission.commission.total
          )
    )
  }
  if (facts?.advancement) {
    parts.push(
      facts.advancement.skipped
        ? 'advancement skipped'
        : `${formatCheck(
            'advancement',
            facts.advancement.passed,
            facts.advancement.advancement.total
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
  if (facts?.aging) {
    parts.push(
      `aging ${facts.aging.roll.total}: ${
        facts.aging.characteristicChanges.length > 0
          ? `${facts.aging.characteristicChanges.length} changes`
          : 'no effect'
      }`
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
      `reenlistment ${facts.reenlistment.reenlistment.total}: ${facts.reenlistment.outcome}`
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

export const derivePlainCharacterExport = (
  character: CharacterState | null | undefined
): string | null => {
  if (!character || !isCharacterCreationFinal(character)) return null

  const creation = character.creation
  const homeworld = creation?.homeworld
  const lines = [
    character.name.trim() || 'Unnamed character',
    `UPP: ${deriveCharacterUpp(character.characteristics)}`,
    `Characteristics: ${deriveCharacteristicExportLine(character.characteristics)}`,
    `Type: ${character.type}`,
    `Age: ${character.age == null ? '-' : character.age}`,
    `Homeworld: ${homeworld?.name || 'Unspecified'}${homeworld?.lawLevel ? `, ${homeworld.lawLevel}` : ''}${homeworld?.tradeCodes?.length ? `, ${homeworld.tradeCodes.join(', ')}` : ''}`,
    `Careers: ${careerValue(creation)}`,
    `Terms: ${creation?.terms.length ?? 0}`,
    `Skills: ${listValue(sortSkillsForExport(character.skills))}`,
    `Credits: Cr${character.credits}`,
    `Equipment: ${equipmentValue(character.equipment)}`
  ]

  appendIndentedSection(
    lines,
    'Career History',
    (creation?.terms ?? []).map(termHistoryLine)
  )

  const notes = character.notes.trim()
  if (notes) lines.push('Notes:', notes)

  return lines.join('\n')
}
