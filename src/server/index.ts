import { asGameId } from '../shared/ids'
import { validateMapLosSidecar, type MapAssetKind } from '../shared/mapAssets'
import { isObject, isString } from '../shared/util'
import {
  MAX_ASSET_UPLOAD_BYTES,
  normalizeLosSidecarInput,
  parsePositiveGridScale,
  parseUploadedImageDimensions,
  validateAssetContentType
} from './asset-upload'
import {
  discordAuthorizeUrl,
  discordRedirectUri,
  exchangeDiscordCode,
  fetchDiscordProfile
} from './discord-oauth'
import type { Env } from './env'
import { GameRoomDO } from './game-room/game-room-do'
import { jsonResponse } from './http'
import {
  PrivateBetaStore,
  type PrivateBetaAsset,
  type PrivateBetaMembership,
  type PrivateBetaRoom,
  type RoomMembershipRole
} from './private-beta-store'
import {
  clearCookieHeader,
  createOAuthStateCookie,
  createSessionCookie,
  createSessionExpiry,
  discordAuthConfigured,
  getAuthenticatedSession,
  OAUTH_STATE_COOKIE,
  parseCookies,
  randomId,
  randomToken,
  sessionAuthConfigured,
  userIdFromDiscordProfile,
  verifyOAuthStateCookie
} from './session-auth'
import { serveStaticClient } from './static-client'
import {
  INTERNAL_ROOM_ADMIN_HEADER,
  TRUSTED_ROOM_ROLE_HEADER,
  TRUSTED_USER_ID_HEADER,
  TRUSTED_VIEWER_ROLE_HEADER,
  viewerRoleForMembership
} from './trusted-room-headers'
import {
  createWorkerRateLimiter,
  requestClientKey,
  type WorkerRateLimiter
} from './worker-rate-limit'

export { GameRoomDO }

const MAX_JSON_BODY_BYTES = 64 * 1024
const encoder = new TextEncoder()
const authRateLimiter = createWorkerRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 30
})
const roomCreateRateLimiter = createWorkerRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20
})
const inviteRateLimiter = createWorkerRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 60
})
const assetUploadRateLimiter = createWorkerRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30
})
const roomCommandRateLimiter = createWorkerRateLimiter({
  windowMs: 10 * 1000,
  maxRequests: 80
})
const webSocketUpgradeRateLimiter = createWorkerRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40
})

const byteLength = (value: string): number => encoder.encode(value).length

const isLocalOrTestHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.test')

const routeGameRoomDirect = (
  request: Request,
  env: Env
): Response | Promise<Response> => {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)

  if (parts[0] !== 'rooms' || !parts[1]) {
    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }

  try {
    const gameId = asGameId(parts[1])
    const id = env.GAME_ROOM.idFromName(gameId)
    return env.GAME_ROOM.get(id).fetch(request)
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Invalid room id'
      },
      { status: 400 }
    )
  }
}

const readJsonObject = async (
  request: Request
): Promise<Record<string, unknown>> => {
  const body = await request.text()
  if (byteLength(body) > MAX_JSON_BODY_BYTES) {
    throw new Error('Request body is too large')
  }
  if (!body.trim()) return {}

  const raw = JSON.parse(body) as unknown
  if (!isObject(raw)) throw new Error('Request body must be a JSON object')

  return raw
}

const notConfigured = (): Response =>
  jsonResponse(
    {
      error: 'Private-beta storage and secrets are not configured'
    },
    { status: 501 }
  )

const unauthenticated = (): Response =>
  jsonResponse({ error: 'Authentication required' }, { status: 401 })

const forbidden = (message = 'Not allowed'): Response =>
  jsonResponse({ error: message }, { status: 403 })

const tooManyRequests = (retryAfterSeconds: number): Response =>
  jsonResponse(
    { error: 'Too many requests; slow down' },
    {
      status: 429,
      headers: { 'retry-after': String(retryAfterSeconds) }
    }
  )

const enforceRateLimit = (
  limiter: WorkerRateLimiter,
  key: string
): Response | null => {
  const decision = limiter.check(key)
  return decision.allowed ? null : tooManyRequests(decision.retryAfterSeconds)
}

const redirectResponse = (
  location: string,
  setCookies: readonly string[] = []
): Response => {
  const headers = new Headers({ location })
  for (const cookie of setCookies) headers.append('set-cookie', cookie)

  return new Response(null, { status: 302, headers })
}

const resolveBaseUrl = (request: Request, env: Env): string =>
  env.APP_BASE_URL ?? new URL(request.url).origin

const createRoomId = (body: Record<string, unknown>): string => {
  if (isString(body.roomId) && body.roomId.trim()) return body.roomId.trim()
  if (isString(body.slug) && body.slug.trim()) return body.slug.trim()
  return randomId('room')
}

const parseInviteRole = (raw: unknown): Exclude<RoomMembershipRole, 'OWNER'> =>
  raw === 'REFEREE' || raw === 'PLAYER' || raw === 'SPECTATOR' ? raw : 'PLAYER'

const canCreateInvite = (role: RoomMembershipRole): boolean =>
  role === 'OWNER' || role === 'REFEREE'

const canManageRoomAssets = (role: RoomMembershipRole): boolean =>
  role === 'OWNER' || role === 'REFEREE'

const canOwnRoom = (role: RoomMembershipRole): boolean => role === 'OWNER'

const isWebSocketUpgrade = (request: Request): boolean =>
  request.headers.get('upgrade')?.toLowerCase() === 'websocket'

const isCommandRoute = (request: Request, parts: readonly string[]): boolean =>
  request.method === 'POST' && parts[2] === 'command'

const parseAssetKind = (raw: FormDataEntryValue | null): MapAssetKind =>
  raw === 'counter' ? 'counter' : 'geomorph'

const publicAsset = (asset: PrivateBetaAsset) => ({
  id: asset.id,
  roomId: asset.roomId,
  ownerId: asset.ownerId,
  kind: asset.kind,
  url: `/api/assets/${encodeURIComponent(asset.id)}`,
  contentType: asset.contentType,
  byteSize: asset.byteSize,
  width: asset.width,
  height: asset.height,
  gridScale: asset.gridScale,
  losSidecar: asset.losSidecar,
  createdAt: asset.createdAt
})

interface AuthenticatedRoomContext {
  store: PrivateBetaStore
  room: PrivateBetaRoom
  membership: PrivateBetaMembership
  session: NonNullable<Awaited<ReturnType<typeof getAuthenticatedSession>>>
}

const resolveAuthenticatedRoom = async (
  request: Request,
  env: Env,
  roomId: string
): Promise<AuthenticatedRoomContext | Response> => {
  if (!sessionAuthConfigured(env) || !env.CEPHEUS_DB) return notConfigured()

  const session = await getAuthenticatedSession(request, env)
  if (!session) return unauthenticated()

  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const gameId = asGameId(roomId)
  const room = await store.getRoom(gameId)
  if (!room || room.deletedAt) {
    return jsonResponse({ error: 'Room not found' }, { status: 404 })
  }
  const membership = await store.getMembership(gameId, session.user.id)
  if (!membership) return forbidden('Room membership required')

  return { store, room, membership, session }
}

const routeDiscordStart = async (
  request: Request,
  env: Env
): Promise<Response> => {
  const limited = enforceRateLimit(
    authRateLimiter,
    `discord-start:${requestClientKey(request)}`
  )
  if (limited) return limited

  if (!discordAuthConfigured(env) || !env.SESSION_SECRET) return notConfigured()

  const state = randomToken(24)
  const url = discordAuthorizeUrl({
    clientId: env.DISCORD_CLIENT_ID ?? '',
    redirectUri: discordRedirectUri(env),
    state
  })
  const cookie = await createOAuthStateCookie({
    secret: env.SESSION_SECRET,
    state,
    expiresAtMs: Date.now() + 1000 * 60 * 10
  })
  void request

  return redirectResponse(url, [cookie])
}

const routeDiscordCallback = async (
  request: Request,
  env: Env
): Promise<Response> => {
  const limited = enforceRateLimit(
    authRateLimiter,
    `discord-callback:${requestClientKey(request)}`
  )
  if (limited) return limited

  if (!discordAuthConfigured(env) || !env.SESSION_SECRET || !env.CEPHEUS_DB) {
    return notConfigured()
  }

  const url = new URL(request.url)
  const stateOk = await verifyOAuthStateCookie({
    secret: env.SESSION_SECRET,
    cookieValue: parseCookies(request)[OAUTH_STATE_COOKIE],
    state: url.searchParams.get('state')
  })
  const code = url.searchParams.get('code')
  if (!stateOk || !code) {
    return jsonResponse(
      { error: 'Invalid Discord OAuth callback' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const profile = await fetchDiscordProfile(
    await exchangeDiscordCode({
      env,
      code,
      redirectUri: discordRedirectUri(env)
    })
  )
  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const user = await store.upsertDiscordUser({
    id: userIdFromDiscordProfile(profile),
    discordId: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar,
    now
  })
  const session = await store.createSession({
    id: randomId('sess'),
    userId: user.id,
    expiresAt: createSessionExpiry(),
    now
  })
  const sessionCookie = await createSessionCookie({
    secret: env.SESSION_SECRET,
    sessionId: session.id,
    expiresAt: session.expiresAt
  })

  return redirectResponse(resolveBaseUrl(request, env), [
    sessionCookie,
    clearCookieHeader(OAUTH_STATE_COOKIE)
  ])
}

const routeSession = async (request: Request, env: Env): Promise<Response> => {
  const session = await getAuthenticatedSession(request, env)
  if (!session) return jsonResponse({ authenticated: false, user: null })

  return jsonResponse({
    authenticated: true,
    user: {
      id: session.user.id,
      username: session.user.username,
      avatarUrl: session.user.avatarUrl
    },
    expiresAt: session.expiresAt
  })
}

const routeLogout = async (request: Request, env: Env): Promise<Response> => {
  const session = await getAuthenticatedSession(request, env)
  if (session && env.CEPHEUS_DB) {
    await new PrivateBetaStore(env.CEPHEUS_DB).deleteSession(session.sessionId)
  }

  return jsonResponse(
    { ok: true },
    {
      headers: {
        'set-cookie': clearCookieHeader('cepheus_session')
      }
    }
  )
}

const routeCreateRoom = async (
  request: Request,
  env: Env
): Promise<Response> => {
  if (!sessionAuthConfigured(env) || !env.CEPHEUS_DB) return notConfigured()
  const session = await getAuthenticatedSession(request, env)
  if (!session) return unauthenticated()

  const limited = enforceRateLimit(
    roomCreateRateLimiter,
    `room-create:${session.user.id}`
  )
  if (limited) return limited

  const body = await readJsonObject(request)
  const roomId = asGameId(createRoomId(body))
  const name =
    isString(body.name) && body.name.trim() ? body.name.trim() : roomId
  const slug =
    isString(body.slug) && body.slug.trim() ? body.slug.trim() : roomId
  const rulesetId =
    isString(body.rulesetId) && body.rulesetId.trim()
      ? body.rulesetId.trim()
      : null
  const room = await new PrivateBetaStore(env.CEPHEUS_DB).createRoom({
    roomId,
    slug,
    name,
    ownerId: session.user.id,
    rulesetId,
    now: new Date().toISOString()
  })

  return jsonResponse({ room }, { status: 201 })
}

const routeCreateInvite = async (
  request: Request,
  env: Env,
  roomId: string
): Promise<Response> => {
  if (!sessionAuthConfigured(env) || !env.CEPHEUS_DB) return notConfigured()
  const session = await getAuthenticatedSession(request, env)
  if (!session) return unauthenticated()

  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const gameId = asGameId(roomId)
  const membership = await store.getMembership(gameId, session.user.id)
  if (!membership || !canCreateInvite(membership.role)) return forbidden()

  const limited = enforceRateLimit(
    inviteRateLimiter,
    `invite-create:${gameId}:${session.user.id}`
  )
  if (limited) return limited

  const body = await readJsonObject(request)
  const nowMs = Date.now()
  const invite = await store.createInvite({
    token: randomToken(24),
    roomId: gameId,
    createdBy: session.user.id,
    role: parseInviteRole(body.role),
    expiresAt: new Date(nowMs + 1000 * 60 * 60 * 24 * 30).toISOString(),
    now: new Date(nowMs).toISOString()
  })
  const inviteUrl = new URL(resolveBaseUrl(request, env))
  inviteUrl.searchParams.set('invite', invite.token)

  return jsonResponse(
    { invite, inviteUrl: inviteUrl.toString() },
    { status: 201 }
  )
}

const routeAcceptInvite = async (
  request: Request,
  env: Env,
  token: string
): Promise<Response> => {
  if (!sessionAuthConfigured(env) || !env.CEPHEUS_DB) return notConfigured()
  const session = await getAuthenticatedSession(request, env)
  if (!session) return unauthenticated()

  const limited = enforceRateLimit(
    inviteRateLimiter,
    `invite-accept:${session.user.id}`
  )
  if (limited) return limited

  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const invite = await store.getInvite(token)
  if (!invite || invite.acceptedAt) {
    return jsonResponse({ error: 'Invite not found' }, { status: 404 })
  }

  const now = new Date()
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= now.getTime()) {
    return jsonResponse({ error: 'Invite has expired' }, { status: 410 })
  }

  await store.createMembership({
    roomId: invite.roomId,
    userId: session.user.id,
    role: invite.role,
    now: now.toISOString()
  })
  await store.markInviteAccepted(invite.token, now.toISOString())

  return jsonResponse({
    ok: true,
    roomId: invite.roomId,
    role: invite.role
  })
}

const routeListRoomAssets = async (
  request: Request,
  env: Env,
  roomId: string
): Promise<Response> => {
  const context = await resolveAuthenticatedRoom(request, env, roomId)
  if (context instanceof Response) return context

  const assets = await context.store.listRoomAssets(context.room.id)
  return jsonResponse({ assets: assets.map(publicAsset) })
}

const routeUploadRoomAsset = async (
  request: Request,
  env: Env,
  roomId: string
): Promise<Response> => {
  if (!env.ASSET_BUCKET) return notConfigured()
  const context = await resolveAuthenticatedRoom(request, env, roomId)
  if (context instanceof Response) return context
  if (!canManageRoomAssets(context.membership.role)) return forbidden()

  const limited = enforceRateLimit(
    assetUploadRateLimiter,
    `asset-upload:${context.room.id}:${context.session.user.id}`
  )
  if (limited) return limited

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return jsonResponse({ error: 'Image file is required' }, { status: 400 })
  }
  if (file.size > MAX_ASSET_UPLOAD_BYTES) {
    return jsonResponse({ error: 'Asset upload is too large' }, { status: 413 })
  }

  const contentType = validateAssetContentType(file.type)
  if (!contentType.ok) {
    return jsonResponse({ error: contentType.error }, { status: 400 })
  }
  const gridScale = parsePositiveGridScale(form.get('gridScale'))
  if (!gridScale.ok) {
    return jsonResponse({ error: gridScale.error }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const dimensions = parseUploadedImageDimensions(bytes, contentType.value)
  if (!dimensions.ok) {
    return jsonResponse({ error: dimensions.error }, { status: 400 })
  }

  const assetId = randomId('asset')
  const sidecarInput = normalizeLosSidecarInput(form.get('losSidecar'), assetId)
  if (!sidecarInput.ok) {
    return jsonResponse({ error: sidecarInput.error }, { status: 400 })
  }
  const sidecar = sidecarInput.value
    ? validateMapLosSidecar(sidecarInput.value)
    : null
  if (sidecar && !sidecar.ok) {
    return jsonResponse(
      { error: `LOS sidecar is invalid: ${sidecar.error.join(', ')}` },
      { status: 400 }
    )
  }
  if (
    sidecar?.ok &&
    (sidecar.value.width !== dimensions.value.width ||
      sidecar.value.height !== dimensions.value.height ||
      sidecar.value.gridScale !== gridScale.value)
  ) {
    return jsonResponse(
      { error: 'LOS sidecar dimensions must match uploaded image metadata' },
      { status: 400 }
    )
  }

  const r2Key = `rooms/${context.room.id}/assets/${assetId}`
  await env.ASSET_BUCKET.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: contentType.value },
    customMetadata: {
      roomId: context.room.id,
      ownerId: context.session.user.id,
      assetId
    }
  })

  const asset = await context.store.createAsset({
    id: assetId,
    roomId: context.room.id,
    ownerId: context.session.user.id,
    kind: parseAssetKind(form.get('kind')),
    r2Key,
    contentType: contentType.value,
    byteSize: bytes.byteLength,
    width: dimensions.value.width,
    height: dimensions.value.height,
    gridScale: gridScale.value,
    losSidecar: sidecar?.ok ? sidecar.value : null,
    now: new Date().toISOString()
  })

  return jsonResponse({ asset: publicAsset(asset) }, { status: 201 })
}

const routeServeAsset = async (
  request: Request,
  env: Env,
  assetId: string
): Promise<Response> => {
  if (!sessionAuthConfigured(env) || !env.CEPHEUS_DB || !env.ASSET_BUCKET) {
    return notConfigured()
  }
  const session = await getAuthenticatedSession(request, env)
  if (!session) return unauthenticated()

  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const asset = await store.getAsset(assetId)
  if (!asset) return jsonResponse({ error: 'Asset not found' }, { status: 404 })
  const membership = await store.getMembership(asset.roomId, session.user.id)
  if (!membership) return forbidden('Room membership required')

  const object = await env.ASSET_BUCKET.get(asset.r2Key)
  if (!object?.body) {
    return jsonResponse({ error: 'Asset object not found' }, { status: 404 })
  }

  const headers = new Headers({
    'cache-control': 'private, max-age=300'
  })
  object.writeHttpMetadata(headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', asset.contentType)
  }
  headers.set('content-length', String(asset.byteSize))

  return new Response(object.body, { headers })
}

const fetchRoomAdmin = (
  env: Env,
  roomId: string,
  action: 'export' | 'delete'
): Promise<Response> => {
  const gameId = asGameId(roomId)
  const id = env.GAME_ROOM.idFromName(gameId)
  return env.GAME_ROOM.get(id).fetch(
    new Request(
      `https://internal/rooms/${encodeURIComponent(gameId)}/admin/${action}`,
      {
        method: 'POST',
        headers: {
          [INTERNAL_ROOM_ADMIN_HEADER]: action
        }
      }
    )
  )
}

const routeExportRoom = async (
  request: Request,
  env: Env,
  roomId: string
): Promise<Response> => {
  const context = await resolveAuthenticatedRoom(request, env, roomId)
  if (context instanceof Response) return context
  if (!canOwnRoom(context.membership.role)) return forbidden()

  const [memberships, assets, durableRoomResponse] = await Promise.all([
    context.store.listRoomMemberships(context.room.id),
    context.store.listRoomAssets(context.room.id),
    fetchRoomAdmin(env, roomId, 'export')
  ])
  const durableRoom = await durableRoomResponse.json()

  return jsonResponse({
    exportedAt: new Date().toISOString(),
    room: context.room,
    memberships,
    assets: assets.map(publicAsset),
    durableRoom,
    ruleset: {
      id: context.room.rulesetId
    }
  })
}

const routeDeleteRoom = async (
  request: Request,
  env: Env,
  roomId: string
): Promise<Response> => {
  if (!env.ASSET_BUCKET) return notConfigured()
  const context = await resolveAuthenticatedRoom(request, env, roomId)
  if (context instanceof Response) return context
  if (!canOwnRoom(context.membership.role)) return forbidden()

  const assets = await context.store.listRoomAssets(context.room.id)
  if (assets.length > 0) {
    await env.ASSET_BUCKET.delete(assets.map((asset) => asset.r2Key))
  }
  await fetchRoomAdmin(env, roomId, 'delete')
  await context.store.markRoomDeleted(context.room.id, new Date().toISOString())

  return jsonResponse({ ok: true, roomId: context.room.id, deleted: true })
}

const routeGameRoom = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url)
  if (!sessionAuthConfigured(env) && isLocalOrTestHost(url.hostname)) {
    return routeGameRoomDirect(request, env)
  }
  if (!sessionAuthConfigured(env) || !env.CEPHEUS_DB) return notConfigured()

  const parts = url.pathname.split('/').filter(Boolean)
  const roomId = parts[1]
  if (!roomId) return jsonResponse({ error: 'Not found' }, { status: 404 })

  const session = await getAuthenticatedSession(request, env)
  if (!session) return unauthenticated()

  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const gameId = asGameId(roomId)
  const room = await store.getRoom(gameId)
  if (!room || room.deletedAt) {
    return jsonResponse({ error: 'Room not found' }, { status: 404 })
  }
  const membership = await store.getMembership(gameId, session.user.id)
  if (!membership) return forbidden('Room membership required')

  if (isCommandRoute(request, parts)) {
    const limited = enforceRateLimit(
      roomCommandRateLimiter,
      `room-command:${gameId}:${session.user.id}`
    )
    if (limited) return limited
  }
  if (isWebSocketUpgrade(request)) {
    const limited = enforceRateLimit(
      webSocketUpgradeRateLimiter,
      `websocket-upgrade:${gameId}:${session.user.id}`
    )
    if (limited) return limited
  }

  const headers = new Headers(request.headers)
  headers.delete(INTERNAL_ROOM_ADMIN_HEADER)
  headers.set(TRUSTED_USER_ID_HEADER, session.user.id)
  headers.set(
    TRUSTED_VIEWER_ROLE_HEADER,
    viewerRoleForMembership(membership.role)
  )
  headers.set(TRUSTED_ROOM_ROLE_HEADER, membership.role)

  return routeGameRoomDirect(new Request(request, { headers }), env)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        service: 'cepheus-online',
        worker: 'ready'
      })
    }

    if (url.pathname === '/auth/discord/start') {
      return routeDiscordStart(request, env)
    }
    if (url.pathname === '/auth/discord/callback') {
      return routeDiscordCallback(request, env)
    }
    if (url.pathname === '/api/session') return routeSession(request, env)
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return routeLogout(request, env)
    }
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      return routeCreateRoom(request, env)
    }

    const parts = url.pathname.split('/').filter(Boolean)
    if (
      parts[0] === 'api' &&
      parts[1] === 'rooms' &&
      parts[2] &&
      parts[3] === 'assets'
    ) {
      if (request.method === 'GET') {
        return routeListRoomAssets(request, env, parts[2])
      }
      if (request.method === 'POST') {
        return routeUploadRoomAsset(request, env, parts[2])
      }
    }
    if (
      parts[0] === 'api' &&
      parts[1] === 'rooms' &&
      parts[2] &&
      parts[3] === 'export' &&
      request.method === 'GET'
    ) {
      return routeExportRoom(request, env, parts[2])
    }
    if (
      parts[0] === 'api' &&
      parts[1] === 'rooms' &&
      parts[2] &&
      parts.length === 3 &&
      request.method === 'DELETE'
    ) {
      return routeDeleteRoom(request, env, parts[2])
    }
    if (
      parts[0] === 'api' &&
      parts[1] === 'rooms' &&
      parts[2] &&
      parts[3] === 'invites' &&
      request.method === 'POST'
    ) {
      return routeCreateInvite(request, env, parts[2])
    }
    if (
      parts[0] === 'api' &&
      parts[1] === 'invites' &&
      parts[2] &&
      parts[3] === 'accept' &&
      request.method === 'POST'
    ) {
      return routeAcceptInvite(request, env, parts[2])
    }
    if (
      parts[0] === 'api' &&
      parts[1] === 'assets' &&
      parts[2] &&
      request.method === 'GET'
    ) {
      return routeServeAsset(request, env, parts[2])
    }

    if (url.pathname.startsWith('/rooms/')) {
      return routeGameRoom(request, env)
    }

    const staticClientResponse = serveStaticClient(url.pathname)
    if (staticClientResponse) {
      return staticClientResponse
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }
}
