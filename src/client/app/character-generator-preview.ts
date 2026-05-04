import type { CharacterCharacteristics } from '../../shared/state'
import type { GeneratedCharacterSummary } from './character-command-plan.js'

export type GeneratedCharacterPreviewChipTone =
  | 'neutral'
  | 'success'
  | 'warning'

export interface GeneratedCharacterPreviewChip {
  key: string
  label: string
  tone: GeneratedCharacterPreviewChipTone
}

export interface GeneratedCharacterPreviewLine {
  key: string
  label: string
  value: string
}

export interface GeneratedCharacterStatChip {
  key: keyof CharacterCharacteristics
  label: string
  value: string
}

export interface GeneratedCharacterSkillChip {
  key: string
  label: string
}

export interface GeneratedCharacterOutcomeLabels {
  qualification: string
  survival: string
  commission: string | null
  advancement: string | null
  credits: string
}

export interface GeneratedCharacterPreviewViewModel {
  title: string
  subtitle: string
  stats: GeneratedCharacterStatChip[]
  skills: GeneratedCharacterSkillChip[]
  lines: GeneratedCharacterPreviewLine[]
  chips: GeneratedCharacterPreviewChip[]
  canAccept: boolean
}

const characteristicDefinitions: {
  key: keyof CharacterCharacteristics
  label: string
}[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'end', label: 'END' },
  { key: 'int', label: 'INT' },
  { key: 'edu', label: 'EDU' },
  { key: 'soc', label: 'SOC' }
]

const formatRollLabel = (label: string, roll: number): string =>
  `${label} (${roll})`

const formatNullableRollLabel = (label: string, roll: number | null): string =>
  roll === null ? label : formatRollLabel(label, roll)

export const formatGeneratedCharacterCharacteristics = (
  characteristics: CharacterCharacteristics
): string =>
  characteristicDefinitions
    .map(({ key, label }) => `${label} ${characteristics[key] ?? '-'}`)
    .join('  ')

export const deriveGeneratedCharacterStatChips = (
  generated: GeneratedCharacterSummary
): GeneratedCharacterStatChip[] =>
  characteristicDefinitions.map(({ key, label }) => ({
    key,
    label,
    value: String(generated.characteristics[key] ?? '-')
  }))

export const deriveGeneratedCharacterSkillChips = (
  generated: GeneratedCharacterSummary
): GeneratedCharacterSkillChip[] =>
  generated.skills.map((skill, index) => ({
    key: `${index}-${skill}`,
    label: skill
  }))

export const deriveGeneratedCharacterOutcomeLabels = (
  generated: GeneratedCharacterSummary
): GeneratedCharacterOutcomeLabels => ({
  qualification: generated.drafted
    ? formatRollLabel('Drafted', generated.qualificationRoll)
    : formatRollLabel('Qualified', generated.qualificationRoll),
  survival: generated.survivalPassed
    ? formatRollLabel('Survived', generated.survivalRoll)
    : formatRollLabel('Mishap', generated.survivalRoll),
  commission:
    generated.commissionPassed === null
      ? null
      : formatNullableRollLabel(
          generated.commissionPassed ? 'Commissioned' : 'No commission',
          generated.commissionRoll
        ),
  advancement:
    generated.advancementPassed === null
      ? null
      : formatNullableRollLabel(
          generated.advancementPassed ? 'Advanced' : 'Held rank',
          generated.advancementRoll
        ),
  credits: `${generated.credits} credits`
})

export const deriveGeneratedCharacterPreviewLines = (
  generated: GeneratedCharacterSummary
): GeneratedCharacterPreviewLine[] => [
  {
    key: 'characteristics',
    label: 'Characteristics',
    value: formatGeneratedCharacterCharacteristics(generated.characteristics)
  },
  {
    key: 'skills',
    label: 'Skills',
    value: generated.skills.length > 0 ? generated.skills.join(', ') : '-'
  }
]

export const deriveGeneratedCharacterPreviewChips = (
  generated: GeneratedCharacterSummary
): GeneratedCharacterPreviewChip[] => {
  const labels = deriveGeneratedCharacterOutcomeLabels(generated)
  const chips: GeneratedCharacterPreviewChip[] = [
    {
      key: 'survival',
      label: labels.survival,
      tone: generated.survivalPassed ? 'success' : 'warning'
    },
    {
      key: 'credits',
      label: labels.credits,
      tone: 'neutral'
    },
    {
      key: 'qualification',
      label: labels.qualification,
      tone: generated.drafted ? 'warning' : 'success'
    }
  ]

  if (labels.commission) {
    chips.push({
      key: 'commission',
      label: labels.commission,
      tone: generated.commissionPassed ? 'success' : 'neutral'
    })
  }

  if (labels.advancement) {
    chips.push({
      key: 'advancement',
      label: labels.advancement,
      tone: generated.advancementPassed ? 'success' : 'neutral'
    })
  }

  return chips
}

export const deriveGeneratedCharacterPreview = (
  generated: GeneratedCharacterSummary | null
): GeneratedCharacterPreviewViewModel | null => {
  if (!generated) return null

  return {
    title: generated.name,
    subtitle: `${generated.career} / Age ${generated.age}`,
    stats: deriveGeneratedCharacterStatChips(generated),
    skills: deriveGeneratedCharacterSkillChips(generated),
    lines: deriveGeneratedCharacterPreviewLines(generated),
    chips: deriveGeneratedCharacterPreviewChips(generated),
    canAccept: true
  }
}
