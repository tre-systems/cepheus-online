import { asUserId, type GameId, type UserId } from '../../shared/ids'
import type { ClientMessage, ServerMessage } from '../../shared/protocol'
import type { GameState } from '../../shared/state'
import {
  filterGameStateForViewer,
  type GameViewer,
  type ViewerRole
} from '../../shared/viewer'
import type { DurableObjectStorage } from '../cloudflare'
import { parseTrustedViewerHeaders } from '../trusted-room-headers'
import { getProjectedGameState } from './projection'
import { resolveRoomRulesetData } from './ruleset-provider'
import { getEventSeq } from './storage'

const isLocalDevHost = (url: URL): boolean =>
  url.hostname === 'localhost' ||
  url.hostname === '127.0.0.1' ||
  url.hostname === '::1'

export const parseViewerRole = (
  raw: string | null,
  options: { allowReferee?: boolean } = {}
): ViewerRole => {
  switch (raw?.trim().toLowerCase()) {
    case 'referee':
    case 'gm':
      return options.allowReferee ? 'REFEREE' : 'PLAYER'
    case 'player':
      return 'PLAYER'
    default:
      return 'SPECTATOR'
  }
}

export const parseViewerUserId = (raw: string | null): UserId | null => {
  if (!raw) return null

  try {
    return asUserId(raw)
  } catch {
    return null
  }
}

export const parseViewerFromUrl = (url: URL): GameViewer => ({
  userId: parseViewerUserId(
    url.searchParams.get('userId') ?? url.searchParams.get('user')
  ),
  role: parseViewerRole(url.searchParams.get('viewer'), {
    allowReferee: isLocalDevHost(url)
  })
})

export const parseViewerFromRequest = (
  request: Request,
  url: URL
): GameViewer =>
  parseTrustedViewerHeaders(request.headers) ?? parseViewerFromUrl(url)

export const viewerFromCommand = (
  message: Extract<ClientMessage, { type: 'command' }>
): GameViewer => ({
  userId: message.command.actorId,
  role: 'PLAYER'
})

export const filterStateForViewer = (
  state: GameState | null,
  viewer: GameViewer
): GameState | null =>
  state
    ? filterGameStateForViewer(state, viewer, {
        resolveRulesetById: resolveRoomRulesetData
      })
    : null

export const buildRoomStateMessage = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  viewer: GameViewer
): Promise<ServerMessage> => {
  const state = await getProjectedGameState(storage, gameId)

  return {
    type: 'roomState',
    state: filterStateForViewer(state, viewer),
    eventSeq: state?.eventSeq ?? (await getEventSeq(storage, gameId))
  }
}
