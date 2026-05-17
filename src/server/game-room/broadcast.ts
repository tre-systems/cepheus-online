import type { LiveActivityDescriptor } from '../../shared/live-activity'
import type { ServerMessage } from '../../shared/protocol'
import type { GameState } from '../../shared/state'
import {
  filterGameStateForViewer,
  filterLiveActivitiesForViewer,
  type GameViewer
} from '../../shared/viewer'
import { parseViewerRole, parseViewerUserId } from './queries'
import { resolveRoomRulesetData } from './ruleset-provider'

export const serializeMessage = (message: ServerMessage): string =>
  JSON.stringify(message)

export const viewerFromSocketTags = (tags: readonly string[]): GameViewer => {
  const roleTag = tags.find((tag) => tag.startsWith('viewer:'))
  const userTag = tags.find((tag) => tag.startsWith('user:'))
  const role = parseViewerRole(roleTag?.slice('viewer:'.length) ?? null, {
    allowReferee: true
  })
  const rawUserId = userTag?.slice('user:'.length) ?? null

  return {
    userId: parseViewerUserId(rawUserId),
    role
  }
}

export const activityPayload = (
  liveActivities: readonly LiveActivityDescriptor[],
  state: GameState,
  viewer: GameViewer
): Partial<
  Pick<Extract<ServerMessage, { type: 'roomState' }>, 'liveActivities'>
> =>
  liveActivities.length === 0
    ? {}
    : {
        liveActivities: filterLiveActivitiesForViewer(
          liveActivities,
          state,
          viewer
        )
      }

export const broadcastRoomState = ({
  sockets,
  getTags,
  send,
  state,
  liveActivities = [],
  accepted
}: {
  sockets: readonly WebSocket[]
  getTags: (socket: WebSocket) => readonly string[]
  send: (socket: WebSocket, message: ServerMessage) => void
  state: GameState
  liveActivities?: readonly LiveActivityDescriptor[]
  accepted?: {
    socket: WebSocket
    requestId: string
  }
}): void => {
  for (const socket of sockets) {
    const viewer = viewerFromSocketTags(getTags(socket))
    const filtered = filterGameStateForViewer(state, viewer, {
      resolveRulesetById: resolveRoomRulesetData
    })

    if (accepted && socket === accepted.socket) {
      send(socket, {
        type: 'commandAccepted',
        requestId: accepted.requestId,
        state: filtered,
        eventSeq: filtered.eventSeq,
        ...activityPayload(liveActivities, state, viewer)
      })
      continue
    }

    send(socket, {
      type: 'roomState',
      state: filtered,
      eventSeq: filtered.eventSeq,
      ...activityPayload(liveActivities, state, viewer)
    })
  }
}
