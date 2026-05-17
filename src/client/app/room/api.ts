import type { GameCommand } from '../../../shared/commands'
import type { ClientMessage, ServerMessage } from '../../../shared/protocol'

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

export interface AppSessionResponse {
  authenticated: boolean
  user: {
    id: string
    username: string
    avatarUrl: string | null
  } | null
  expiresAt?: string
}

export type UploadedRoomAssetKind = 'geomorph' | 'counter'

export interface UploadedRoomAsset {
  id: string
  kind: UploadedRoomAssetKind
  url: string
  width: number
  height: number
  gridScale: number
  losSidecar: unknown | null
}

export interface UploadRoomAssetOptions extends RoomRequestOptions {
  kind: UploadedRoomAssetKind
  file: File
  gridScale: number
  losSidecar?: string | null
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

export const fetchAppSession = async (
  fetcher?: Fetcher
): Promise<AppSessionResponse> => {
  const response = await resolveFetch(fetcher)('/api/session')
  return response.json() as Promise<AppSessionResponse>
}

export const listRoomAssets = async ({
  roomId,
  fetch: fetcher
}: RoomRequestOptions): Promise<UploadedRoomAsset[]> => {
  const response = await resolveFetch(fetcher)(
    `${buildRoomPath(roomId).replace('/rooms/', '/api/rooms/')}/assets`
  )
  const body = (await response.json()) as { assets?: UploadedRoomAsset[] }
  if (!response.ok) throw new Error('Could not load room assets')

  return body.assets ?? []
}

export const uploadRoomAsset = async ({
  roomId,
  kind,
  file,
  gridScale,
  losSidecar,
  fetch: fetcher
}: UploadRoomAssetOptions): Promise<UploadedRoomAsset> => {
  const form = new FormData()
  form.set('file', file)
  form.set('kind', kind)
  form.set('gridScale', String(gridScale))
  if (losSidecar?.trim()) form.set('losSidecar', losSidecar)

  const response = await resolveFetch(fetcher)(
    `${buildRoomPath(roomId).replace('/rooms/', '/api/rooms/')}/assets`,
    {
      method: 'POST',
      body: form
    }
  )
  const body = (await response.json()) as {
    asset?: UploadedRoomAsset
    error?: string
  }
  if (!response.ok || !body.asset) {
    throw new Error(body.error ?? 'Could not upload asset')
  }

  return body.asset
}
