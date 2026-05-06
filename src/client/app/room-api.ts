import type { GameCommand } from '../../shared/commands'
import type { ClientMessage, ServerMessage } from '../../shared/protocol'

type FetchResponse = Pick<Response, 'json' | 'ok'>
type Fetcher = (input: string, init?: RequestInit) => Promise<FetchResponse>

export interface RoomRequestOptions {
  roomId: string
  fetch?: Fetcher
}

export interface FetchRoomStateOptions extends RoomRequestOptions {
  viewerRole: string
  actorId: string
}

export interface PostRoomCommandOptions extends RoomRequestOptions {
  requestId: string
  command: GameCommand
  actorSessionSecret: string
}

export interface CommandResponse {
  ok: boolean
  message: ServerMessage
}

const resolveFetch = (fetcher?: Fetcher): Fetcher => fetcher ?? fetch

export const buildRoomPath = (roomId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}`

export const buildViewerQuery = (viewerRole: string, actorId: string): string =>
  '?viewer=' +
  encodeURIComponent(viewerRole) +
  '&user=' +
  encodeURIComponent(actorId)

export const buildViewerSocketQuery = (
  viewerRole: string,
  actorId: string,
  actorSessionSecret: string
): string =>
  buildViewerQuery(viewerRole, actorId) +
  '&session=' +
  encodeURIComponent(actorSessionSecret)

export const buildCommandMessage = (
  requestId: string,
  command: GameCommand
): Extract<ClientMessage, { type: 'command' }> => ({
  type: 'command',
  requestId,
  command
})

export const fetchRoomState = async ({
  roomId,
  viewerRole,
  actorId,
  fetch: fetcher
}: FetchRoomStateOptions): Promise<ServerMessage> => {
  const response = await resolveFetch(fetcher)(
    `${buildRoomPath(roomId)}/state${buildViewerQuery(viewerRole, actorId)}`
  )
  return response.json() as Promise<ServerMessage>
}

export const postRoomCommand = async ({
  roomId,
  requestId,
  command,
  actorSessionSecret,
  fetch: fetcher
}: PostRoomCommandOptions): Promise<CommandResponse> => {
  const response = await resolveFetch(fetcher)(
    `${buildRoomPath(roomId)}/command`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': actorSessionSecret
      },
      body: JSON.stringify(buildCommandMessage(requestId, command))
    }
  )
  const message = (await response.json()) as ServerMessage

  return {
    ok: response.ok,
    message
  }
}
