import type { UserId } from './ids'
import type { LiveActivityDescriptor } from './live-activity'
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
  if (resolvedViewer.role !== 'REFEREE') {
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
      resolvedViewer.role === 'REFEREE' ||
      activity.type !== 'diceRoll' ||
      Date.parse(activity.reveal.revealAt) <= nowMs
    ) {
      return activity
    }

    const filtered = structuredClone(activity)
    delete (filtered as unknown as Record<string, unknown>).rolls
    delete (filtered as unknown as Record<string, unknown>).total
    delete (filtered as unknown as Record<string, unknown>).rollsOmitted

    return filtered
  })
}
