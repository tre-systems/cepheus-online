import type { GameId, UserId } from '../shared/ids'
import { asGameId, asUserId } from '../shared/ids'
import type { MapAssetKind, MapLosSidecar } from '../shared/mapAssets'
import type { D1Database } from './cloudflare'

export type RoomMembershipRole = 'OWNER' | 'REFEREE' | 'PLAYER' | 'SPECTATOR'

export interface PrivateBetaUser {
  id: UserId
  discordId: string
  username: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface PrivateBetaSession {
  id: string
  userId: UserId
  expiresAt: string
  createdAt: string
}

export interface PrivateBetaRoom {
  id: GameId
  slug: string
  name: string
  ownerId: UserId
  rulesetId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PrivateBetaMembership {
  roomId: GameId
  userId: UserId
  role: RoomMembershipRole
  createdAt: string
}

export interface PrivateBetaInvite {
  token: string
  roomId: GameId
  createdBy: UserId
  role: Exclude<RoomMembershipRole, 'OWNER'>
  expiresAt: string | null
  acceptedAt: string | null
  createdAt: string
}

export interface PrivateBetaAsset {
  id: string
  roomId: GameId
  ownerId: UserId
  kind: MapAssetKind
  r2Key: string
  contentType: string
  byteSize: number
  width: number
  height: number
  gridScale: number
  losSidecar: MapLosSidecar | null
  createdAt: string
}

interface UserRow {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

interface SessionRow {
  id: string
  user_id: string
  expires_at: string
  created_at: string
}

interface RoomRow {
  id: string
  slug: string
  name: string
  owner_id: string
  ruleset_id: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

interface MembershipRow {
  room_id: string
  user_id: string
  role: RoomMembershipRole
  created_at: string
}

interface InviteRow {
  token: string
  room_id: string
  created_by: string
  role: Exclude<RoomMembershipRole, 'OWNER'>
  expires_at: string | null
  accepted_at: string | null
  created_at: string
}

interface AssetRow {
  id: string
  room_id: string
  owner_id: string
  kind: MapAssetKind
  r2_key: string
  content_type: string
  byte_size: number
  width: number
  height: number
  grid_scale: number
  los_sidecar_json: string | null
  created_at: string
}

const userFromRow = (row: UserRow): PrivateBetaUser => ({
  id: asUserId(row.id),
  discordId: row.discord_id,
  username: row.username,
  avatarUrl: row.avatar_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const sessionFromRow = (row: SessionRow): PrivateBetaSession => ({
  id: row.id,
  userId: asUserId(row.user_id),
  expiresAt: row.expires_at,
  createdAt: row.created_at
})

const roomFromRow = (row: RoomRow): PrivateBetaRoom => ({
  id: asGameId(row.id),
  slug: row.slug,
  name: row.name,
  ownerId: asUserId(row.owner_id),
  rulesetId: row.ruleset_id,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const membershipFromRow = (row: MembershipRow): PrivateBetaMembership => ({
  roomId: asGameId(row.room_id),
  userId: asUserId(row.user_id),
  role: row.role,
  createdAt: row.created_at
})

const inviteFromRow = (row: InviteRow): PrivateBetaInvite => ({
  token: row.token,
  roomId: asGameId(row.room_id),
  createdBy: asUserId(row.created_by),
  role: row.role,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at,
  createdAt: row.created_at
})

const assetFromRow = (row: AssetRow): PrivateBetaAsset => ({
  id: row.id,
  roomId: asGameId(row.room_id),
  ownerId: asUserId(row.owner_id),
  kind: row.kind,
  r2Key: row.r2_key,
  contentType: row.content_type,
  byteSize: Number(row.byte_size),
  width: Number(row.width),
  height: Number(row.height),
  gridScale: Number(row.grid_scale),
  losSidecar: row.los_sidecar_json
    ? (JSON.parse(row.los_sidecar_json) as MapLosSidecar)
    : null,
  createdAt: row.created_at
})

export class PrivateBetaStore {
  constructor(private readonly db: D1Database) {}

  async upsertDiscordUser({
    id,
    discordId,
    username,
    avatarUrl,
    now
  }: {
    id: UserId
    discordId: string
    username: string
    avatarUrl: string | null
    now: string
  }): Promise<PrivateBetaUser> {
    await this.db
      .prepare(
        `INSERT INTO users (id, discord_id, username, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(discord_id) DO UPDATE SET
           username = excluded.username,
           avatar_url = excluded.avatar_url,
           updated_at = excluded.updated_at`
      )
      .bind(id, discordId, username, avatarUrl, now, now)
      .run()

    const row = await this.db
      .prepare('SELECT * FROM users WHERE discord_id = ?')
      .bind(discordId)
      .first<UserRow>()
    if (!row) throw new Error('User upsert did not return a row')

    return userFromRow(row)
  }

  async getUser(userId: UserId): Promise<PrivateBetaUser | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>()

    return row ? userFromRow(row) : null
  }

  async createSession({
    id,
    userId,
    expiresAt,
    now
  }: {
    id: string
    userId: UserId
    expiresAt: string
    now: string
  }): Promise<PrivateBetaSession> {
    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(id, userId, expiresAt, now)
      .run()

    return {
      id,
      userId,
      expiresAt,
      createdAt: now
    }
  }

  async getSession(sessionId: string): Promise<PrivateBetaSession | null> {
    const row = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<SessionRow>()

    return row ? sessionFromRow(row) : null
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE id = ?')
      .bind(sessionId)
      .run()
  }

  async createRoom({
    roomId,
    slug,
    name,
    ownerId,
    rulesetId,
    now
  }: {
    roomId: GameId
    slug: string
    name: string
    ownerId: UserId
    rulesetId?: string | null
    now: string
  }): Promise<PrivateBetaRoom> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO rooms (id, slug, name, owner_id, ruleset_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(roomId, slug, name, ownerId, rulesetId ?? null, now, now),
      this.db
        .prepare(
          `INSERT INTO room_memberships (room_id, user_id, role, created_at)
           VALUES (?, ?, 'OWNER', ?)`
        )
        .bind(roomId, ownerId, now)
    ])

    const room = await this.getRoom(roomId)
    if (!room) throw new Error('Room creation did not return a row')

    return room
  }

  async getRoom(roomId: GameId): Promise<PrivateBetaRoom | null> {
    const row = await this.db
      .prepare('SELECT * FROM rooms WHERE id = ?')
      .bind(roomId)
      .first<RoomRow>()

    return row ? roomFromRow(row) : null
  }

  async getMembership(
    roomId: GameId,
    userId: UserId
  ): Promise<PrivateBetaMembership | null> {
    const row = await this.db
      .prepare(
        'SELECT * FROM room_memberships WHERE room_id = ? AND user_id = ?'
      )
      .bind(roomId, userId)
      .first<MembershipRow>()

    return row ? membershipFromRow(row) : null
  }

  async listRoomMemberships(roomId: GameId): Promise<PrivateBetaMembership[]> {
    const result = await this.db
      .prepare('SELECT * FROM room_memberships WHERE room_id = ?')
      .bind(roomId)
      .all<MembershipRow>()

    return (result.results ?? []).map(membershipFromRow)
  }

  async createMembership({
    roomId,
    userId,
    role,
    now
  }: {
    roomId: GameId
    userId: UserId
    role: RoomMembershipRole
    now: string
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO room_memberships (room_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(room_id, user_id) DO UPDATE SET role = excluded.role`
      )
      .bind(roomId, userId, role, now)
      .run()
  }

  async markRoomDeleted(roomId: GameId, now: string): Promise<void> {
    await this.db
      .prepare('UPDATE rooms SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, roomId)
      .run()
  }

  async createInvite({
    token,
    roomId,
    createdBy,
    role,
    expiresAt,
    now
  }: {
    token: string
    roomId: GameId
    createdBy: UserId
    role: Exclude<RoomMembershipRole, 'OWNER'>
    expiresAt: string | null
    now: string
  }): Promise<PrivateBetaInvite> {
    await this.db
      .prepare(
        `INSERT INTO room_invites
           (token, room_id, created_by, role, expires_at, accepted_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`
      )
      .bind(token, roomId, createdBy, role, expiresAt, now)
      .run()

    return {
      token,
      roomId,
      createdBy,
      role,
      expiresAt,
      acceptedAt: null,
      createdAt: now
    }
  }

  async getInvite(token: string): Promise<PrivateBetaInvite | null> {
    const row = await this.db
      .prepare('SELECT * FROM room_invites WHERE token = ?')
      .bind(token)
      .first<InviteRow>()

    return row ? inviteFromRow(row) : null
  }

  async markInviteAccepted(token: string, now: string): Promise<void> {
    await this.db
      .prepare('UPDATE room_invites SET accepted_at = ? WHERE token = ?')
      .bind(now, token)
      .run()
  }

  async createAsset({
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
    losSidecar,
    now
  }: {
    id: string
    roomId: GameId
    ownerId: UserId
    kind: MapAssetKind
    r2Key: string
    contentType: string
    byteSize: number
    width: number
    height: number
    gridScale: number
    losSidecar: MapLosSidecar | null
    now: string
  }): Promise<PrivateBetaAsset> {
    await this.db
      .prepare(
        `INSERT INTO assets
           (id, room_id, owner_id, kind, r2_key, content_type, byte_size, width, height, grid_scale, los_sidecar_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
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
        losSidecar ? JSON.stringify(losSidecar) : null,
        now
      )
      .run()

    return {
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
      losSidecar,
      createdAt: now
    }
  }

  async getAsset(assetId: string): Promise<PrivateBetaAsset | null> {
    const row = await this.db
      .prepare('SELECT * FROM assets WHERE id = ?')
      .bind(assetId)
      .first<AssetRow>()

    return row ? assetFromRow(row) : null
  }

  async listRoomAssets(roomId: GameId): Promise<PrivateBetaAsset[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM assets WHERE room_id = ? ORDER BY created_at DESC'
      )
      .bind(roomId)
      .all<AssetRow>()

    return (result.results ?? []).map(assetFromRow)
  }
}
