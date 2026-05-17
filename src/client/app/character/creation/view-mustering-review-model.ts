import { deriveMaterialBenefitEffect } from '../../../../shared/character-creation/benefits'
import type {
  BenefitKind,
  MusteringBenefitActionOption
} from '../../../../shared/character-creation/types'
import type {
  CharacterCreationCompletedTerm,
  CharacterCreationFlow,
  CharacterCreationMusteringBenefit
} from './flow'
import {
  canRollCharacterCreationMusteringBenefit,
  characterCreationMusteringBenefitRollModifier,
  remainingMusteringBenefits
} from './flow'
import {
  characterCreationStepLabels,
  characteristicDefinitions,
  formatCharacterCreationCompletedTermSummary,
  formatCharacterCreationMusteringBenefitSummary,
  musteringBenefitKindLabel,
  musteringBenefitValueLabel,
  signedModifier
} from './view-format'
import type {
  CharacterCreationMusteringOutViewModel,
  CharacterCreationReviewItem,
  CharacterCreationReviewSummary,
  CharacterCreationTermHistoryViewModel
} from './view-types'

const musteringBenefitRollLabel = (
  benefit: CharacterCreationMusteringBenefit
): string => {
  if (benefit.legacyProjection) return 'Legacy benefit'
  const diceRoll = benefit.diceRoll ?? null
  const modifier = benefit.modifier ?? null
  const tableRoll = benefit.tableRoll ?? benefit.roll
  if (diceRoll === null || modifier === null) return `Table ${benefit.roll}`
  if (modifier === 0) return `Roll ${diceRoll}`
  return `Roll ${diceRoll} ${signedModifier(modifier)} DM = ${tableRoll}`
}

const musteringBenefitMetaLabel = (
  benefit: CharacterCreationMusteringBenefit
): string => {
  if (benefit.kind === 'cash') return 'Credits'

  const effect = deriveMaterialBenefitEffect(
    benefit.materialItem ?? benefit.value
  )
  if (effect.kind === 'characteristic') {
    return `Characteristic gain: ${effect.characteristic.toUpperCase()} +${effect.modifier}`
  }
  if (effect.kind === 'equipment') return 'Equipment item'

  return 'No material benefit'
}

const musteringBenefitActionTitle = ({
  career,
  kind,
  modifier
}: {
  career: string
  kind: BenefitKind
  modifier: number
}): string => {
  const target = [
    career.trim(),
    musteringBenefitKindLabel(kind).toLowerCase(),
    'benefit'
  ]
    .filter(Boolean)
    .join(' ')
  const rollModifier = modifier === 0 ? '' : `${signedModifier(modifier)} DM`

  return [target, rollModifier].filter(Boolean).join('; ')
}

export const deriveCharacterCreationMusteringOutViewModel = (
  flow: CharacterCreationFlow,
  {
    musteringBenefitOptions
  }: {
    musteringBenefitOptions?: readonly MusteringBenefitActionOption[]
  } = {}
): CharacterCreationMusteringOutViewModel => {
  const remaining = remainingMusteringBenefits(flow.draft)
  const summary =
    flow.draft.completedTerms.length === 0
      ? 'No career terms completed yet.'
      : remaining > 0
        ? `${remaining} benefit ${remaining === 1 ? 'roll' : 'rolls'} remaining.`
        : 'Benefits complete.'
  const benefitActions =
    musteringBenefitOptions?.map((option) => ({
      career: option.career,
      kind: option.kind,
      label: option.kind === 'cash' ? 'Roll cash' : 'Roll benefit'
    })) ??
    ([
      {
        career: flow.draft.completedTerms.at(-1)?.career ?? '',
        kind: 'cash',
        label: 'Roll cash'
      },
      {
        career: flow.draft.completedTerms.at(-1)?.career ?? '',
        kind: 'material',
        label: 'Roll benefit'
      }
    ] satisfies readonly {
      career: string
      kind: BenefitKind
      label: string
    }[])

  return {
    title: 'Mustering out',
    summary,
    benefits: flow.draft.musteringBenefits.map((benefit) => ({
      label: `${benefit.career} ${musteringBenefitKindLabel(benefit.kind)}`,
      valueLabel: musteringBenefitValueLabel(benefit),
      rollLabel: musteringBenefitRollLabel(benefit),
      metaLabel: musteringBenefitMetaLabel(benefit)
    })),
    actions: benefitActions.map(({ career, kind, label }) => {
      const modifier = characterCreationMusteringBenefitRollModifier({
        draft: flow.draft,
        kind
      })
      const disabled =
        !musteringBenefitOptions &&
        (remaining <= 0 ||
          !canRollCharacterCreationMusteringBenefit({
            draft: flow.draft,
            kind
          }))
      return {
        career,
        kind,
        label,
        disabled,
        title: musteringBenefitActionTitle({ career, kind, modifier })
      }
    })
  }
}

const itemValue = (value: string | number | null): string =>
  value === null || value === '' ? 'Not set' : String(value)

const outcomeValue = (
  roll: number | null | undefined,
  passed: boolean | null | undefined,
  unavailableLabel = 'Not set'
): string => {
  if (roll === null || roll === undefined) return unavailableLabel
  if (roll === -1) return 'Skipped'
  if (passed === true) return `${roll} (passed)`
  if (passed === false) return `${roll} (failed)`
  return `${roll} (not evaluated)`
}

const careerReviewItems = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationReviewItem[] => {
  const careerPlan = draft.careerPlan
  const completedTerm = draft.completedTerms.at(-1)
  const career = careerPlan?.career.trim() || completedTerm?.career || ''

  return [
    { label: 'Career', value: itemValue(career) },
    {
      label: 'Qualification',
      value: outcomeValue(
        careerPlan?.qualificationRoll ?? completedTerm?.qualificationRoll,
        careerPlan?.qualificationPassed ??
          (completedTerm ? completedTerm.qualificationRoll !== null : null)
      )
    },
    {
      label: 'Survival',
      value: outcomeValue(
        careerPlan?.survivalRoll ?? completedTerm?.survivalRoll,
        careerPlan?.survivalPassed ?? completedTerm?.survivalPassed
      )
    },
    {
      label: 'Commission',
      value: outcomeValue(
        careerPlan?.commissionRoll ?? completedTerm?.commissionRoll,
        careerPlan?.commissionPassed ?? completedTerm?.commissionPassed,
        (careerPlan?.canCommission ?? completedTerm?.canCommission) === false
          ? 'Not available'
          : 'Not set'
      )
    },
    {
      label: 'Advancement',
      value: outcomeValue(
        careerPlan?.advancementRoll ?? completedTerm?.advancementRoll,
        careerPlan?.advancementPassed ?? completedTerm?.advancementPassed,
        (careerPlan?.canAdvance ?? completedTerm?.canAdvance) === false
          ? 'Not available'
          : 'Not set'
      )
    }
  ]
}

const termHistoryReviewItems = (
  completedTerms: readonly CharacterCreationCompletedTerm[]
): CharacterCreationReviewItem[] => {
  if (completedTerms.length === 0) {
    return [{ label: 'Terms', value: 'Not recorded' }]
  }

  return completedTerms.map((term, index) => ({
    label: `Term ${index + 1}`,
    value: [
      term.career,
      term.drafted ? 'drafted' : null,
      term.survivalPassed ? 'survived' : 'killed in service',
      term.commissionPassed === true ? 'commissioned' : null,
      term.advancementPassed === true ? 'advanced' : null,
      term.rankTitle ? `rank ${term.rankTitle}` : null,
      term.rankBonusSkill ? `rank skill ${term.rankBonusSkill}` : null,
      (term.termSkillRolls ?? []).length > 0
        ? `training ${(term.termSkillRolls ?? [])
            .map((roll) => `${roll.skill} (${roll.roll})`)
            .join(', ')}`
        : null,
      term.anagathics === true ? 'anagathics' : null,
      term.agingRoll != null
        ? `aging ${term.agingRoll}${
            term.agingMessage ? ` ${term.agingMessage}` : ''
          }`
        : null
    ]
      .filter(Boolean)
      .join(', ')
  }))
}

const musteringReviewItems = (
  draft: CharacterCreationFlow['draft']
): CharacterCreationReviewItem[] => {
  if (draft.musteringBenefits.length === 0) {
    return [{ label: 'Benefits', value: 'Not rolled' }]
  }

  return draft.musteringBenefits.map((benefit, index) => ({
    label: `Benefit ${index + 1}`,
    value: `${formatCharacterCreationMusteringBenefitSummary(benefit)} (${musteringBenefitRollLabel(benefit)})`
  }))
}

export const deriveCharacterCreationReviewSummary = (
  flow: CharacterCreationFlow,
  {
    completedTerms = flow.draft.completedTerms
  }: { completedTerms?: readonly CharacterCreationCompletedTerm[] } = {}
): CharacterCreationReviewSummary => {
  const { draft } = flow
  const skills = draft.skills.length > 0 ? draft.skills.join(', ') : 'Not set'
  const equipment =
    draft.equipment.length > 0
      ? draft.equipment
          .map((item) => `${item.name} x${item.quantity}`)
          .join(', ')
      : 'None'

  return {
    title: draft.name.trim() || 'Unnamed character',
    subtitle: draft.characterType,
    sections: [
      {
        key: 'basics',
        label: characterCreationStepLabels.basics,
        items: [
          { label: 'Name', value: itemValue(draft.name.trim()) },
          { label: 'Type', value: draft.characterType },
          { label: 'Age', value: itemValue(draft.age) }
        ]
      },
      {
        key: 'characteristics',
        label: characterCreationStepLabels.characteristics,
        items: characteristicDefinitions.map(({ key, label }) => ({
          label,
          value: itemValue(draft.characteristics[key])
        }))
      },
      {
        key: 'career',
        label: characterCreationStepLabels.career,
        items: careerReviewItems(draft)
      },
      {
        key: 'career-history',
        label: 'Terms',
        items: termHistoryReviewItems(completedTerms)
      },
      {
        key: 'skills',
        label: characterCreationStepLabels.skills,
        items: [{ label: 'Skills', value: skills }]
      },
      {
        key: 'mustering-out',
        label: 'Mustering out',
        items: musteringReviewItems(draft)
      },
      {
        key: 'equipment',
        label: characterCreationStepLabels.equipment,
        items: [
          { label: 'Equipment', value: equipment },
          { label: 'Credits', value: itemValue(draft.credits) },
          { label: 'Notes', value: itemValue(draft.notes.trim()) }
        ]
      }
    ]
  }
}

export const deriveCharacterCreationTermHistoryViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationTermHistoryViewModel | null => {
  if (flow.draft.completedTerms.length === 0) return null

  return {
    title: 'Terms served',
    terms: flow.draft.completedTerms.map((term, index) =>
      formatCharacterCreationCompletedTermSummary(term, index)
    )
  }
}
