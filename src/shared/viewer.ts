import type { UserId } from './ids'
import {
  deriveCharacterCreationActivityRevealAt,
  type CharacterCreationActivityDescriptor,
  type LiveActivityDescriptor
} from './live-activity'
import type { GameState, PlayerState, PieceState } from './state'

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
    for (const roll of filtered.diceLog) {
      if (Date.parse(roll.revealAt) <= nowMs) continue
      delete (roll as unknown as Record<string, unknown>).rolls
      delete (roll as unknown as Record<string, unknown>).total
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
