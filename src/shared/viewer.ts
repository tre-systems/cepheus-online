import type { UserId } from './ids'
import {
  deriveCharacterCreationActivityRevealAt,
  type CharacterCreationActivityDescriptor,
  type LiveActivityDescriptor
} from './live-activity'
import type { CharacterState, GameState, PlayerState, PieceState } from './state'
import type {
  CareerCreationTermSkillFact,
  CareerTerm
} from './characterCreation'

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
): boolean => viewer.role === 'REFEREE' || viewer.userId === state.ownerId

const legacyRollDependentCreationTransitions = new Set<string>([
  'SELECT_CAREER',
  'SET_CHARACTERISTICS',
  'SURVIVAL_PASSED',
  'SURVIVAL_FAILED',
  'COMPLETE_COMMISSION',
  'COMMISSION_PASSED',
  'COMMISSION_FAILED',
  'COMPLETE_ADVANCEMENT',
  'ADVANCEMENT_PASSED',
  'ADVANCEMENT_FAILED',
  'ROLL_TERM_SKILL',
  'TERM_SKILL_ROLLED',
  'COMPLETE_AGING',
  'RESOLVE_REENLISTMENT',
  'REENLIST_FORCED',
  'REENLIST_ALLOWED',
  'REENLIST_BLOCKED',
  'FINISH_MUSTERING',
  'CAREER_QUALIFICATION_PASSED',
  'CAREER_QUALIFICATION_FAILED',
  'DRAFT_RESOLVED'
])

const hasRollDependentCreationDetails = (
  activity: CharacterCreationActivityDescriptor
): boolean =>
  activity.details !== undefined &&
  (activity.reveal !== undefined ||
    legacyRollDependentCreationTransitions.has(activity.transition))

const isFutureCharacterCreationReveal = (
  activity: CharacterCreationActivityDescriptor,
  nowMs: number
): boolean =>
  Date.parse(deriveCharacterCreationActivityRevealAt(activity)) > nowMs

const unrevealedDiceRollIds = (state: GameState, nowMs: number): Set<string> =>
  new Set(
    state.diceLog
      .filter((roll) => Date.parse(roll.revealAt) > nowMs)
      .map((roll) => roll.id)
  )

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

const redactUnrevealedCreationFacts = (
  character: CharacterState,
  unrevealedRollIds: ReadonlySet<string>
): void => {
  const creation = character.creation
  if (!creation || unrevealedRollIds.size === 0) return

  for (const term of creation.terms) {
    const facts = term.facts
    if (!facts) continue

    if (hasUnrevealedRollFact(facts.qualification, unrevealedRollIds)) {
      delete facts.qualification
    }
    if (hasUnrevealedRollFact(facts.draft, unrevealedRollIds)) {
      delete facts.draft
    }
    if (hasUnrevealedRollFact(facts.survival, unrevealedRollIds)) {
      delete facts.survival
      delete (term as unknown as { survival?: number }).survival
    }
    if (hasUnrevealedRollFact(facts.commission, unrevealedRollIds)) {
      delete facts.commission
    }
    if (hasUnrevealedRollFact(facts.advancement, unrevealedRollIds)) {
      delete facts.advancement
      delete (term as unknown as { advancement?: number }).advancement
    }
    if (hasUnrevealedRollFact(facts.aging, unrevealedRollIds)) {
      delete facts.aging
    }
    if (hasUnrevealedRollFact(facts.reenlistment, unrevealedRollIds)) {
      delete facts.reenlistment
      delete (term as unknown as { reEnlistment?: number }).reEnlistment
    }

    if (facts.termSkillRolls) {
      const hiddenFacts = facts.termSkillRolls.filter((fact) =>
        hasUnrevealedRollFact(fact, unrevealedRollIds)
      )
      const visibleFacts = visibleTermSkillFacts(term, unrevealedRollIds)
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
      const hiddenBenefitValues = new Set(
        facts.musteringBenefits
          .filter((fact) => hasUnrevealedRollFact(fact, unrevealedRollIds))
          .map((fact) => fact.value)
      )
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

export const filterGameStateForViewer = (
  state: GameState,
  viewer: GameViewer,
  { nowMs = Date.now() }: ViewerFilterOptions = {}
): GameState => {
  const resolvedViewer = resolveViewerForState(state, viewer)
  const filtered = structuredClone(state)

  filtered.pieces = Object.fromEntries(
    Object.entries(filtered.pieces).filter(([, piece]) =>
      isPieceVisibleToRole(piece, resolvedViewer.role)
    )
  )
  if (!canViewerSeeUnrevealedDice(state, resolvedViewer)) {
    const unrevealedRollIds = unrevealedDiceRollIds(state, nowMs)
    for (const roll of filtered.diceLog) {
      if (Date.parse(roll.revealAt) <= nowMs) continue
      delete (roll as unknown as Record<string, unknown>).rolls
      delete (roll as unknown as Record<string, unknown>).total
    }
    for (const character of Object.values(filtered.characters)) {
      redactUnrevealedCreationFacts(character, unrevealedRollIds)
    }
  }

  return filtered
}

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
        (!hasRollDependentCreationDetails(activity) ||
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
      delete (filtered as unknown as Record<string, unknown>).details
    }

    return filtered
  })
}
