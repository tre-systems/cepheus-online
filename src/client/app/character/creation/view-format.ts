import { characteristicModifier } from '../../../../shared/character-creation/career-rules'
import type { BenefitKind } from '../../../../shared/character-creation/types'
import type { CharacteristicKey } from '../../../../shared/state'
import type {
  CharacterCreationCareerPlan,
  CharacterCreationCompletedTerm,
  CharacterCreationMusteringBenefit,
  CharacterCreationStep
} from './flow'
import type { CharacterCreationCareerCheckViewModel } from './view-types'

export const formatCredits = (credits: number): string => `Cr${credits}`

export const signedModifier = (modifier: number): string =>
  modifier > 0 ? `+${modifier}` : String(modifier)

export const formatCharacterCreationReenlistmentOutcome = (
  plan: CharacterCreationCareerPlan | null | undefined
): string => {
  if (plan?.reenlistmentOutcome === 'forced') {
    return `Reenlistment ${plan.reenlistmentRoll}: mandatory reenlistment.`
  }
  if (plan?.reenlistmentOutcome === 'allowed') {
    return `Reenlistment ${plan.reenlistmentRoll}: may reenlist or muster out.`
  }
  if (plan?.reenlistmentOutcome === 'blocked') {
    return `Reenlistment ${plan.reenlistmentRoll}: must muster out.`
  }
  if (plan?.reenlistmentOutcome === 'retire') {
    return 'Seven terms served: must retire and muster out.'
  }
  return 'Roll reenlistment before deciding what happens next.'
}

export const formatCharacterCreationCharacteristicModifier = (
  value: string | number | null | undefined
): string => {
  if (value === '' || value === null || value === undefined) return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  const modifier = Math.floor(number / 3) - 2
  if (modifier === 0) return ''
  return modifier > 0 ? `+${modifier}` : String(modifier)
}

export const formatCharacterCreationCareerCheckShort = (
  check: CharacterCreationCareerCheckViewModel
): string => {
  if (!check.available) return 'Unavailable'
  const modifier =
    check.modifier === 0
      ? ''
      : check.modifier > 0
        ? ` +${check.modifier}`
        : ` ${check.modifier}`
  return `${check.requirement}${modifier}`
}

export const formatCharacterCreationCareerOutcome = (
  plan: CharacterCreationCareerPlan | null | undefined
): string => {
  if (!plan?.career) return 'Select a career to attempt qualification.'
  if (plan.drafted && plan.survivalRoll === null) {
    return `Drafted into ${plan.career}: ready to roll survival.`
  }
  const lines = []
  if (plan.qualificationRoll !== null) {
    lines.push(
      `Qualification ${plan.qualificationRoll}: ${
        plan.qualificationPassed ? 'accepted' : 'rejected'
      }`
    )
  }
  if (plan.survivalRoll !== null) {
    lines.push(
      `Survival ${plan.survivalRoll}: ${
        plan.survivalPassed ? 'survived' : 'mishap'
      }`
    )
  }
  if (plan.commissionRoll !== null) {
    lines.push(
      plan.commissionRoll === -1
        ? 'Commission skipped'
        : `Commission ${plan.commissionRoll}: ${
            plan.commissionPassed ? 'commissioned' : 'not commissioned'
          }`
    )
  }
  if (plan.advancementRoll !== null) {
    lines.push(
      plan.advancementRoll === -1
        ? 'Advancement skipped'
        : `Advancement ${plan.advancementRoll}: ${
            plan.advancementPassed ? 'advanced' : 'held rank'
          }`
    )
  }
  if (plan.agingRoll != null) {
    lines.push(`Aging ${plan.agingRoll}: ${plan.agingMessage ?? 'resolved'}`)
  }
  if (plan.reenlistmentOutcome) {
    lines.push(formatCharacterCreationReenlistmentOutcome(plan))
  }
  return lines.join(' | ') || `${plan.career}: ready to roll qualification.`
}

export const formatCharacterCreationCompletedTermSummary = (
  term: CharacterCreationCompletedTerm,
  index: number
): string => {
  const result = term.survivalPassed ? 'survived' : 'killed in service'
  const commission =
    term.commissionRoll === null
      ? ''
      : term.commissionRoll === -1
        ? ', skipped commission'
        : term.commissionPassed
          ? ', commissioned'
          : ', no commission'
  const advancement =
    term.advancementRoll === null
      ? ''
      : term.advancementRoll === -1
        ? ', skipped advancement'
        : term.advancementPassed
          ? ', advanced'
          : ', held rank'
  const rank = term.rankTitle ? `, rank ${term.rankTitle}` : ''
  const bonusSkill = term.rankBonusSkill
    ? `; rank skill ${term.rankBonusSkill}`
    : ''
  const termSkillRolls = term.termSkillRolls ?? []
  const training =
    termSkillRolls.length > 0
      ? `; training ${termSkillRolls
          .map((roll) => `${roll.skill} (${roll.roll})`)
          .join(', ')}`
      : ''
  const aging =
    term.agingRoll != null
      ? `; aging ${term.agingRoll}${
          term.agingMessage ? ` ${term.agingMessage}` : ''
        }`
      : ''
  const anagathicsDetails = [
    term.anagathicsCost != null ? `Cr${term.anagathicsCost}` : null,
    term.anagathicsCostRoll != null
      ? `cost roll ${term.anagathicsCostRoll}`
      : null
  ].filter(Boolean)
  const anagathics =
    term.anagathics === true
      ? `; anagathics${
          anagathicsDetails.length > 0
            ? ` (${anagathicsDetails.join('; ')})`
            : ''
        }`
      : ''
  const reenlistment =
    term.reenlistmentOutcome && term.reenlistmentRoll !== null
      ? `; reenlistment ${term.reenlistmentRoll} ${term.reenlistmentOutcome}`
      : term.reenlistmentOutcome === 'retire'
        ? '; retirement required'
        : ''
  const lifecycle =
    term.careerLifecycle?.type === 'continued'
      ? term.careerLifecycle.forced
        ? '; forced reenlistment'
        : '; reenlisted'
      : term.careerLifecycle?.type === 'left'
        ? term.careerLifecycle.retirement
          ? '; retired'
          : term.careerLifecycle.outcome === 'blocked'
            ? '; reenlistment blocked'
            : '; left career'
        : ''
  return `${index + 1}. ${term.career}: ${result}${commission}${advancement}${rank}${bonusSkill}${training}${anagathics}${aging}${reenlistment}${lifecycle}`
}

export const musteringBenefitKindLabel = (kind: BenefitKind): string =>
  kind === 'cash' ? 'Cash' : 'Material'

export const musteringBenefitValueLabel = (
  benefit: CharacterCreationMusteringBenefit
): string =>
  benefit.kind === 'cash' ? formatCredits(benefit.credits) : benefit.value

export const formatCharacterCreationMusteringBenefitSummary = (
  benefit: CharacterCreationMusteringBenefit
): string =>
  `${benefit.career} ${musteringBenefitKindLabel(benefit.kind).toLowerCase()}: ${musteringBenefitValueLabel(benefit)}`

export const characteristicDefinitions: {
  key: CharacteristicKey
  label: string
}[] = [
  { key: 'str', label: 'Str' },
  { key: 'dex', label: 'Dex' },
  { key: 'end', label: 'End' },
  { key: 'int', label: 'Int' },
  { key: 'edu', label: 'Edu' },
  { key: 'soc', label: 'Soc' }
]

export const characterCreationStepLabels: Record<
  CharacterCreationStep,
  string
> = {
  basics: 'Basics',
  characteristics: 'Characteristics',
  homeworld: 'Homeworld',
  career: 'Career',
  skills: 'Skills',
  equipment: 'Equipment',
  review: 'Review'
}

export const characterCreationPrimaryCtaLabels: Record<
  CharacterCreationStep,
  string
> = {
  basics: 'Continue to characteristics',
  characteristics: 'Continue to homeworld',
  homeworld: 'Continue to career',
  career: 'Continue to skills',
  skills: 'Continue to equipment',
  equipment: 'Review character',
  review: 'Create character'
}

export const characterCreationCharacteristicModifier = (
  value: number
): string => signedModifier(characteristicModifier(value))
