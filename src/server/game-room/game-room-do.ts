import { asGameId, type GameId } from '../../shared/ids'
import type { LiveActivityDescriptor } from '../../shared/live-activity'
import {
  decodeClientMessage,
  type ClientMessage,
  type ServerMessage
} from '../../shared/protocol'
import type { GameState } from '../../shared/state'
import type { GameViewer } from '../../shared/viewer'
import type { DurableObjectState, WebSocketResponseInit } from '../cloudflare'
import type { Env } from '../env'
import { jsonResponse } from '../http'
import {
  ACTOR_SESSION_HEADER,
  actorSessionSecretFromTags,
  actorSessionTag,
  normalizeActorSessionSecret
} from './actor-session'
import { broadcastRoomState, serializeMessage } from './broadcast'
import { commandError } from './command-helpers'
import { createCommandRateLimiter } from './command-rate-limit'
import {
  handleRoomCommandMessage,
  statusForCommandError
} from './command-service'
import {
  noopPublicationTelemetrySink,
  type PublicationTelemetrySink
} from './publication-telemetry'
import { buildRoomStateMessage, parseViewerFromUrl } from './queries'
import {
  createRevealBroadcastScheduler,
  type RevealBroadcastScheduler
} from './reveal-scheduler'
import { gameSeedKey } from './storage'

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
      action: parts.slice(2).join('/')
    }
  } catch {
    return null
  }
}

const MAX_COMMAND_BODY_BYTES = 64 * 1024
const MAX_TEST_SEED_BODY_BYTES = 1024
const MAX_WEBSOCKET_MESSAGE_BYTES = 64 * 1024
const RATE_LIMIT_WINDOW_MS = 10_000
const MAX_COMMANDS_PER_WINDOW = 40
const encoder = new TextEncoder()

const byteLength = (value: string): number => encoder.encode(value).length

const isLocalTestHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.test')

export class GameRoomDO {
  private readonly commandRateLimiter = createCommandRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxCommandsPerWindow: MAX_COMMANDS_PER_WINDOW
  })
  private readonly revealScheduler: RevealBroadcastScheduler

  constructor(
    private readonly state: DurableObjectState,
    _env: Env,
    private readonly publicationTelemetrySink: PublicationTelemetrySink = noopPublicationTelemetrySink
  ) {
    this.revealScheduler = createRevealBroadcastScheduler({
      storage: this.state.storage,
      broadcastState: (state, liveActivities) =>
        this.broadcastState(state, liveActivities)
    })
  }

  private getWebSockets(): WebSocket[] {
    return this.state.getWebSockets?.() ?? []
  }

  private getTags(socket: WebSocket): string[] {
    return this.state.getTags?.(socket) ?? []
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    socket.send(serializeMessage(message))
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

  private actorSessionFromSocket(socket: WebSocket): string | null {
    return actorSessionSecretFromTags(this.getTags(socket))
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
    broadcastRoomState({
      sockets: this.getWebSockets(),
      getTags: (socket) => this.getTags(socket),
      send: (socket, message) => this.send(socket, message),
      state,
      liveActivities,
      accepted
    })
    this.revealScheduler.schedule(state, liveActivities)
  }

  private async handleCommandMessage(
    gameId: GameId,
    message: Extract<ClientMessage, { type: 'command' }>,
    actorSessionSecret: string | null
  ): ReturnType<typeof handleRoomCommandMessage> {
    return handleRoomCommandMessage({
      storage: this.state.storage,
      gameId,
      message,
      actorSessionSecret,
      commandRateLimiter: this.commandRateLimiter,
      telemetrySink: this.publicationTelemetrySink
    })
  }

  private async handleJsonMessage(
    raw: unknown,
    gameId: GameId,
    actorSessionSecret: string | null
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
        status: statusForCommandError(decoded.error),
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

    const result = await this.handleCommandMessage(
      gameId,
      decoded.value,
      actorSessionSecret
    )
    return result.ok
      ? {
          ok: true,
          message: result.response,
          state: result.state,
          liveActivities: result.liveActivities
        }
      : { ok: false, message: result.response, status: result.status }
  }

  private async handleTestSeedRequest(
    request: Request,
    url: URL,
    gameId: GameId
  ): Promise<Response> {
    if (!isLocalTestHost(url.hostname)) {
      return jsonResponse(
        {
          error: commandError(
            'not_allowed',
            'Test seed route is only available on local test hosts'
          )
        },
        { status: 403 }
      )
    }

    let raw: unknown
    try {
      const body = await request.text()
      if (byteLength(body) > MAX_TEST_SEED_BODY_BYTES) {
        return jsonResponse(
          {
            error: commandError(
              'invalid_message',
              'Test seed body is too large'
            )
          },
          { status: 413 }
        )
      }
      raw = JSON.parse(body)
    } catch {
      return jsonResponse(
        {
          error: commandError('invalid_message', 'Invalid JSON body')
        },
        { status: 400 }
      )
    }

    const seed =
      typeof raw === 'object' && raw !== null && 'seed' in raw
        ? (raw as { seed?: unknown }).seed
        : undefined

    if (
      typeof seed !== 'number' ||
      !Number.isInteger(seed) ||
      seed < 0 ||
      seed > 0xffffffff
    ) {
      return jsonResponse(
        {
          error: commandError(
            'invalid_message',
            'seed must be an integer between 0 and 4294967295'
          )
        },
        { status: 400 }
      )
    }

    const storedSeed = seed | 0
    await this.state.storage.put(gameSeedKey(gameId), storedSeed)

    return jsonResponse({
      ok: true,
      gameId,
      seed: storedSeed
    })
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
      const actorSessionSecret = normalizeActorSessionSecret(
        url.searchParams.get('session')
      )
      if (actorSessionSecret) {
        tags.push(actorSessionTag(actorSessionSecret))
      }

      this.state.acceptWebSocket(server, tags)
      this.send(server, await this.buildRoomStateMessage(route.gameId, viewer))
      await this.revealScheduler.scheduleForGame(route.gameId)

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

    if (request.method === 'POST' && route.action === 'test/seed') {
      return this.handleTestSeedRequest(request, url, route.gameId)
    }

    if (request.method === 'POST' && route.action === 'command') {
      let raw: unknown
      const contentLength = Number(request.headers.get('content-length') ?? 0)
      if (contentLength > MAX_COMMAND_BODY_BYTES) {
        const error = commandError(
          'invalid_message',
          'Command body is too large'
        )
        return jsonResponse({ type: 'error', error } satisfies ServerMessage, {
          status: 413
        })
      }

      try {
        const body = await request.text()
        if (byteLength(body) > MAX_COMMAND_BODY_BYTES) {
          const error = commandError(
            'invalid_message',
            'Command body is too large'
          )
          return jsonResponse(
            { type: 'error', error } satisfies ServerMessage,
            { status: 413 }
          )
        }
        raw = JSON.parse(body)
      } catch {
        const error = commandError('invalid_message', 'Invalid JSON body')
        return jsonResponse({ type: 'error', error } satisfies ServerMessage, {
          status: 400
        })
      }

      const result = await this.handleJsonMessage(
        raw,
        route.gameId,
        normalizeActorSessionSecret(request.headers.get(ACTOR_SESSION_HEADER))
      )

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

    if (byteLength(message) > MAX_WEBSOCKET_MESSAGE_BYTES) {
      this.send(socket, {
        type: 'error',
        error: commandError('invalid_message', 'WebSocket message is too large')
      })
      socket.close(1009, 'Message too large')
      return
    }

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

    const result = await this.handleCommandMessage(
      gameId,
      decoded.value,
      this.actorSessionFromSocket(socket)
    )

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
