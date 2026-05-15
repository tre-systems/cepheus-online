import type {
  CareerCreationStatus,
  CareerCreationTermSkillFact,
  CareerTerm
} from '../../../../shared/character-creation/types'
import {
  formatCareerSkill,
  isCascadeCareerSkill,
  parseCareerSkill
} from '../../../../shared/character-creation/skills.js'
import { characterCreationStepFromStatus } from '../../../../shared/character-creation/view-state.js'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import {
  createInitialCharacterDraft,
  normalizeSkillList,
  type CharacterCreationCareerPlan,
  type CharacterCreationCompletedTerm,
  type CharacterCreationFlow,
  type CharacterCreationMusteringBenefit,
  type CharacterCreationStep
} from './flow.js'

export const creationStepFromStatus = (
  status: CareerCreationStatus | string
): CharacterCreationStep => characterCreationStepFromStatus(status)

export const completedTermFromProjection = (
  term: CareerTerm
): CharacterCreationCompletedTerm => {
  if (hasSemanticTermFacts(term)) return completedTermFromSemanticFacts(term)
  return legacyCompletedTermFromAggregate(term)
}

const hasSemanticTermFacts = (term: CareerTerm): boolean =>
  Object.keys(term.facts ?? {}).length > 0

const resolvedTermCascadeSkill = (
  term: CareerTerm,
  cascadeSkill: string | null
): string | null => {
  if (!cascadeSkill) return null

  let current = cascadeSkill
  const visited = new Set<string>()

  while (!visited.has(current)) {
    visited.add(current)
    const selection = term.facts?.termCascadeSelections?.find(
      (entry) => entry.cascadeSkill === current
    )?.selection

    if (!selection) return null
    if (isCascadeCareerSkill(selection)) {
      const level = parseCareerSkill(current)?.level ?? 0
      current = selection.trim().replace('*', `-${level}`)
      continue
    }

    return formatCareerSkill({
      name: selection.trim(),
      level: parseCareerSkill(current)?.level ?? 0
    })
  }

  return null
}

const termSkillFactSkill = (
  term: CareerTerm,
  termSkill: CareerCreationTermSkillFact
): string | null =>
  termSkill.skill ??
  resolvedTermCascadeSkill(term, termSkill.pendingCascadeSkill) ??
  null

const termSkillRollsFromFacts = (
  term: CareerTerm
): CharacterCreationCompletedTerm['termSkillRolls'] =>
  (term.facts?.termSkillRolls ?? []).map((termSkill) => ({
    table: termSkill.table,
    roll: termSkill.roll.total,
    skill: termSkillFactSkill(term, termSkill) ?? termSkill.rawSkill
  }))

const skillListFromTermFacts = (term: CareerTerm): string[] => [
  ...(term.facts?.basicTrainingSkills ?? []),
  ...(term.facts?.termSkillRolls ?? []).flatMap((termSkill) => {
    const skill = termSkillFactSkill(term, termSkill)
    return skill ? [skill] : []
  })
]

const creationSkillsFromTerm = (term: CareerTerm): string[] => {
  const factSkills = skillListFromTermFacts(term)
  return hasSemanticTermFacts(term) && factSkills.length > 0
    ? factSkills
    : term.skillsAndTraining
}

const legacyTermSkillRollsFromAggregate = (
  term: CareerTerm
): CharacterCreationCompletedTerm['termSkillRolls'] =>
  term.skillsAndTraining.map((skill) => ({
    table: 'serviceSkills',
    roll: 0,
    skill
  }))

const completedTermFromSemanticFacts = (
  term: CareerTerm
): CharacterCreationCompletedTerm => {
  const facts = term.facts
  const commission = facts?.commission
  const advancement = facts?.advancement

  return {
    career: term.career,
    drafted: term.draft === 1,
    anagathics: term.anagathics,
    anagathicsCost: term.anagathicsCost ?? null,
    age: facts?.aging?.age ?? null,
    rank:
      advancement && !advancement.skipped
        ? (advancement.rank?.newRank ?? null)
        : null,
    qualificationRoll: facts?.qualification?.qualification.total ?? null,
    survivalRoll: facts?.survival?.survival.total ?? null,
    survivalPassed: facts?.survival?.passed ?? true,
    canCommission: facts?.survival?.canCommission ?? false,
    commissionRoll:
      commission?.skipped === true
        ? -1
        : (commission?.commission.total ?? null),
    commissionPassed:
      commission?.skipped === true ? false : (commission?.passed ?? null),
    canAdvance: facts?.survival?.canAdvance ?? false,
    advancementRoll:
      advancement?.skipped === true
        ? -1
        : (advancement?.advancement.total ?? null),
    advancementPassed:
      advancement?.skipped === true ? false : (advancement?.passed ?? null),
    termSkillRolls: termSkillRollsFromFacts(term),
    reenlistmentRoll: facts?.reenlistment?.reenlistment.total ?? null,
    reenlistmentOutcome: facts?.reenlistment?.outcome ?? null
  }
}

const legacyCompletedTermFromAggregate = (
  term: CareerTerm
): CharacterCreationCompletedTerm => ({
  career: term.career,
  drafted: term.draft === 1,
  anagathics: term.anagathics,
  anagathicsCost: term.anagathicsCost ?? null,
  age: null,
  rank: null,
  qualificationRoll: null,
  survivalRoll: term.survival ?? null,
  survivalPassed: term.survival == null ? true : term.complete,
  canCommission: false,
  commissionRoll: null,
  commissionPassed: null,
  canAdvance: false,
  advancementRoll: term.advancement ?? null,
  advancementPassed: null,
  termSkillRolls: legacyTermSkillRollsFromAggregate(term),
  reenlistmentRoll: term.reEnlistment ?? null,
  reenlistmentOutcome: term.canReenlist ? 'allowed' : 'blocked'
})

const activeTermFromProjection = (
  creation: CharacterCreationProjection
): CareerTerm | null => {
  const activeTerm = [...creation.terms]
    .reverse()
    .find((term) => !term.complete && !term.musteringOut)
  return activeTerm ?? null
}

const legacyCareerPlanFromAggregate = (
  activeTerm: CareerTerm
): Pick<
  CharacterCreationCareerPlan,
  | 'survivalRoll'
  | 'advancementRoll'
  | 'reenlistmentRoll'
  | 'reenlistmentOutcome'
> => ({
  survivalRoll: activeTerm.survival ?? null,
  advancementRoll: activeTerm.advancement ?? null,
  reenlistmentRoll: activeTerm.reEnlistment ?? null,
  reenlistmentOutcome: activeTerm.canReenlist ? 'allowed' : null
})

const semanticCareerPlanFromFacts = (
  activeTerm: CareerTerm
): Pick<
  CharacterCreationCareerPlan,
  | 'survivalRoll'
  | 'advancementRoll'
  | 'reenlistmentRoll'
  | 'reenlistmentOutcome'
> => {
  const facts = activeTerm.facts
  const advancement = facts?.advancement

  return {
    survivalRoll: facts?.survival?.survival.total ?? null,
    advancementRoll:
      advancement?.skipped === true
        ? -1
        : (advancement?.advancement.total ?? null),
    reenlistmentRoll: facts?.reenlistment?.reenlistment.total ?? null,
    reenlistmentOutcome: facts?.reenlistment?.outcome ?? null
  }
}

export const careerPlanFromProjection = (
  creation: CharacterCreationProjection
): CharacterCreationCareerPlan | null => {
  const activeTerm = activeTermFromProjection(creation)
  if (!activeTerm) return null

  const facts = activeTerm.facts
  const commission = facts?.commission
  const advancement = facts?.advancement
  const agingFact = facts?.aging
  const semanticOrLegacyFields = hasSemanticTermFacts(activeTerm)
    ? semanticCareerPlanFromFacts(activeTerm)
    : legacyCareerPlanFromAggregate(activeTerm)

  return {
    career: activeTerm.career,
    qualificationRoll: facts?.qualification?.qualification.total ?? null,
    qualificationPassed: facts?.qualification?.passed ?? true,
    survivalRoll: semanticOrLegacyFields.survivalRoll,
    survivalPassed: facts?.survival?.passed ?? null,
    commissionRoll:
      commission?.skipped === true
        ? -1
        : (commission?.commission.total ?? null),
    commissionPassed:
      commission?.skipped === true ? false : (commission?.passed ?? null),
    advancementRoll: semanticOrLegacyFields.advancementRoll,
    advancementPassed:
      advancement?.skipped === true ? false : (advancement?.passed ?? null),
    canCommission: creation.state.context?.canCommission ?? null,
    canAdvance: creation.state.context?.canAdvance ?? null,
    drafted: activeTerm.draft === 1,
    rank:
      advancement && !advancement.skipped
        ? (advancement.rank?.newRank ?? null)
        : null,
    rankTitle:
      advancement && !advancement.skipped
        ? (advancement.rank?.title ?? null)
        : null,
    rankBonusSkill:
      advancement && !advancement.skipped
        ? (advancement.rank?.bonusSkill ?? null)
        : null,
    termSkillRolls:
      facts?.termSkillRolls?.map((termSkill) => ({
        table: termSkill.table,
        roll: termSkill.roll.total,
        skill: termSkillFactSkill(activeTerm, termSkill) ?? termSkill.rawSkill
      })) ?? [],
    anagathics:
      facts?.anagathicsDecision?.useAnagathics ??
      (creation.state.status === 'AGING' && !agingFact
        ? null
        : activeTerm.anagathics),
    agingRoll: agingFact?.roll?.total ?? null,
    agingMessage:
      (agingFact?.characteristicChanges?.length ?? 0) > 0
        ? `${agingFact?.characteristicChanges?.length ?? 0} characteristic changes`
        : agingFact
          ? 'No aging effects.'
          : null,
    agingSelections: [],
    reenlistmentRoll: semanticOrLegacyFields.reenlistmentRoll,
    reenlistmentOutcome: semanticOrLegacyFields.reenlistmentOutcome
  }
}

const isCashMusteringBenefitValue = (value: string): boolean =>
  /^\d+$/.test(value.trim())

const legacyMusteringBenefitsFromProjectedTerms = (
  creation: CharacterCreationProjection
): CharacterCreationMusteringBenefit[] =>
  creation.terms.flatMap((term) =>
    term.benefits.map((value) => {
      const isCash = isCashMusteringBenefitValue(value)

      return {
        career: term.career,
        kind: isCash ? 'cash' : 'material',
        roll: 0,
        legacyProjection: true,
        value,
        credits: isCash ? Number(value) : 0
      }
    })
  )

export const musteringBenefitsFromProjection = (
  creation: CharacterCreationProjection
): CharacterCreationMusteringBenefit[] => {
  const benefits = creation.terms.flatMap((term) =>
    (term.facts?.musteringBenefits ?? []).map((benefit) => ({
      career: benefit.career,
      kind: benefit.kind,
      roll: benefit.tableRoll,
      diceRoll: benefit.roll.total,
      modifier: benefit.modifier,
      tableRoll: benefit.tableRoll,
      value: benefit.value,
      credits: benefit.credits,
      ...(benefit.materialItem != null
        ? { materialItem: benefit.materialItem }
        : {})
    }))
  )

  return benefits.length > 0
    ? benefits
    : legacyMusteringBenefitsFromProjectedTerms(creation)
}

export const flowFromProjectedCharacter = (
  character: CharacterState
): CharacterCreationFlow | null => {
  const creation = character.creation
  if (!creation) return null

  const completedTerms = creation.terms
    .filter((term) => term.complete || term.musteringOut)
    .map(completedTermFromProjection)
  const musteringBenefits = musteringBenefitsFromProjection(creation)

  const creationSkills = normalizeSkillList([
    ...character.skills,
    ...creation.terms.flatMap(creationSkillsFromTerm)
  ])

  const step =
    creation.state.status === 'MUSTERING_OUT'
      ? 'equipment'
      : creationStepFromStatus(creation.state.status)

  return {
    step,
    draft: createInitialCharacterDraft(character.id, {
      name: character.name,
      characterType: character.type,
      age: character.age,
      characteristics: character.characteristics,
      homeworld: creation.homeworld ?? undefined,
      backgroundSkills: creation.backgroundSkills ?? [],
      pendingCascadeSkills:
        creation.state.status === 'HOMEWORLD'
          ? (creation.pendingCascadeSkills ?? [])
          : [],
      pendingTermCascadeSkills:
        creation.state.status === 'SKILLS_TRAINING'
          ? (creation.pendingCascadeSkills ?? [])
          : [],
      pendingAgingChanges: creation.characteristicChanges ?? [],
      careerPlan: careerPlanFromProjection(creation),
      completedTerms,
      musteringBenefits,
      skills: creationSkills,
      equipment: character.equipment,
      credits: character.credits,
      notes: character.notes
    })
  }
}
