import type {
  CareerCreationStatus,
  CareerTerm
} from '../../../../shared/character-creation/types'
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
    survivalRoll: facts?.survival?.survival.total ?? term.survival ?? null,
    survivalPassed:
      facts?.survival?.passed ?? (term.survival == null ? true : term.complete),
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
        : (advancement?.advancement.total ?? term.advancement ?? null),
    advancementPassed:
      advancement?.skipped === true ? false : (advancement?.passed ?? null),
    termSkillRolls:
      facts?.termSkillRolls?.map((termSkill) => ({
        table: termSkill.table,
        roll: termSkill.roll.total,
        skill: termSkill.skill ?? termSkill.rawSkill
      })) ??
      term.skillsAndTraining.map((skill) => ({
        table: 'serviceSkills',
        roll: 0,
        skill
      })),
    reenlistmentRoll:
      facts?.reenlistment?.reenlistment.total ?? term.reEnlistment ?? null,
    reenlistmentOutcome:
      facts?.reenlistment?.outcome ?? (term.canReenlist ? 'allowed' : 'blocked')
  }
}

export const careerPlanFromProjection = (
  creation: CharacterCreationProjection
): CharacterCreationCareerPlan | null => {
  const activeTerm = [...creation.terms]
    .reverse()
    .find((term) => !term.complete && !term.musteringOut)
  if (!activeTerm) return null

  const facts = activeTerm.facts
  const commission = facts?.commission
  const advancement = facts?.advancement
  const agingFact = facts?.aging

  return {
    career: activeTerm.career,
    qualificationRoll: facts?.qualification?.qualification.total ?? null,
    qualificationPassed: facts?.qualification?.passed ?? true,
    survivalRoll:
      facts?.survival?.survival.total ?? activeTerm.survival ?? null,
    survivalPassed: facts?.survival?.passed ?? null,
    commissionRoll:
      commission?.skipped === true
        ? -1
        : (commission?.commission.total ?? null),
    commissionPassed:
      commission?.skipped === true ? false : (commission?.passed ?? null),
    advancementRoll:
      advancement?.skipped === true
        ? -1
        : (advancement?.advancement.total ?? activeTerm.advancement ?? null),
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
        skill: termSkill.skill ?? termSkill.rawSkill
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
    reenlistmentRoll:
      facts?.reenlistment?.reenlistment.total ??
      activeTerm.reEnlistment ??
      null,
    reenlistmentOutcome: facts?.reenlistment?.outcome ?? null
  }
}

const isCashMusteringBenefitValue = (value: string): boolean =>
  /^\d+$/.test(value.trim())

const musteringBenefitsFromProjectedTerms = (
  creation: CharacterCreationProjection
): CharacterCreationMusteringBenefit[] =>
  creation.terms.flatMap((term) =>
    term.benefits.map((value) => {
      const isCash = isCashMusteringBenefitValue(value)

      return {
        career: term.career,
        kind: isCash ? 'cash' : 'material',
        roll: 0,
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
      value: benefit.value,
      credits: benefit.credits
    }))
  )

  return benefits.length > 0
    ? benefits
    : musteringBenefitsFromProjectedTerms(creation)
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
    ...creation.terms.flatMap((term) => term.skillsAndTraining)
  ])

  const step =
    creation.state.status === 'MUSTERING_OUT' && musteringBenefits.length > 0
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
