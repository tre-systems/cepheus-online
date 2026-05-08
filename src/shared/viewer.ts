import type { UserId } from './ids'
import type { GameState, PlayerState, PieceState } from './state'

export type ViewerRole = PlayerState['role']

export interface GameViewer {
  userId: UserId | null
  role: ViewerRole
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
  viewer: GameViewer
): GameState => {
  const resolvedViewer = resolveViewerForState(state, viewer)
  const filtered = structuredClone(state)

  filtered.pieces = Object.fromEntries(
    Object.entries(filtered.pieces).filter(([, piece]) =>
      isPieceVisibleToRole(piece, resolvedViewer.role)
    )
  )

  return filtered
}
