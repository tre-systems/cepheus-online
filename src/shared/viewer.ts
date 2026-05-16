import {
  type CepheusRuleset,
  resolveRulesetReference
} from './character-creation/cepheus-srd-ruleset'
import { deriveUnrevealedCreationRollIds } from './character-creation/reveal'
import type {
  CareerCreationActionPlan,
  CareerCreationBenefitFact,
  CareerCreationEvent,
  CareerCreationStatus,
  CareerCreationTermSkillFact,
  CareerTerm
} from './characterCreation'
import {
  deriveCareerCreationActionPlan,
  deriveMaterialBenefitEffect
} from './characterCreation'
import type { UserId } from './ids'
import {
  type CharacterCreationActivityDescriptor,
  deriveCharacterCreationActivityRevealAt,
  type LiveActivityDescriptor
} from './live-activity'
import type {
  CharacteristicKey,
  CharacterState,
  GameState,
  PieceState,
  PlayerState
} from './state'

export type ViewerRole = PlayerState['role']

export interface GameViewer {
  userId: UserId | null
  role: ViewerRole
}

export interface ViewerFilterOptions {
  nowMs?: number
}

const isPieceVisibleToRole = (piece: PieceState, role: ViewerRole): boolean => {
  if (role === 'REFEREE') return true
  if (role === 'SPECTATOR') return piece.visibility === 'VISIBLE'

  return piece.visibility !== 'HIDDEN'
}

const canViewerSeeUnrevealedDice = (
  state: Pick<GameState, 'ownerId'>,
  viewer: GameViewer
): boolean => {
  void state
  void viewer

  return false
}

const hasRevealDependentCreationDetails = (
  activity: CharacterCreationActivityDescriptor
): boolean => activity.reveal !== undefined

const isFutureCharacterCreationReveal = (
  activity: CharacterCreationActivityDescriptor,
  nowMs: number
): boolean =>
  Date.parse(deriveCharacterCreationActivityRevealAt(activity)) > nowMs

const redactCharacterCreationActivity = (
  activity: CharacterCreationActivityDescriptor
): CharacterCreationActivityDescriptor => {
  const { details: _details, ...redacted } = activity
  void _details

  return {
    ...redacted,
    transition: 'PENDING_REVEAL',
    status: 'ACTIVE',
    creationComplete: false,
    ...(activity.reveal ? { reveal: structuredClone(activity.reveal) } : {})
  }
}

const unrevealedDiceRollIds = (
  state: GameState,
  nowMs: number
): Set<string> => {
  const hiddenRollIds = new Set(
    state.diceLog
      .filter((roll) => Date.parse(roll.revealAt) > nowMs)
      .map((roll) => roll.id)
  )

  for (const character of Object.values(state.characters)) {
    if (!character.creation) continue
    for (const rollId of deriveUnrevealedCreationRollIds(
      character.creation,
      state.diceLog,
      nowMs
    )) {
      hiddenRollIds.add(rollId)
    }
  }

  return hiddenRollIds
}

const hasUnrevealedRollFact = (
  fact: object | null | undefined,
  unrevealedRollIds: ReadonlySet<string>
): boolean =>
  Boolean(
    fact &&
      'rollEventId' in fact &&
      typeof fact.rollEventId === 'string' &&
      unrevealedRollIds.has(fact.rollEventId)
  )

const visibleTermSkillFacts = (
  term: CareerTerm,
  unrevealedRollIds: ReadonlySet<string>
): CareerCreationTermSkillFact[] =>
  (term.facts?.termSkillRolls ?? []).filter(
    (fact) => !hasUnrevealedRollFact(fact, unrevealedRollIds)
  )

const visibleSkillFromTermSkillFact = (
  fact: CareerCreationTermSkillFact
): string | null => fact.skill ?? fact.pendingCascadeSkill ?? null

const redactTermSkillSheetEffect = (
  character: CharacterState,
  fact: CareerCreationTermSkillFact
): void => {
  const skill = visibleSkillFromTermSkillFact(fact)
  if (skill) {
    character.skills = character.skills.filter(
      (candidate) => candidate !== skill
    )
  }

  if (!fact.characteristic) return

  const current = character.characteristics[fact.characteristic.key]
  if (current === null) return

  character.characteristics[fact.characteristic.key] =
    current - fact.characteristic.modifier
}

const redactCharacteristicPatchEffect = (
  character: CharacterState,
  patch:
    | Partial<Record<CharacteristicKey, number | null | undefined>>
    | null
    | undefined,
  losses: readonly { characteristic: CharacteristicKey; modifier: number }[]
): void => {
  for (const loss of losses) {
    const current = character.characteristics[loss.characteristic]
    if (current === null) continue

    character.characteristics[loss.characteristic] = current - loss.modifier
  }

  for (const [key, value] of Object.entries(patch ?? {}) as Array<
    [CharacteristicKey, number | null | undefined]
  >) {
    if (value === null || value === undefined) continue
    const current = character.characteristics[key]
    if (current !== value) continue
    const loss = losses.find((candidate) => candidate.characteristic === key)
    if (loss || current === null) continue

    character.characteristics[key] = null
  }
}

const redactAgingSheetEffect = (
  character: CharacterState,
  age: number | null | undefined
): void => {
  if (typeof age === 'number' && character.age !== null) {
    character.age = Math.max(18, character.age - 4)
  }

  if (character.creation) {
    character.creation.characteristicChanges = []
    character.creation.pendingDecisions = (
      character.creation.pendingDecisions ?? []
    ).filter((decision) => decision.key !== 'agingResolution')
    if (character.creation.pendingDecisions.length === 0) {
      delete character.creation.pendingDecisions
    }
  }
}

const redactAnagathicsSheetEffect = (
  character: CharacterState,
  term: CareerTerm,
  cost: number | undefined
): void => {
  term.anagathics = false
  if (cost !== undefined) {
    character.credits += cost
  }
  delete (term as unknown as { anagathicsCost?: number }).anagathicsCost

  if (character.creation) {
    character.creation.pendingDecisions = (
      character.creation.pendingDecisions ?? []
    ).filter((decision) => decision.key !== 'anagathicsDecision')
    if (character.creation.pendingDecisions.length === 0) {
      delete character.creation.pendingDecisions
    }
  }
}

const redactMishapSheetEffect = (
  character: CharacterState,
  term: CareerTerm,
  fact: NonNullable<CareerTerm['facts']>['mishap']
): void => {
  if (!fact) return

  if (fact.outcome.debtCredits > 0) {
    character.credits += fact.outcome.debtCredits
  }
  if (fact.outcome.extraServiceYears > 0 && character.age !== null) {
    character.age = Math.max(18, character.age - fact.outcome.extraServiceYears)
  }

  term.complete = false
  term.musteringOut = false
  term.canReenlist = true

  if (character.creation) {
    character.creation.pendingDecisions = (
      character.creation.pendingDecisions ?? []
    ).filter((decision) => decision.key !== 'mishapResolution')
    if (character.creation.pendingDecisions.length === 0) {
      delete character.creation.pendingDecisions
    }
  }
}

const redactMishapProgress = (character: CharacterState): void => {
  if (!character.creation) return

  character.creation.state = {
    ...character.creation.state,
    status: 'MISHAP'
  }
  delete character.creation.pendingDecisions
  delete character.creation.actionPlan
}

const redactInjurySheetEffect = (
  character: CharacterState,
  fact: NonNullable<CareerTerm['facts']>['injury']
): void => {
  if (!fact) return

  redactCharacteristicPatchEffect(
    character,
    fact.characteristicPatch,
    fact.selectedLosses
  )

  if (character.creation) {
    character.creation.pendingDecisions = (
      character.creation.pendingDecisions ?? []
    ).filter((decision) => decision.key !== 'injuryResolution')
    if (character.creation.pendingDecisions.length === 0) {
      delete character.creation.pendingDecisions
    }
  }
}

const redactInjuryProgress = (character: CharacterState): void => {
  if (!character.creation) return

  character.creation.state = {
    ...character.creation.state,
    status: 'MISHAP'
  }
  character.creation.pendingDecisions = [{ key: 'injuryResolution' }]
  delete character.creation.actionPlan
}

const redactAdvancementSheetEffect = (
  character: CharacterState,
  rank: NonNullable<
    Extract<NonNullable<CareerTerm['facts']>['advancement'], { skipped: false }>
  >['rank']
): void => {
  if (!rank || !character.creation) return

  character.creation.careers = character.creation.careers.map((career) =>
    career.name === rank.career
      ? { ...career, rank: rank.previousRank }
      : career
  )
}

const redactCreationProgress = (
  character: CharacterState,
  status: CareerCreationStatus
): void => {
  if (!character.creation) return

  character.creation.state = {
    ...character.creation.state,
    status
  }
  delete character.creation.actionPlan
}

const redactSurvivalProgress = (character: CharacterState): void => {
  if (!character.creation) return

  character.creation.state = {
    status: 'SURVIVAL',
    context: {
      canCommission: false,
      canAdvance: false
    }
  }
  delete character.creation.requiredTermSkillCount
  delete character.creation.pendingDecisions
  delete character.creation.actionPlan
}

const redactReenlistmentProgress = (
  character: CharacterState,
  term: CareerTerm
): void => {
  if (!character.creation) return

  character.creation.state = {
    ...character.creation.state,
    status: 'REENLISTMENT'
  }
  term.canReenlist = true
  delete character.creation.actionPlan
}

const removeProjectedCareerTerm = (
  character: CharacterState,
  termIndex: number
): void => {
  const creation = character.creation
  if (!creation) return

  const removedCareer = creation.terms[termIndex]?.career
  creation.terms = creation.terms.filter((_, index) => index !== termIndex)
  if (!removedCareer) return

  const remainingCareerTerms = creation.terms.some(
    (term) => term.career === removedCareer
  )
  if (!remainingCareerTerms) {
    creation.careers = creation.careers.filter(
      (career) => career.name !== removedCareer
    )
  }
}

const redactQualificationOutcome = (
  character: CharacterState,
  termIndex: number,
  previousCareerCount: number | undefined
): void => {
  const creation = character.creation
  if (!creation) return

  removeProjectedCareerTerm(character, termIndex)
  if (typeof previousCareerCount === 'number') {
    creation.careers = creation.careers.slice(0, previousCareerCount)
  }
  creation.failedToQualify = false
  delete creation.failedQualification
  redactCreationProgress(character, 'CAREER_SELECTION')
}

const failClosedActionPlan = ({
  state,
  pendingDecisions
}: NonNullable<CharacterState['creation']>): CareerCreationActionPlan => ({
  status: state.status,
  pendingDecisions: [...(pendingDecisions ?? [])],
  legalActions: []
})

const deriveVisibleActionPlan = (
  character: CharacterState,
  ruleset: CepheusRuleset | null
): CareerCreationActionPlan | null => {
  const creation = character.creation
  if (!creation) return null

  return ruleset
    ? deriveCareerCreationActionPlan(creation, {
        characteristics: character.characteristics,
        ruleset
      })
    : failClosedActionPlan(creation)
}

const redactDraftOutcome = (
  character: CharacterState,
  termIndex: number,
  restoreFailedQualificationFallback: boolean,
  ruleset: CepheusRuleset | null
): void => {
  const creation = character.creation
  if (!creation) return

  removeProjectedCareerTerm(character, termIndex)
  redactCreationProgress(character, 'CAREER_SELECTION')
  creation.canEnterDraft = true

  if (!restoreFailedQualificationFallback) return

  creation.failedToQualify = true
  creation.actionPlan = deriveVisibleActionPlan(character, ruleset) ?? undefined
}

const hasVisiblePrecedingQualificationResolution = (
  creation: NonNullable<CharacterState['creation']>,
  draftRollEventId: string | undefined,
  unrevealedRollIds: ReadonlySet<string>
): boolean => {
  const timeline = creation.timeline ?? []
  const draftIndex =
    draftRollEventId === undefined
      ? -1
      : timeline.findIndex(
          (entry) =>
            entry.eventType === 'CharacterCreationDraftResolved' &&
            entry.rollEventId === draftRollEventId
        )
  const precedingTimeline =
    draftIndex === -1 ? timeline : timeline.slice(0, draftIndex)
  const qualificationEntry = [...precedingTimeline]
    .reverse()
    .find(
      (entry) => entry.eventType === 'CharacterCreationQualificationResolved'
    )

  return Boolean(
    qualificationEntry &&
      (!qualificationEntry.rollEventId ||
        !unrevealedRollIds.has(qualificationEntry.rollEventId))
  )
}

const rollDependentCreationHistoryTypes = new Set<string>([
  'SELECT_CAREER',
  'SURVIVAL_PASSED',
  'SURVIVAL_FAILED',
  'COMPLETE_COMMISSION',
  'COMPLETE_ADVANCEMENT',
  'ROLL_TERM_SKILL',
  'COMPLETE_AGING',
  'DECIDE_ANAGATHICS',
  'RESOLVE_REENLISTMENT',
  'MISHAP_RESOLVED',
  'FINISH_MUSTERING'
])

const hasUnrevealedCreationTimelineRoll = (
  creation: NonNullable<CharacterState['creation']>,
  unrevealedRollIds: ReadonlySet<string>
): boolean =>
  (creation.timeline ?? []).some(
    (entry) => entry.rollEventId && unrevealedRollIds.has(entry.rollEventId)
  )

const visibleCreationHistory = (
  creation: NonNullable<CharacterState['creation']>,
  unrevealedRollIds: ReadonlySet<string>
): CareerCreationEvent[] => {
  if (!hasUnrevealedCreationTimelineRoll(creation, unrevealedRollIds)) {
    return creation.history ?? []
  }

  return (creation.history ?? []).filter(
    (entry) => !rollDependentCreationHistoryTypes.has(entry.type)
  )
}

const redactMusteringBenefitSheetEffect = (
  character: CharacterState,
  fact: CareerCreationBenefitFact
): void => {
  if (fact.kind === 'cash') {
    character.credits -= fact.credits
    return
  }

  const effect = deriveMaterialBenefitEffect(fact.value)
  if (effect.kind === 'characteristic') {
    const current = character.characteristics[effect.characteristic]
    if (current !== null) {
      character.characteristics[effect.characteristic] =
        current - effect.modifier
    }
    return
  }

  if (effect.kind === 'equipment') {
    character.equipment = character.equipment.filter(
      (item) =>
        !(
          item.name === effect.item &&
          item.notes === `Mustering benefit: ${fact.career}`
        )
    )
  }
}

const redactFinalizedTermOutcomeNotes = (
  character: CharacterState,
  hiddenTermNumbers: ReadonlySet<number>
): void => {
  if (
    hiddenTermNumbers.size === 0 ||
    !character.creation?.creationComplete ||
    !character.notes
  ) {
    return
  }

  character.notes = character.notes
    .split('\n')
    .filter((line) => {
      const termMatch = /^Term (\d+): .+, (survived|mishap)\.$/.exec(
        line.trim()
      )
      return !termMatch || !hiddenTermNumbers.has(Number(termMatch[1]))
    })
    .join('\n')
}

const redactUnrevealedCreationFacts = (
  character: CharacterState,
  unrevealedRollIds: ReadonlySet<string>,
  ruleset: CepheusRuleset | null
): void => {
  const creation = character.creation
  if (!creation || unrevealedRollIds.size === 0) return
  const hiddenFinalizedTermNoteNumbers = new Set<number>()

  if (creation.history) {
    const history = visibleCreationHistory(creation, unrevealedRollIds)
    if (history.length === 0) {
      delete creation.history
    } else {
      creation.history = history
    }
  }

  if (creation.characteristicRolls) {
    for (const [characteristic, fact] of Object.entries(
      creation.characteristicRolls
    ) as Array<[CharacteristicKey, { rollEventId?: string; value: number }]>) {
      if (hasUnrevealedRollFact(fact, unrevealedRollIds)) {
        character.characteristics[characteristic] = null
        delete creation.characteristicRolls[characteristic]
      }
    }
    if (Object.keys(creation.characteristicRolls).length === 0) {
      delete creation.characteristicRolls
    }
  }

  if (hasUnrevealedRollFact(creation.failedQualification, unrevealedRollIds)) {
    creation.failedToQualify = false
    delete creation.failedQualification
    redactCreationProgress(character, 'CAREER_SELECTION')
  }

  for (const [termIndex, term] of creation.terms.entries()) {
    const facts = term.facts
    if (!facts) continue

    if (hasUnrevealedRollFact(facts.qualification, unrevealedRollIds)) {
      redactQualificationOutcome(
        character,
        termIndex,
        facts.qualification?.previousCareerCount
      )
      delete facts.qualification
    }
    if (hasUnrevealedRollFact(facts.draft, unrevealedRollIds)) {
      redactDraftOutcome(
        character,
        termIndex,
        hasVisiblePrecedingQualificationResolution(
          creation,
          facts.draft?.rollEventId,
          unrevealedRollIds
        ),
        ruleset
      )
      delete facts.draft
    }
    if (hasUnrevealedRollFact(facts.survival, unrevealedRollIds)) {
      hiddenFinalizedTermNoteNumbers.add(termIndex + 1)
      redactSurvivalProgress(character)
      delete facts.survival
      delete (term as unknown as { survival?: number }).survival
    }
    if (hasUnrevealedRollFact(facts.commission, unrevealedRollIds)) {
      redactCreationProgress(character, 'COMMISSION')
      delete facts.commission
    }
    if (hasUnrevealedRollFact(facts.advancement, unrevealedRollIds)) {
      redactCreationProgress(character, 'ADVANCEMENT')
      if (facts.advancement && !facts.advancement.skipped) {
        redactAdvancementSheetEffect(character, facts.advancement.rank)
      }
      delete facts.advancement
      delete (term as unknown as { advancement?: number }).advancement
    }
    if (hasUnrevealedRollFact(facts.aging, unrevealedRollIds)) {
      redactCreationProgress(character, 'AGING')
      redactAgingSheetEffect(character, facts.aging?.age)
      delete facts.aging
    }
    if (hasUnrevealedRollFact(facts.anagathicsDecision, unrevealedRollIds)) {
      redactCreationProgress(character, 'AGING')
      redactAnagathicsSheetEffect(
        character,
        term,
        facts.anagathicsDecision?.cost
      )
      if (character.creation?.pendingDecisions) {
        character.creation.pendingDecisions =
          character.creation.pendingDecisions.filter(
            (decision) => decision.key !== 'mishapResolution'
          )
        if (character.creation.pendingDecisions.length === 0) {
          delete character.creation.pendingDecisions
        }
      }
      delete facts.anagathicsDecision
    }
    const hiddenMishap = hasUnrevealedRollFact(facts.mishap, unrevealedRollIds)
    if (hiddenMishap) {
      redactMishapProgress(character)
      redactMishapSheetEffect(character, term, facts.mishap)
      delete facts.mishap
    }
    if (hasUnrevealedRollFact(facts.injury, unrevealedRollIds)) {
      redactInjurySheetEffect(character, facts.injury)
      if (!hiddenMishap) {
        redactInjuryProgress(character)
      }
      delete facts.injury
    }
    if (hasUnrevealedRollFact(facts.reenlistment, unrevealedRollIds)) {
      redactReenlistmentProgress(character, term)
      delete facts.reenlistment
      delete (term as unknown as { reEnlistment?: number }).reEnlistment
    }

    if (facts.termSkillRolls) {
      const hiddenFacts = facts.termSkillRolls.filter((fact) =>
        hasUnrevealedRollFact(fact, unrevealedRollIds)
      )
      for (const fact of hiddenFacts) {
        redactTermSkillSheetEffect(character, fact)
      }
      const visibleFacts = visibleTermSkillFacts(term, unrevealedRollIds)
      if (
        hiddenFacts.length > 0 &&
        visibleFacts.length < (creation.requiredTermSkillCount ?? 1)
      ) {
        redactCreationProgress(character, 'SKILLS_TRAINING')
      }
      if (visibleFacts.length === 0) {
        delete facts.termSkillRolls
      } else {
        facts.termSkillRolls = visibleFacts
      }
      const hiddenPendingCascadeSkills = new Set(
        hiddenFacts.flatMap((fact) =>
          fact.pendingCascadeSkill ? [fact.pendingCascadeSkill] : []
        )
      )
      if (hiddenPendingCascadeSkills.size > 0) {
        creation.pendingCascadeSkills = (
          creation.pendingCascadeSkills ?? []
        ).filter((skill) => !hiddenPendingCascadeSkills.has(skill))
        if (creation.pendingCascadeSkills.length === 0) {
          delete creation.pendingCascadeSkills
        }
      }
      const visibleFactSkills = visibleFacts.flatMap((fact) => {
        const skill = visibleSkillFromTermSkillFact(fact)
        return skill ? [skill] : []
      })
      term.skills = [...visibleFactSkills]
      term.skillsAndTraining = [
        ...(facts.basicTrainingSkills ?? []),
        ...visibleFactSkills
      ]
    }

    if (facts.musteringBenefits) {
      const hiddenFacts = facts.musteringBenefits.filter((fact) =>
        hasUnrevealedRollFact(fact, unrevealedRollIds)
      )
      if (hiddenFacts.length > 0) {
        redactCreationProgress(character, 'MUSTERING_OUT')
      }
      const hiddenBenefitValues = new Set(hiddenFacts.map((fact) => fact.value))
      for (const fact of hiddenFacts) {
        redactMusteringBenefitSheetEffect(character, fact)
      }
      facts.musteringBenefits = facts.musteringBenefits.filter(
        (fact) => !hasUnrevealedRollFact(fact, unrevealedRollIds)
      )
      if (facts.musteringBenefits.length === 0) delete facts.musteringBenefits
      if (hiddenBenefitValues.size > 0) {
        term.benefits = term.benefits.filter(
          (benefit) => !hiddenBenefitValues.has(benefit)
        )
      }
    }
  }

  redactFinalizedTermOutcomeNotes(character, hiddenFinalizedTermNoteNumbers)
}

export const resolveViewerForState = (
  state: GameState,
  viewer: GameViewer
): GameViewer => {
  if (!viewer.userId) return viewer

  const player = state.players[viewer.userId]
  if (!player) return viewer

  return {
    userId: viewer.userId,
    role: player.role
  }
}

export const isActorRefereeOrOwner = (
  state: Pick<GameState, 'ownerId' | 'players'> | null | undefined,
  actorId: UserId | null | undefined
): boolean =>
  Boolean(
    state &&
      actorId &&
      (state.ownerId === actorId || state.players[actorId]?.role === 'REFEREE')
  )

const filterPiecesForViewer = (
  filtered: GameState,
  resolvedViewer: GameViewer
): void => {
  filtered.pieces = Object.fromEntries(
    Object.entries(filtered.pieces).filter(([, piece]) =>
      isPieceVisibleToRole(piece, resolvedViewer.role)
    )
  )
}

const filterUnrevealedDiceForViewer = (
  filtered: GameState,
  nowMs: number
): Set<string> => {
  const unrevealedRollIds = unrevealedDiceRollIds(filtered, nowMs)
  for (const roll of filtered.diceLog) {
    if (Date.parse(roll.revealAt) <= nowMs) continue
    delete (roll as unknown as Record<string, unknown>).rolls
    delete (roll as unknown as Record<string, unknown>).total
  }

  return unrevealedRollIds
}

const filterCharacterCreationForViewer = (
  filtered: GameState,
  unrevealedRollIds: ReadonlySet<string>,
  ruleset: CepheusRuleset | null
): void => {
  for (const character of Object.values(filtered.characters)) {
    redactUnrevealedCreationFacts(character, unrevealedRollIds, ruleset)
  }
}

export const toViewerGameState = (
  state: GameState,
  viewer: GameViewer,
  { nowMs = Date.now() }: ViewerFilterOptions = {}
): GameState => {
  const resolvedViewer = resolveViewerForState(state, viewer)
  const filtered = structuredClone(state)

  filterPiecesForViewer(filtered, resolvedViewer)

  if (!canViewerSeeUnrevealedDice(state, resolvedViewer)) {
    const unrevealedRollIds = filterUnrevealedDiceForViewer(filtered, nowMs)
    const resolvedRuleset = resolveRulesetReference(state.rulesetId)
    const ruleset = resolvedRuleset.ok ? resolvedRuleset.value.ruleset : null
    filterCharacterCreationForViewer(filtered, unrevealedRollIds, ruleset)
  }

  return filtered
}

export const filterGameStateForViewer = toViewerGameState

export const filterLiveActivitiesForViewer = (
  activities: readonly LiveActivityDescriptor[],
  state: GameState,
  viewer: GameViewer,
  { nowMs = Date.now() }: ViewerFilterOptions = {}
): LiveActivityDescriptor[] => {
  const resolvedViewer = resolveViewerForState(state, viewer)

  return activities.map((activity) => {
    if (
      canViewerSeeUnrevealedDice(state, resolvedViewer) ||
      (activity.type === 'diceRoll' &&
        Date.parse(activity.reveal.revealAt) <= nowMs) ||
      (activity.type === 'characterCreation' &&
        (!hasRevealDependentCreationDetails(activity) ||
          !isFutureCharacterCreationReveal(activity, nowMs)))
    ) {
      return activity
    }

    const filtered = structuredClone(activity)
    if (filtered.type === 'diceRoll') {
      delete (filtered as unknown as Record<string, unknown>).rolls
      delete (filtered as unknown as Record<string, unknown>).total
      delete (filtered as unknown as Record<string, unknown>).rollsOmitted
    } else {
      return redactCharacterCreationActivity(filtered)
    }

    return filtered
  })
}
