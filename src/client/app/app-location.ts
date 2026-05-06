import { buildRoomPath, buildViewerSocketQuery } from './room-api.js'

export interface AppLocationIdentity {
  roomId: string
  actorId: string
  viewerRole: string
}

export interface AppLocationDefaults {
  roomId: string
  actorId: string
  viewerRole: string
}

export interface RoomUrlIdentity {
  roomId: string
  actorId: string
}

export interface RoomWebSocketUrlOptions extends AppLocationIdentity {
  protocol: string
  host: string
  actorSessionSecret: string
}

export const DEFAULT_APP_LOCATION: AppLocationDefaults = {
  roomId: 'demo-room',
  actorId: 'local-user',
  viewerRole: 'referee'
}

export const resolveAppLocationIdentity = (
  search: string | URLSearchParams,
  defaults: AppLocationDefaults = DEFAULT_APP_LOCATION
): AppLocationIdentity => {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search

  return {
    roomId: params.get('game') || defaults.roomId,
    actorId: params.get('user') || defaults.actorId,
    viewerRole: params.get('viewer') || defaults.viewerRole
  }
}

export const isRefereeViewer = (viewerRole: string): boolean =>
  viewerRole.toLowerCase() === 'referee'

export const buildRoomUrl = (
  href: string | URL,
  identity: RoomUrlIdentity
): URL => {
  const nextUrl = new URL(href)
  nextUrl.searchParams.set('game', identity.roomId)
  nextUrl.searchParams.set('user', identity.actorId)
  return nextUrl
}

export const buildRoomWebSocketUrl = ({
  protocol,
  host,
  roomId,
  viewerRole,
  actorId,
  actorSessionSecret
}: RoomWebSocketUrlOptions): string => {
  const socketProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return (
    socketProtocol +
    '//' +
    host +
    buildRoomPath(roomId) +
    '/ws' +
    buildViewerSocketQuery(viewerRole, actorId, actorSessionSecret)
  )
}
