import { asGameId, type GameId } from '../../shared/ids'
import type { LiveActivityDescriptor } from '../../shared/live-activity'
import {
  decodeClientMessage,
  type ClientMessage,
  type CommandError,
  type ServerMessage
} from '../../shared/protocol'
import type { Result } from '../../shared/result'
import type { GameState } from '../../shared/state'
import { filterGameStateForViewer, type GameViewer } from '../../shared/viewer'
import type { DurableObjectState, WebSocketResponseInit } from '../cloudflare'
import type { Env } from '../env'
import { jsonResponse } from '../http'
import { CommandPublicationError, runCommandPublication } from './publication'
import {
  noopPublicationTelemetrySink,
  type PublicationTelemetrySink
} from './publication-telemetry'
import {
  buildRoomStateMessage,
  parseViewerFromUrl,
  parseViewerRole,
  parseViewerUserId,
  viewerFromCommand
} from './queries'
import { gameSeedKey, getEventSeq } from './storage'

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

const MAX_COMMAND_BODY_BYTES = 64 * 1024
const MAX_TEST_SEED_BODY_BYTES = 1024
const MAX_WEBSOCKET_MESSAGE_BYTES = 64 * 1024
const RATE_LIMIT_WINDOW_MS = 10_000
const MAX_COMMANDS_PER_WINDOW = 40
const ACTOR_SESSION_HEADER = 'x-cepheus-actor-session'
const ACTOR_SESSION_TAG_PREFIX = 'session:'
const ACTOR_SESSION_PATTERN = /^[A-Za-z0-9_-]{24,128}$/
const encoder = new TextEncoder()

const byteLength = (value: string): number => encoder.encode(value).length

const isLocalTestHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.test')

const actorSessionKey = (gameId: GameId, actorId: string): string =>
  `actorSession:${gameId}:${actorId}`

const normalizeActorSessionSecret = (value: string | null): string | null => {
  const trimmed = value?.trim()
  if (!trimmed || !ACTOR_SESSION_PATTERN.test(trimmed)) return null
  return trimmed
}

export class GameRoomDO {
  private readonly commandWindows = new Map<
    string,
    { count: number; resetAt: number }
  >()

  constructor(
    private readonly state: DurableObjectState,
    _env: Env,
    private readonly publicationTelemetrySink: PublicationTelemetrySink = noopPublicationTelemetrySink
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

  private checkRateLimit(key: string): Result<void, CommandError> {
    const now = Date.now()
    const current = this.commandWindows.get(key)
    if (!current || current.resetAt <= now) {
      this.commandWindows.set(key, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS
      })
      return { ok: true, value: undefined }
    }

    if (current.count >= MAX_COMMANDS_PER_WINDOW) {
      return {
        ok: false,
        error: commandError('not_allowed', 'Too many commands; slow down')
      }
    }

    current.count += 1
    return { ok: true, value: undefined }
  }

  private viewerFromSocket(socket: WebSocket): GameViewer {
    const tags = this.getTags(socket)
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
    const sessionTag = this.getTags(socket).find((tag) =>
      tag.startsWith(ACTOR_SESSION_TAG_PREFIX)
    )
    return normalizeActorSessionSecret(
      sessionTag?.slice(ACTOR_SESSION_TAG_PREFIX.length) ?? null
    )
  }

  private async bindOrVerifyActorSession(
    gameId: GameId,
    actorId: string,
    actorSessionSecret: string | null
  ): Promise<Result<void, CommandError>> {
    if (!actorSessionSecret) {
      return {
        ok: false,
        error: commandError(
          'not_allowed',
          'Actor session token is required for commands'
        )
      }
    }

    const key = actorSessionKey(gameId, actorId)
    const existing = await this.state.storage.get<string>(key)
    if (existing === undefined) {
      await this.state.storage.put(key, actorSessionSecret)
      return { ok: true, value: undefined }
    }

    if (existing !== actorSessionSecret) {
      return {
        ok: false,
        error: commandError(
          'not_allowed',
          'Actor id is already bound to another browser session'
        )
      }
    }

    return { ok: true, value: undefined }
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
    message: Extract<ClientMessage, { type: 'command' }>,
    actorSessionSecret: string | null
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
    const actorSession = await this.bindOrVerifyActorSession(
      gameId,
      message.command.actorId,
      actorSessionSecret
    )
    if (!actorSession.ok) {
      return {
        ok: false,
        status: 403,
        response: {
          type: 'commandRejected',
          requestId: message.requestId,
          error: actorSession.error,
          eventSeq: await getEventSeq(this.state.storage, gameId)
        }
      }
    }

    const rateLimit = this.checkRateLimit(
      `${gameId}:${message.command.actorId}:${message.command.type}`
    )
    if (!rateLimit.ok) {
      return {
        ok: false,
        status: 429,
        response: {
          type: 'commandRejected',
          requestId: message.requestId,
          error: rateLimit.error,
          eventSeq: await getEventSeq(this.state.storage, gameId)
        }
      }
    }

    let publication: Awaited<ReturnType<typeof runCommandPublication>>

    try {
      publication = await runCommandPublication(
        this.state.storage,
        gameId,
        message,
        {
          telemetrySink: this.publicationTelemetrySink
        }
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
        tags.push(`${ACTOR_SESSION_TAG_PREFIX}${actorSessionSecret}`)
      }

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
