import { asGameId, type GameId } from '../../shared/ids'
import type { LiveActivityDescriptor } from '../../shared/live-activity'
import {
  decodeClientMessage,
  type ClientMessage,
  type CommandError,
  type ServerMessage
} from '../../shared/protocol'
import type { GameState } from '../../shared/state'
import { filterGameStateForViewer, type GameViewer } from '../../shared/viewer'
import type { DurableObjectState, WebSocketResponseInit } from '../cloudflare'
import type { Env } from '../env'
import { jsonResponse } from '../http'
import { CommandPublicationError, runCommandPublication } from './publication'
import {
  buildRoomStateMessage,
  parseViewerFromUrl,
  parseViewerRole,
  parseViewerUserId,
  viewerFromCommand
} from './queries'
import { getEventSeq } from './storage'

declare const WebSocketPair: {
  new (): {
    0: WebSocket
    1: WebSocket
  }
}

interface RoomRoute {
  gameId: GameId
  action: string
}

const parseRoomRoute = (url: URL): RoomRoute | null => {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'rooms' || !parts[1]) return null

  try {
    return {
      gameId: asGameId(parts[1]),
      action: parts[2] ?? ''
    }
  } catch {
    return null
  }
}

const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

const statusForError = (error: CommandError): number => {
  switch (error.code) {
    case 'game_not_found':
    case 'missing_entity':
      return 404
    case 'not_allowed':
      return 403
    case 'stale_command':
    case 'wrong_room':
    case 'game_exists':
    case 'duplicate_entity':
      return 409
    case 'projection_mismatch':
      return 500
    default:
      return 400
  }
}

const serializeMessage = (message: ServerMessage): string =>
  JSON.stringify(message)

const activityPayload = (liveActivities: readonly LiveActivityDescriptor[]) =>
  liveActivities.length === 0 ? {} : { liveActivities: [...liveActivities] }

export class GameRoomDO {
  constructor(
    private readonly state: DurableObjectState,
    _env: Env
  ) {}

  private getWebSockets(): WebSocket[] {
    return this.state.getWebSockets?.() ?? []
  }

  private getTags(socket: WebSocket): string[] {
    return this.state.getTags?.(socket) ?? []
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    socket.send(serializeMessage(message))
  }

  private viewerFromSocket(socket: WebSocket): GameViewer {
    const tags = this.getTags(socket)
    const roleTag = tags.find((tag) => tag.startsWith('viewer:'))
    const userTag = tags.find((tag) => tag.startsWith('user:'))
    const role = parseViewerRole(roleTag?.slice('viewer:'.length) ?? null)
    const rawUserId = userTag?.slice('user:'.length) ?? null

    return {
      userId: parseViewerUserId(rawUserId),
      role
    }
  }

  private gameIdFromSocket(socket: WebSocket): GameId | null {
    const gameTag = this.getTags(socket).find((tag) => tag.startsWith('game:'))
    if (!gameTag) return null

    try {
      return asGameId(gameTag.slice('game:'.length))
    } catch {
      return null
    }
  }

  private async buildRoomStateMessage(
    gameId: GameId,
    viewer: GameViewer
  ): Promise<ServerMessage> {
    return buildRoomStateMessage(this.state.storage, gameId, viewer)
  }

  private broadcastState(
    state: GameState,
    liveActivities: readonly LiveActivityDescriptor[] = [],
    accepted?: {
      socket: WebSocket
      requestId: string
    }
  ): void {
    for (const socket of this.getWebSockets()) {
      const viewer = this.viewerFromSocket(socket)
      const filtered = filterGameStateForViewer(state, viewer)

      if (accepted && socket === accepted.socket) {
        this.send(socket, {
          type: 'commandAccepted',
          requestId: accepted.requestId,
          state: filtered,
          eventSeq: filtered.eventSeq,
          ...activityPayload(liveActivities)
        })
        continue
      }

      this.send(socket, {
        type: 'roomState',
        state: filtered,
        eventSeq: filtered.eventSeq,
        ...activityPayload(liveActivities)
      })
    }
  }

  private async handleCommandMessage(
    gameId: GameId,
    message: Extract<ClientMessage, { type: 'command' }>
  ): Promise<
    | {
        ok: true
        response: ServerMessage
        state: GameState
        liveActivities: LiveActivityDescriptor[]
      }
    | {
        ok: false
        response: ServerMessage
        status: number
      }
  > {
    let publication: Awaited<ReturnType<typeof runCommandPublication>>

    try {
      publication = await runCommandPublication(
        this.state.storage,
        gameId,
        message
      )
    } catch (error) {
      if (error instanceof CommandPublicationError) {
        return {
          ok: false,
          status: 500,
          response: {
            type: 'error',
            error: commandError(error.code, error.message)
          }
        }
      }

      throw error
    }

    if (!publication.ok) {
      const eventSeq = await getEventSeq(this.state.storage, gameId)

      return {
        ok: false,
        status: statusForError(publication.error),
        response: {
          type: 'commandRejected',
          requestId: message.requestId,
          error: publication.error,
          eventSeq
        }
      }
    }

    const viewer = viewerFromCommand(message)
    const filtered = filterGameStateForViewer(publication.value.state, viewer)

    return {
      ok: true,
      state: publication.value.state,
      liveActivities: publication.value.liveActivities,
      response: {
        type: 'commandAccepted',
        requestId: publication.value.requestId,
        state: filtered,
        eventSeq: filtered.eventSeq,
        ...activityPayload(publication.value.liveActivities)
      }
    }
  }

  private async handleJsonMessage(
    raw: unknown,
    gameId: GameId
  ): Promise<
    | {
        ok: true
        message: ServerMessage
        state?: GameState
        liveActivities?: LiveActivityDescriptor[]
      }
    | {
        ok: false
        message: ServerMessage
        status: number
      }
  > {
    const decoded = decodeClientMessage(raw)

    if (!decoded.ok) {
      return {
        ok: false,
        status: statusForError(decoded.error),
        message: {
          type: 'error',
          error: decoded.error
        }
      }
    }

    if (decoded.value.type === 'ping') {
      return {
        ok: true,
        message: {
          type: 'pong',
          ...(decoded.value.requestId === undefined
            ? {}
            : { requestId: decoded.value.requestId })
        }
      }
    }

    const result = await this.handleCommandMessage(gameId, decoded.value)
    return result.ok
      ? {
          ok: true,
          message: result.response,
          state: result.state,
          liveActivities: result.liveActivities
        }
      : { ok: false, message: result.response, status: result.status }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const route = parseRoomRoute(url)

    if (!route) {
      return jsonResponse(
        {
          error: commandError('invalid_message', 'Unknown room route')
        },
        { status: 404 }
      )
    }

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      if (!this.state.acceptWebSocket) {
        return jsonResponse(
          {
            error: commandError(
              'invalid_message',
              'Durable Object WebSockets are not available'
            )
          },
          { status: 501 }
        )
      }

      const viewer = parseViewerFromUrl(url)
      const pair = new WebSocketPair()
      const client = pair[0]
      const server = pair[1]
      const tags = [`game:${route.gameId}`, `viewer:${viewer.role}`]
      if (viewer.userId) tags.push(`user:${viewer.userId}`)

      this.state.acceptWebSocket(server, tags)
      this.send(server, await this.buildRoomStateMessage(route.gameId, viewer))

      return new Response(null, {
        status: 101,
        webSocket: client
      } as WebSocketResponseInit)
    }

    if (request.method === 'GET' && route.action === 'state') {
      const viewer = parseViewerFromUrl(url)
      return jsonResponse(
        await this.buildRoomStateMessage(route.gameId, viewer)
      )
    }

    if (request.method === 'POST' && route.action === 'command') {
      let raw: unknown

      try {
        raw = await request.json()
      } catch {
        const error = commandError('invalid_message', 'Invalid JSON body')
        return jsonResponse({ type: 'error', error } satisfies ServerMessage, {
          status: 400
        })
      }

      const result = await this.handleJsonMessage(raw, route.gameId)

      if (result.ok && result.state) {
        this.broadcastState(result.state, result.liveActivities ?? [])
      }

      return jsonResponse(result.message, {
        status: result.ok ? 200 : result.status
      })
    }

    return jsonResponse(
      {
        error: commandError('invalid_message', 'Route not found')
      },
      { status: 404 }
    )
  }

  async webSocketMessage(socket: WebSocket, message: string): Promise<void> {
    let raw: unknown

    try {
      raw = JSON.parse(message)
    } catch {
      this.send(socket, {
        type: 'error',
        error: commandError('invalid_message', 'Invalid JSON message')
      })
      return
    }

    const decoded = decodeClientMessage(raw)

    if (!decoded.ok) {
      this.send(socket, {
        type: 'error',
        error: decoded.error
      })
      return
    }

    if (decoded.value.type === 'ping') {
      this.send(socket, {
        type: 'pong',
        ...(decoded.value.requestId === undefined
          ? {}
          : { requestId: decoded.value.requestId })
      })
      return
    }

    const gameId = this.gameIdFromSocket(socket)

    if (!gameId) {
      this.send(socket, {
        type: 'error',
        error: commandError(
          'invalid_message',
          'Socket is missing room identity'
        )
      })
      return
    }

    const result = await this.handleCommandMessage(gameId, decoded.value)

    if (!result.ok) {
      this.send(socket, result.response)
      return
    }

    this.broadcastState(result.state, result.liveActivities, {
      socket,
      requestId: decoded.value.requestId
    })
  }

  async webSocketClose(): Promise<void> {}
}
