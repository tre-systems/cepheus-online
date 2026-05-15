import type {
  CareerCreationStatus,
  CareerTermQualificationFact,
  CareerTerm
} from '../../../../shared/character-creation/types'
import {
  deriveCareerTermSkillRollSummaries,
  deriveCareerTermTrainingSkillsFromFacts,
  hasProjectedCareerTermFacts
} from '../../../../shared/character-creation/term-skills.js'
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
): CharacterCreationStep =>
  status === 'MUSTERING_OUT'
    ? 'equipment'
    : characterCreationStepFromStatus(status)

export const completedTermFromProjection = (
  term: CareerTerm
): CharacterCreationCompletedTerm => {
  if (hasProjectedCareerTermFacts(term)) {
    return completedTermFromSemanticFacts(term)
  }
  return legacyCompletedTermFromAggregate(term)
}

const termSkillRollsFromFacts = (
  term: CareerTerm
): CharacterCreationCompletedTerm['termSkillRolls'] =>
  deriveCareerTermSkillRollSummaries(term)

const creationSkillsFromTerm = (term: CareerTerm): string[] => {
  if (hasProjectedCareerTermFacts(term)) {
    return deriveCareerTermTrainingSkillsFromFacts(term)
  }
  return term.skillsAndTraining
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
    drafted: facts?.draft !== undefined,
    anagathics: facts?.anagathicsDecision?.useAnagathics ?? false,
    anagathicsCost: facts?.anagathicsDecision?.cost ?? null,
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
    ...(facts?.mishap?.outcome.benefitEffect
      ? { benefitForfeiture: facts.mishap.outcome.benefitEffect }
      : {}),
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
): CharacterCreationCareerPlan => {
  const facts = activeTerm.facts
  const qualification = facts?.qualification
  const survival = facts?.survival
  const commission = facts?.commission
  const advancement = facts?.advancement
  const aging = facts?.aging

  return {
    career: activeTerm.career,
    qualificationRoll: qualification?.qualification.total ?? null,
    qualificationPassed: qualification?.passed ?? true,
    survivalRoll: survival?.survival.total ?? null,
    survivalPassed: survival?.passed ?? null,
    commissionRoll:
      commission?.skipped === true
        ? -1
        : (commission?.commission.total ?? null),
    commissionPassed:
      commission?.skipped === true ? false : (commission?.passed ?? null),
    advancementRoll:
      advancement?.skipped === true
        ? -1
        : (advancement?.advancement.total ?? null),
    advancementPassed:
      advancement?.skipped === true ? false : (advancement?.passed ?? null),
    canCommission: survival?.canCommission ?? null,
    canAdvance: survival?.canAdvance ?? null,
    drafted: facts?.draft !== undefined,
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
    termSkillRolls: termSkillRollsFromFacts(activeTerm),
    anagathics: facts?.anagathicsDecision?.useAnagathics ?? null,
    agingRoll: aging?.roll?.total ?? null,
    agingMessage:
      (aging?.characteristicChanges?.length ?? 0) > 0
        ? `${aging?.characteristicChanges?.length ?? 0} characteristic changes`
        : aging
          ? 'No aging effects.'
          : null,
    agingSelections: [],
    reenlistmentRoll: facts?.reenlistment?.reenlistment.total ?? null,
    reenlistmentOutcome: facts?.reenlistment?.outcome ?? null
  }
}

const failedQualificationCareerPlan = (
  qualification: CareerTermQualificationFact
): CharacterCreationCareerPlan => ({
  career: qualification.career,
  qualificationRoll: qualification.qualification.total,
  qualificationPassed: false,
  survivalRoll: null,
  survivalPassed: null,
  commissionRoll: null,
  commissionPassed: null,
  advancementRoll: null,
  advancementPassed: null,
  canCommission: null,
  canAdvance: null,
  drafted: false,
  rank: null,
  rankTitle: null,
  rankBonusSkill: null,
  termSkillRolls: [],
  anagathics: null,
  agingRoll: null,
  agingMessage: null,
  agingSelections: [],
  reenlistmentRoll: null,
  reenlistmentOutcome: null
})

export const careerPlanFromProjection = (
  creation: CharacterCreationProjection
): CharacterCreationCareerPlan | null => {
  const activeTerm = activeTermFromProjection(creation)
  if (!activeTerm) {
    return creation.failedQualification
      ? failedQualificationCareerPlan(creation.failedQualification)
      : null
  }

  const facts = activeTerm.facts
  if (hasProjectedCareerTermFacts(activeTerm)) {
    return semanticCareerPlanFromFacts(activeTerm)
  }

  const legacyFields = legacyCareerPlanFromAggregate(activeTerm)

  return {
    career: activeTerm.career,
    qualificationRoll: facts?.qualification?.qualification.total ?? null,
    qualificationPassed: facts?.qualification?.passed ?? true,
    survivalRoll: legacyFields.survivalRoll,
    survivalPassed: facts?.survival?.passed ?? null,
    commissionRoll:
      facts?.commission?.skipped === true
        ? -1
        : (facts?.commission?.commission.total ?? null),
    commissionPassed:
      facts?.commission?.skipped === true
        ? false
        : (facts?.commission?.passed ?? null),
    advancementRoll: legacyFields.advancementRoll,
    advancementPassed:
      facts?.advancement?.skipped === true
        ? false
        : (facts?.advancement?.passed ?? null),
    canCommission: creation.state.context?.canCommission ?? null,
    canAdvance: creation.state.context?.canAdvance ?? null,
    drafted: activeTerm.draft === 1,
    rank:
      facts?.advancement && !facts.advancement.skipped
        ? (facts.advancement.rank?.newRank ?? null)
        : null,
    rankTitle:
      facts?.advancement && !facts.advancement.skipped
        ? (facts.advancement.rank?.title ?? null)
        : null,
    rankBonusSkill:
      facts?.advancement && !facts.advancement.skipped
        ? (facts.advancement.rank?.bonusSkill ?? null)
        : null,
    termSkillRolls: termSkillRollsFromFacts(activeTerm),
    anagathics:
      facts?.anagathicsDecision?.useAnagathics ??
      (creation.state.status === 'AGING' && !facts?.aging
        ? null
        : activeTerm.anagathics),
    agingRoll: facts?.aging?.roll?.total ?? null,
    agingMessage:
      (facts?.aging?.characteristicChanges?.length ?? 0) > 0
        ? `${facts?.aging?.characteristicChanges?.length ?? 0} characteristic changes`
        : facts?.aging
          ? 'No aging effects.'
          : null,
    agingSelections: [],
    reenlistmentRoll: legacyFields.reenlistmentRoll,
    reenlistmentOutcome: legacyFields.reenlistmentOutcome
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
  const hasProjectedTermFacts = creation.terms.some(hasProjectedCareerTermFacts)
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

  if (benefits.length > 0 || hasProjectedTermFacts) return benefits
  return legacyMusteringBenefitsFromProjectedTerms(creation)
}

// Compatibility adapter for the current wizard renderer. New UI/rules logic
// should consume CharacterCreationReadModel and projected legal actions instead
// of reconstructing mutable draft flow from the server projection.
export const legacyFlowFromProjectedCharacter = (
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
