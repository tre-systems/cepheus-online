import type {
  CareerCreationStatus,
  CareerTerm
} from '../../../../shared/character-creation/types'
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
): CharacterCreationStep => {
  switch (status) {
    case 'CHARACTERISTICS':
      return 'characteristics'
    case 'HOMEWORLD':
      return 'homeworld'
    case 'BASIC_TRAINING':
      return 'skills'
    case 'PLAYABLE':
      return 'review'
    default:
      return 'career'
  }
}

export const completedTermFromProjection = (
  term: CareerTerm
): CharacterCreationCompletedTerm => ({
  career: term.career,
  drafted: term.draft === 1,
  anagathics: term.anagathics,
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
  advancementPassed: term.advancement == null ? null : term.complete,
  termSkillRolls: term.skillsAndTraining.map((skill) => ({
    table: 'serviceSkills',
    roll: 0,
    skill
  })),
  reenlistmentRoll: term.reEnlistment ?? null,
  reenlistmentOutcome: term.canReenlist ? 'allowed' : 'blocked'
})

export const careerPlanFromProjection = (
  creation: CharacterCreationProjection
): CharacterCreationCareerPlan | null => {
  const activeTerm = [...creation.terms]
    .reverse()
    .find((term) => !term.complete && !term.musteringOut)
  if (!activeTerm) return null

  const history = creation.history ?? []
  let selectCareerIndex = -1
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].type === 'SELECT_CAREER') {
      selectCareerIndex = index
      break
    }
  }
  const currentTermHistory =
    selectCareerIndex >= 0 ? history.slice(selectCareerIndex) : history
  const selectCareer = [...currentTermHistory]
    .reverse()
    .find((event) => event.type === 'SELECT_CAREER')
  const survival = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'SURVIVAL_PASSED' || event.type === 'SURVIVAL_FAILED'
    )
  const commission = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'COMPLETE_COMMISSION' || event.type === 'SKIP_COMMISSION'
    )
  const advancement = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'COMPLETE_ADVANCEMENT' ||
        event.type === 'SKIP_ADVANCEMENT'
    )
  const aging = [...currentTermHistory]
    .reverse()
    .find((event) => event.type === 'COMPLETE_AGING')
  const anagathicsDecision = [...currentTermHistory]
    .reverse()
    .find((event) => event.type === 'DECIDE_ANAGATHICS')
  const reenlistment = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'RESOLVE_REENLISTMENT' ||
        event.type === 'REENLIST' ||
        event.type === 'REENLIST_BLOCKED' ||
        event.type === 'FORCED_REENLIST'
    )
  const termSkillRolls = currentTermHistory
    .filter((event) => event.type === 'ROLL_TERM_SKILL')
    .map((event) => ({
      table: event.termSkill.table,
      roll: event.termSkill.roll.total,
      skill: event.termSkill.skill ?? event.termSkill.rawSkill
    }))
  const agingFact = aging?.aging

  return {
    career: activeTerm.career,
    qualificationRoll: selectCareer?.qualification?.total ?? null,
    qualificationPassed: true,
    survivalRoll: survival?.survival?.total ?? activeTerm.survival ?? null,
    survivalPassed:
      survival?.type === 'SURVIVAL_PASSED'
        ? true
        : survival?.type === 'SURVIVAL_FAILED'
          ? false
          : null,
    commissionRoll:
      commission?.type === 'SKIP_COMMISSION'
        ? -1
        : (commission?.commission?.total ?? null),
    commissionPassed:
      commission?.type === 'SKIP_COMMISSION'
        ? false
        : (commission?.commission?.success ?? null),
    advancementRoll:
      advancement?.type === 'SKIP_ADVANCEMENT'
        ? -1
        : (advancement?.advancement?.total ?? activeTerm.advancement ?? null),
    advancementPassed:
      advancement?.type === 'SKIP_ADVANCEMENT'
        ? false
        : (advancement?.advancement?.success ?? null),
    canCommission: creation.state.context?.canCommission ?? null,
    canAdvance: creation.state.context?.canAdvance ?? null,
    drafted: activeTerm.draft === 1,
    rank: null,
    rankTitle: null,
    rankBonusSkill: null,
    termSkillRolls,
    anagathics:
      anagathicsDecision?.useAnagathics ??
      (creation.state.status === 'AGING' && !aging
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
      reenlistment?.reenlistment?.total ?? activeTerm.reEnlistment ?? null,
    reenlistmentOutcome:
      reenlistment?.type === 'RESOLVE_REENLISTMENT'
        ? (reenlistment.reenlistment.outcome ?? null)
        : reenlistment?.type === 'FORCED_REENLIST'
          ? 'forced'
          : reenlistment?.type === 'REENLIST'
            ? 'allowed'
            : reenlistment?.type === 'REENLIST_BLOCKED'
              ? 'blocked'
              : null
  }
}

export const flowFromProjectedCharacter = (
  character: CharacterState
): CharacterCreationFlow | null => {
  const creation = character.creation
  if (!creation) return null

  const completedTerms = creation.terms
    .filter((term) => term.complete || term.musteringOut)
    .map(completedTermFromProjection)
  const musteringBenefits: CharacterCreationMusteringBenefit[] = (
    creation.history ?? []
  )
    .filter((event) => event.type === 'FINISH_MUSTERING')
    .flatMap((event) => {
      const benefit = event.musteringBenefit
      return benefit
        ? [
            {
              career: benefit.career,
              kind: benefit.kind,
              roll: benefit.tableRoll,
              value: benefit.value,
              credits: benefit.credits
            }
          ]
        : []
    })

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
