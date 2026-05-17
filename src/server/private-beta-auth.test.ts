import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId, asUserId } from '../shared/ids'
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  DurableObjectId,
  DurableObjectNamespace,
  DurableObjectStub,
  R2Bucket,
  R2ObjectBody,
  R2PutOptions
} from './cloudflare'
import type { Env } from './env'
import worker from './index'
import { PrivateBetaStore } from './private-beta-store'
import {
  createOAuthStateCookie,
  createSessionCookie,
  createSessionExpiry,
  verifyOAuthStateCookie,
  verifySessionCookieValue
} from './session-auth'

interface FakeDbState {
  users: Map<string, Record<string, unknown>>
  sessions: Map<string, Record<string, unknown>>
  rooms: Map<string, Record<string, unknown>>
  memberships: Map<string, Record<string, unknown>>
  invites: Map<string, Record<string, unknown>>
  assets: Map<string, Record<string, unknown>>
}

class FakeStatement implements D1PreparedStatement {
  private values: unknown[] = []

  constructor(
    private readonly state: FakeDbState,
    private readonly query: string
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    const sql = this.query
    if (sql.includes('FROM users WHERE discord_id')) {
      const row = [...this.state.users.values()].find(
        (user) => user.discord_id === this.values[0]
      )
      return (row as T | undefined) ?? null
    }
    if (sql.includes('FROM users WHERE id')) {
      return (
        (this.state.users.get(String(this.values[0])) as T | undefined) ?? null
      )
    }
    if (sql.includes('FROM sessions')) {
      return (
        (this.state.sessions.get(String(this.values[0])) as T | undefined) ??
        null
      )
    }
    if (sql.includes('FROM rooms')) {
      return (
        (this.state.rooms.get(String(this.values[0])) as T | undefined) ?? null
      )
    }
    if (sql.includes('FROM room_memberships')) {
      const key = `${this.values[0]}:${this.values[1]}`
      return (this.state.memberships.get(key) as T | undefined) ?? null
    }
    if (sql.includes('FROM room_invites')) {
      return (
        (this.state.invites.get(String(this.values[0])) as T | undefined) ??
        null
      )
    }
    if (sql.includes('FROM assets')) {
      return (
        (this.state.assets.get(String(this.values[0])) as T | undefined) ?? null
      )
    }

    throw new Error(`Unhandled fake D1 first query: ${sql}`)
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const sql = this.query
    if (sql.includes('FROM room_memberships WHERE room_id')) {
      return {
        success: true,
        results: [...this.state.memberships.values()].filter(
          (membership) => membership.room_id === this.values[0]
        ) as T[]
      }
    }
    if (sql.includes('FROM assets WHERE room_id')) {
      return {
        success: true,
        results: [...this.state.assets.values()].filter(
          (asset) => asset.room_id === this.values[0]
        ) as T[]
      }
    }

    return { success: true, results: [] }
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    const sql = this.query
    if (sql.includes('INSERT INTO users')) {
      const [id, discordId, username, avatarUrl, createdAt, updatedAt] =
        this.values
      const existing = [...this.state.users.values()].find(
        (user) => user.discord_id === discordId
      )
      const row = {
        id: existing?.id ?? id,
        discord_id: discordId,
        username,
        avatar_url: avatarUrl,
        created_at: existing?.created_at ?? createdAt,
        updated_at: updatedAt
      }
      this.state.users.set(String(row.id), row)
      return { success: true }
    }
    if (sql.includes('INSERT INTO sessions')) {
      const [id, userId, expiresAt, createdAt] = this.values
      this.state.sessions.set(String(id), {
        id,
        user_id: userId,
        expires_at: expiresAt,
        created_at: createdAt
      })
      return { success: true }
    }
    if (sql.includes('DELETE FROM sessions')) {
      this.state.sessions.delete(String(this.values[0]))
      return { success: true }
    }
    if (sql.includes('INSERT INTO rooms')) {
      const [id, slug, name, ownerId, rulesetId, createdAt, updatedAt] =
        this.values
      this.state.rooms.set(String(id), {
        id,
        slug,
        name,
        owner_id: ownerId,
        ruleset_id: rulesetId,
        deleted_at: null,
        created_at: createdAt,
        updated_at: updatedAt
      })
      return { success: true }
    }
    if (sql.includes('INSERT INTO room_memberships')) {
      const [roomId, userId, roleOrCreatedAt, createdAt] = this.values
      const role = createdAt === undefined ? 'OWNER' : roleOrCreatedAt
      this.state.memberships.set(`${roomId}:${userId}`, {
        room_id: roomId,
        user_id: userId,
        role,
        created_at: createdAt ?? roleOrCreatedAt
      })
      return { success: true }
    }
    if (sql.includes('INSERT INTO room_invites')) {
      const [token, roomId, createdBy, role, expiresAt, createdAt] = this.values
      this.state.invites.set(String(token), {
        token,
        room_id: roomId,
        created_by: createdBy,
        role,
        expires_at: expiresAt,
        accepted_at: null,
        created_at: createdAt
      })
      return { success: true }
    }
    if (sql.includes('UPDATE rooms SET deleted_at')) {
      const [deletedAt, updatedAt, roomId] = this.values
      const room = this.state.rooms.get(String(roomId))
      if (room) {
        room.deleted_at = deletedAt
        room.updated_at = updatedAt
      }
      return { success: true }
    }
    if (sql.includes('UPDATE room_invites SET accepted_at')) {
      const [acceptedAt, token] = this.values
      const invite = this.state.invites.get(String(token))
      if (invite) invite.accepted_at = acceptedAt
      return { success: true }
    }
    if (sql.includes('INSERT INTO assets')) {
      const [
        id,
        roomId,
        ownerId,
        kind,
        r2Key,
        contentType,
        byteSize,
        width,
        height,
        gridScale,
        losSidecarJson,
        createdAt
      ] = this.values
      this.state.assets.set(String(id), {
        id,
        room_id: roomId,
        owner_id: ownerId,
        kind,
        r2_key: r2Key,
        content_type: contentType,
        byte_size: byteSize,
        width,
        height,
        grid_scale: gridScale,
        los_sidecar_json: losSidecarJson,
        created_at: createdAt
      })
      return { success: true }
    }

    throw new Error(`Unhandled fake D1 run query: ${sql}`)
  }
}

class FakeD1 implements D1Database {
  readonly state: FakeDbState = {
    users: new Map(),
    sessions: new Map(),
    rooms: new Map(),
    memberships: new Map(),
    invites: new Map(),
    assets: new Map()
  }

  prepare(query: string): D1PreparedStatement {
    return new FakeStatement(this.state, query)
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = []
    for (const statement of statements) {
      results.push(await statement.run<T>())
    }
    return results
  }

  async exec(): Promise<D1Result> {
    return { success: true }
  }
}

class FakeR2ObjectBody implements R2ObjectBody {
  readonly body: ReadableStream | null

  constructor(
    bytes: Uint8Array,
    private readonly contentType: string
  ) {
    this.body = new Response(arrayBufferFromBytes(bytes)).body
  }

  writeHttpMetadata(headers: Headers): void {
    headers.set('content-type', this.contentType)
  }
}

class FakeR2Bucket implements R2Bucket {
  readonly objects = new Map<
    string,
    { bytes: Uint8Array; contentType: string; metadata: Record<string, string> }
  >()

  async get(key: string): Promise<R2ObjectBody | null> {
    const object = this.objects.get(key)
    return object
      ? new FakeR2ObjectBody(object.bytes, object.contentType)
      : null
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options: R2PutOptions = {}
  ): Promise<unknown> {
    const bytes =
      value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : typeof value === 'string'
            ? new TextEncoder().encode(value)
            : new Uint8Array(await new Response(value).arrayBuffer())
    this.objects.set(key, {
      bytes,
      contentType:
        options.httpMetadata?.contentType ?? 'application/octet-stream',
      metadata: options.customMetadata ?? {}
    })
    return {}
  }

  async delete(key: string | string[]): Promise<void> {
    for (const candidate of Array.isArray(key) ? key : [key]) {
      this.objects.delete(candidate)
    }
  }
}

class CapturingRoomNamespace implements DurableObjectNamespace {
  lastRequest: Request | null = null
  responseBody: unknown = { ok: true }

  idFromName(name: string): DurableObjectId {
    return { name } as unknown as DurableObjectId
  }

  get(): DurableObjectStub {
    return {
      fetch: async (request) => {
        this.lastRequest = request
        return new Response(JSON.stringify(this.responseBody), {
          headers: { 'content-type': 'application/json' }
        })
      }
    }
  }
}

const cookiePair = (setCookie: string): string => setCookie.split(';')[0] ?? ''

const arrayBufferFromBytes = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer

const minimalPng = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set(new TextEncoder().encode('IHDR'), 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

const createAuthenticatedEnv = async ({
  roomRole = 'PLAYER',
  userId = asUserId('discord:1234')
}: {
  roomRole?: 'OWNER' | 'REFEREE' | 'PLAYER' | 'SPECTATOR'
  userId?: ReturnType<typeof asUserId>
} = {}) => {
  const db = new FakeD1()
  const assetBucket = new FakeR2Bucket()
  const roomNamespace = new CapturingRoomNamespace()
  const env: Env = {
    GAME_ROOM: roomNamespace,
    CEPHEUS_DB: db,
    SESSION_SECRET: 'test-session-secret',
    ASSET_BUCKET: assetBucket
  }
  const store = new PrivateBetaStore(db)
  const now = '2026-05-17T00:00:00.000Z'
  await store.upsertDiscordUser({
    id: userId,
    discordId: '1234',
    username: 'Scout',
    avatarUrl: null,
    now
  })
  const session = await store.createSession({
    id: 'sess_test',
    userId,
    expiresAt: createSessionExpiry(),
    now
  })
  await store.createRoom({
    roomId: asGameId('room-1'),
    slug: 'room-1',
    name: 'Room 1',
    ownerId: userId,
    rulesetId: null,
    now
  })
  await store.createMembership({
    roomId: asGameId('room-1'),
    userId,
    role: roomRole,
    now
  })
  const cookie = cookiePair(
    await createSessionCookie({
      secret: env.SESSION_SECRET ?? '',
      sessionId: session.id,
      expiresAt: session.expiresAt
    })
  )

  return { db, env, roomNamespace, cookie, store, userId, assetBucket }
}

describe('private beta auth', () => {
  it('signs and rejects tampered app session cookies', async () => {
    const cookie = await createSessionCookie({
      secret: 'secret',
      sessionId: 'sess_1',
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    })
    const value = cookiePair(cookie).split('=').slice(1).join('=')

    assert.equal(
      (await verifySessionCookieValue({ secret: 'secret', cookieValue: value }))
        ?.sessionId,
      'sess_1'
    )
    assert.equal(
      await verifySessionCookieValue({
        secret: 'secret',
        cookieValue: `${value}tampered`
      }),
      null
    )
  })

  it('validates signed Discord OAuth state cookies', async () => {
    const cookie = await createOAuthStateCookie({
      secret: 'secret',
      state: 'oauth-state',
      expiresAtMs: Date.now() + 60_000
    })

    assert.equal(
      await verifyOAuthStateCookie({
        secret: 'secret',
        cookieValue: cookiePair(cookie).split('=').slice(1).join('='),
        state: 'oauth-state'
      }),
      true
    )
  })

  it('returns the authenticated session from D1-backed cookies', async () => {
    const { env, cookie } = await createAuthenticatedEnv()
    const response = await worker.fetch(
      new Request('https://cepheus.example/api/session', {
        headers: { cookie }
      }),
      env
    )
    const body = (await response.json()) as {
      authenticated: boolean
      user?: { id?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(body.authenticated, true)
    assert.equal(body.user?.id, 'discord:1234')
  })

  it('fails closed before forwarding hosted room requests', async () => {
    const { env } = await createAuthenticatedEnv()
    const response = await worker.fetch(
      new Request('https://cepheus.example/rooms/room-1/state'),
      env
    )

    assert.equal(response.status, 401)
  })

  it('keeps local unauthenticated room requests on the direct development path', async () => {
    const { env, roomNamespace } = await createAuthenticatedEnv()
    const response = await worker.fetch(
      new Request('http://localhost:8787/rooms/room-1/state'),
      env
    )

    assert.equal(response.status, 200)
    assert.equal(roomNamespace.lastRequest?.url.includes('/rooms/room-1'), true)
  })

  it('creates local-only test sessions for private-beta browser tests', async () => {
    const db = new FakeD1()
    const env: Env = {
      GAME_ROOM: new CapturingRoomNamespace(),
      CEPHEUS_DB: db,
      SESSION_SECRET: 'test-session-secret'
    }

    const response = await worker.fetch(
      new Request('http://localhost:8787/api/test/session', {
        method: 'POST',
        body: JSON.stringify({
          discordId: 'local-owner',
          username: 'Local Owner'
        })
      }),
      env
    )
    const body = (await response.json()) as {
      authenticated?: boolean
      user?: { id?: string; username?: string }
    }
    const cookie = cookiePair(response.headers.get('set-cookie') ?? '')

    assert.equal(response.status, 200)
    assert.equal(body.authenticated, true)
    assert.equal(body.user?.id, 'discord:local-owner')
    assert.equal(body.user?.username, 'Local Owner')
    assert.match(cookie, /^cepheus_session=/)

    const sessionResponse = await worker.fetch(
      new Request('http://localhost:8787/api/session', {
        headers: { cookie }
      }),
      env
    )
    const sessionBody = (await sessionResponse.json()) as {
      authenticated?: boolean
      user?: { id?: string }
    }
    assert.equal(sessionBody.authenticated, true)
    assert.equal(sessionBody.user?.id, 'discord:local-owner')
  })

  it('does not expose local test session creation on hosted origins', async () => {
    const { env } = await createAuthenticatedEnv()
    const response = await worker.fetch(
      new Request('https://cepheus.example/api/test/session', {
        method: 'POST',
        body: JSON.stringify({ discordId: 'hosted-test' })
      }),
      env
    )

    assert.equal(response.status, 404)
  })

  it('forwards trusted membership headers and ignores forged viewer query roles', async () => {
    const { env, roomNamespace, cookie } = await createAuthenticatedEnv({
      roomRole: 'PLAYER'
    })

    const response = await worker.fetch(
      new Request('https://cepheus.example/rooms/room-1/state?viewer=referee', {
        headers: { cookie }
      }),
      env
    )

    assert.equal(response.status, 200)
    assert.equal(
      roomNamespace.lastRequest?.headers.get('x-cepheus-user-id'),
      'discord:1234'
    )
    assert.equal(
      roomNamespace.lastRequest?.headers.get('x-cepheus-viewer-role'),
      'PLAYER'
    )
  })

  it('stores uploaded room assets in R2 with D1 metadata and serves them to members', async () => {
    const { env, cookie } = await createAuthenticatedEnv({
      roomRole: 'REFEREE'
    })
    const form = new FormData()
    form.set(
      'file',
      new File([arrayBufferFromBytes(minimalPng(1200, 800))], 'board.png', {
        type: 'image/png'
      })
    )
    form.set('kind', 'geomorph')
    form.set('gridScale', '50')

    const uploadResponse = await worker.fetch(
      new Request('https://cepheus.example/api/rooms/room-1/assets', {
        method: 'POST',
        headers: { cookie },
        body: form
      }),
      env
    )
    const uploadBody = (await uploadResponse.json()) as {
      asset: { id: string; width: number; height: number; url: string }
    }

    assert.equal(uploadResponse.status, 201)
    assert.equal(uploadBody.asset.width, 1200)
    assert.equal(uploadBody.asset.height, 800)
    assert.match(uploadBody.asset.id, /^asset_/)

    const listResponse = await worker.fetch(
      new Request('https://cepheus.example/api/rooms/room-1/assets', {
        headers: { cookie }
      }),
      env
    )
    const listBody = (await listResponse.json()) as { assets: unknown[] }
    assert.equal(listResponse.status, 200)
    assert.equal(listBody.assets.length, 1)

    const assetResponse = await worker.fetch(
      new Request(`https://cepheus.example${uploadBody.asset.url}`, {
        headers: { cookie }
      }),
      env
    )
    assert.equal(assetResponse.status, 200)
    assert.equal(assetResponse.headers.get('content-type'), 'image/png')
  })

  it('rejects asset uploads from non-referee members', async () => {
    const { env, cookie } = await createAuthenticatedEnv({ roomRole: 'PLAYER' })
    const form = new FormData()
    form.set(
      'file',
      new File([arrayBufferFromBytes(minimalPng(100, 100))], 'counter.png', {
        type: 'image/png'
      })
    )

    const response = await worker.fetch(
      new Request('https://cepheus.example/api/rooms/room-1/assets', {
        method: 'POST',
        headers: { cookie },
        body: form
      }),
      env
    )

    assert.equal(response.status, 403)
  })

  it('exports owner-only room metadata with durable room data', async () => {
    const { env, cookie, roomNamespace } = await createAuthenticatedEnv({
      roomRole: 'OWNER'
    })
    roomNamespace.responseBody = {
      eventStream: [{ seq: 1, event: { type: 'GameCreated' } }],
      checkpoint: { seq: 1 },
      notes: { 'note-1': { title: 'Patron' } }
    }

    const response = await worker.fetch(
      new Request('https://cepheus.example/api/rooms/room-1/export', {
        headers: { cookie }
      }),
      env
    )
    const body = (await response.json()) as {
      room?: { id?: string }
      memberships?: unknown[]
      durableRoom?: { notes?: unknown }
    }

    assert.equal(response.status, 200)
    assert.equal(body.room?.id, 'room-1')
    assert.equal(body.memberships?.length, 1)
    assert.deepEqual(body.durableRoom?.notes, { 'note-1': { title: 'Patron' } })
    assert.equal(
      roomNamespace.lastRequest?.headers.get('x-cepheus-internal-admin'),
      'export'
    )
  })

  it('rejects room export for non-owner members', async () => {
    const { env, cookie } = await createAuthenticatedEnv({
      roomRole: 'REFEREE'
    })

    const response = await worker.fetch(
      new Request('https://cepheus.example/api/rooms/room-1/export', {
        headers: { cookie }
      }),
      env
    )

    assert.equal(response.status, 403)
  })

  it('deletes owner rooms by tombstoning D1, deleting R2 assets, and calling the DO', async () => {
    const { env, cookie, assetBucket, roomNamespace, store } =
      await createAuthenticatedEnv({
        roomRole: 'OWNER'
      })
    const asset = await store.createAsset({
      id: 'asset_delete',
      roomId: asGameId('room-1'),
      ownerId: asUserId('discord:1234'),
      kind: 'geomorph',
      r2Key: 'rooms/room-1/assets/asset_delete',
      contentType: 'image/png',
      byteSize: 24,
      width: 100,
      height: 100,
      gridScale: 50,
      losSidecar: null,
      now: '2026-05-17T00:00:00.000Z'
    })
    await assetBucket.put(
      asset.r2Key,
      arrayBufferFromBytes(minimalPng(100, 100))
    )

    const response = await worker.fetch(
      new Request('https://cepheus.example/api/rooms/room-1', {
        method: 'DELETE',
        headers: { cookie }
      }),
      env
    )

    assert.equal(response.status, 200)
    assert.equal(assetBucket.objects.size, 0)
    assert.equal(
      (await store.getRoom(asGameId('room-1')))?.deletedAt !== null,
      true
    )
    assert.equal(
      roomNamespace.lastRequest?.headers.get('x-cepheus-internal-admin'),
      'delete'
    )
  })
})
