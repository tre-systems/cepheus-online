import { asUserId } from '../shared/ids'
import type { GameViewer } from '../shared/viewer'
import type { RoomMembershipRole } from './private-beta-store'

export const TRUSTED_USER_ID_HEADER = 'x-cepheus-user-id'
export const TRUSTED_VIEWER_ROLE_HEADER = 'x-cepheus-viewer-role'
export const TRUSTED_ROOM_ROLE_HEADER = 'x-cepheus-room-role'
export const INTERNAL_ROOM_ADMIN_HEADER = 'x-cepheus-internal-admin'

export const viewerRoleForMembership = (
  role: RoomMembershipRole
): GameViewer['role'] => {
  switch (role) {
    case 'OWNER':
    case 'REFEREE':
      return 'REFEREE'
    case 'PLAYER':
      return 'PLAYER'
    case 'SPECTATOR':
      return 'SPECTATOR'
  }
}

export const parseTrustedViewerHeaders = (
  headers: Headers
): GameViewer | null => {
  const rawUserId = headers.get(TRUSTED_USER_ID_HEADER)
  const rawRole = headers.get(TRUSTED_VIEWER_ROLE_HEADER)
  if (!rawUserId || !rawRole) return null

  if (
    rawRole !== 'REFEREE' &&
    rawRole !== 'PLAYER' &&
    rawRole !== 'SPECTATOR'
  ) {
    return null
  }

  try {
    return {
      userId: asUserId(rawUserId),
      role: rawRole
    }
  } catch {
    return null
  }
}
