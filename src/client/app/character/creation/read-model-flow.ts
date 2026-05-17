import {
  deriveCareerTermSkillRollSummaries,
  deriveCareerTermTrainingSkillsFromFacts,
  hasProjectedCareerTermFacts
} from '../../../../shared/character-creation/term-skills.js'
import {
  deriveCharacterCreationReadModel,
  type CharacterCreationReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
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

export const completedTermsFromReadModel = (
  readModel: Pick<CharacterCreationProjectionReadModel, 'completedTerms'>
): CharacterCreationCompletedTerm[] =>
  readModel.completedTerms.map((term) => ({
    career: term.career,
    drafted: term.drafted,
    anagathics: term.anagathics,
    anagathicsCost: term.anagathicsCost,
    age: term.age,
    rank: term.rank,
    rankTitle: term.rankTitle,
    rankBonusSkill: term.rankBonusSkill,
    qualificationRoll: term.qualificationRoll,
    survivalRoll: term.survivalRoll,
    survivalPassed: term.survivalPassed,
    canCommission: term.canCommission,
    commissionRoll: term.commissionRoll,
    commissionPassed: term.commissionPassed,
    canAdvance: term.canAdvance,
    advancementRoll: term.advancementRoll,
    advancementPassed: term.advancementPassed,
    termSkillRolls: term.termSkillRolls.map((roll) => ({ ...roll })),
    agingRoll: term.agingRoll,
    agingMessage: term.agingMessage,
    benefitForfeiture: term.benefitForfeiture,
    reenlistmentRoll: term.reenlistmentRoll,
    reenlistmentOutcome:
      term.reenlistmentOutcome === 'unresolved'
        ? null
        : term.reenlistmentOutcome
  }))

export const completedTermsForFlow = ({
  projectionReadModel,
  characterReadModel,
  flow
}: {
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  flow: CharacterCreationFlow
}): CharacterCreationCompletedTerm[] => {
  const readModel = projectionReadModel ?? characterReadModel
  return readModel
    ? completedTermsFromReadModel(readModel)
    : flow.draft.completedTerms
}

export const failedQualificationCareerPlan = (
  projectedCreation: CharacterCreationProjection
): CharacterCreationCareerPlan | null => {
  const failedQualification = projectedCreation.failedQualification
  if (!failedQualification || failedQualification.passed) return null

  return {
    career: failedQualification.career,
    qualificationRoll: failedQualification.qualification.total,
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
  }
}

export const activeTermCareerPlan = (
  readModel: CharacterCreationReadModel
): CharacterCreationCareerPlan | null => {
  const term = readModel.activeTerm
  if (!term) return null
  const qualification = term.facts?.qualification
  const survival = term.facts?.survival
  const commission = term.facts?.commission
  const advancement = term.facts?.advancement
  const aging = term.facts?.aging

  return {
    career: term.career,
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
    drafted: term.facts?.draft !== undefined || term.draft !== undefined,
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
    termSkillRolls: deriveCareerTermSkillRollSummaries(term),
    anagathics: term.facts?.anagathicsDecision?.useAnagathics ?? null,
    agingRoll: aging?.roll.total ?? null,
    agingMessage:
      (aging?.characteristicChanges.length ?? 0) > 0
        ? `${aging?.characteristicChanges.length ?? 0} characteristic changes`
        : aging
          ? 'No aging effects.'
          : null,
    agingSelections:
      term.facts?.agingLosses?.selectedLosses.map((selection) => ({
        type: selection.type,
        modifier: selection.modifier,
        characteristic: selection.characteristic
      })) ?? [],
    benefitForfeiture: term.facts?.mishap?.outcome.benefitEffect ?? null,
    reenlistmentRoll: term.facts?.reenlistment?.reenlistment.total ?? null,
    reenlistmentOutcome: term.facts?.reenlistment?.outcome ?? null
  }
}

export const activeCreationStep = (
  readModel: CharacterCreationReadModel
): CharacterCreationStep =>
  readModel.status === 'MUSTERING_OUT' ? 'equipment' : readModel.step

export const musteringBenefitsFromReadModel = (
  readModel: CharacterCreationProjectionReadModel
): CharacterCreationMusteringBenefit[] =>
  readModel.terms.flatMap((term) =>
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

export const pendingAgingChangesFromReadModel = (
  readModel: CharacterCreationReadModel
): CharacterCreationProjection['characteristicChanges'] => {
  if (readModel.activeTerm?.facts?.agingLosses) return []
  if (readModel.characteristicChanges.length > 0) {
    return readModel.characteristicChanges
  }
  return readModel.activeTerm?.facts?.aging?.characteristicChanges ?? []
}

export const projectedTermTrainingSkills = (
  readModel: CharacterCreationProjectionReadModel
): string[] =>
  readModel.terms.flatMap((term) =>
    hasProjectedCareerTermFacts(term)
      ? deriveCareerTermTrainingSkillsFromFacts(term)
      : []
  )

export const flowFromReadModel = ({
  readModel,
  projectedCreation,
  step,
  ruleset
}: {
  readModel: CharacterCreationReadModel
  projectedCreation: CharacterCreationProjection
  step: CharacterCreationStep
  ruleset?: CepheusRuleset | null
}): CharacterCreationFlow => ({
  step,
  draft: createInitialCharacterDraft(
    readModel.characterId,
    {
      name: readModel.name,
      age: readModel.sheet.age,
      characteristics: readModel.sheet.characteristics,
      homeworld: projectedCreation.homeworld ?? undefined,
      backgroundSkills: readModel.backgroundSkills,
      pendingCascadeSkills:
        readModel.status === 'HOMEWORLD' ? readModel.pendingCascadeSkills : [],
      pendingTermCascadeSkills:
        readModel.status === 'SKILLS_TRAINING'
          ? readModel.pendingCascadeSkills
          : [],
      pendingAgingChanges: pendingAgingChangesFromReadModel(readModel),
      careerPlan:
        readModel.status === 'CAREER_SELECTION'
          ? failedQualificationCareerPlan(projectedCreation)
          : activeTermCareerPlan(readModel),
      completedTerms: completedTermsFromReadModel(readModel),
      musteringBenefits: musteringBenefitsFromReadModel(readModel),
      skills: normalizeSkillList([
        ...readModel.sheet.skills,
        ...projectedTermTrainingSkills(readModel)
      ]),
      equipment: readModel.sheet.equipment,
      credits: readModel.sheet.credits
    },
    ruleset ? { ruleset } : {}
  )
})

export const flowFromProjectedCharacterReadModel = (
  character: CharacterState
): CharacterCreationFlow | null => {
  if (!character.creation) return null
  const readModel = deriveCharacterCreationReadModel(character)
  if (!readModel) return null

  return flowFromReadModel({
    readModel,
    projectedCreation: character.creation,
    step: activeCreationStep(readModel)
  })
}
