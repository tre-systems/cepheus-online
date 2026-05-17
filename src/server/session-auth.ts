import { asUserId, type UserId } from '../shared/ids'
import type { Env } from './env'
import { PrivateBetaStore, type PrivateBetaUser } from './private-beta-store'

export const SESSION_COOKIE = 'cepheus_session'
export const OAUTH_STATE_COOKIE = 'cepheus_oauth_state'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10
const encoder = new TextEncoder()

export interface AuthenticatedSession {
  sessionId: string
  user: PrivateBetaUser
  expiresAt: string
}

export interface DiscordProfile {
  id: string
  username: string
  avatar: string | null
}

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export const randomToken = (byteLength = 32): string => {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export const randomId = (prefix: string): string =>
  `${prefix}_${randomToken(18)}`

const importHmacKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

const signPayload = async (
  secret: string,
  payload: string
): Promise<string> => {
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )
  return hex(new Uint8Array(signature))
}

const equalSignature = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

const signedValue = async (
  secret: string,
  parts: readonly string[]
): Promise<string> => {
  const payload = ['v1', ...parts].join('.')
  return `${payload}.${await signPayload(secret, payload)}`
}

const verifySignedValue = async (
  secret: string,
  value: string,
  partCount: number
): Promise<string[] | null> => {
  const parts = value.split('.')
  if (parts.length !== partCount + 2 || parts[0] !== 'v1') return null

  const signature = parts.at(-1)
  if (!signature) return null
  const payload = parts.slice(0, -1).join('.')
  const expected = await signPayload(secret, payload)
  if (!equalSignature(signature, expected)) return null

  return parts.slice(1, -1)
}

export const parseCookies = (request: Request): Record<string, string> => {
  const header = request.headers.get('cookie')
  if (!header) return {}

  const cookies: Record<string, string> = {}
  for (const segment of header.split(';')) {
    const [rawName, ...rawValue] = segment.trim().split('=')
    if (!rawName) continue
    cookies[rawName] = rawValue.join('=')
  }

  return cookies
}

export const setCookieHeader = ({
  name,
  value,
  maxAgeSeconds,
  httpOnly = true
}: {
  name: string
  value: string
  maxAgeSeconds: number
  httpOnly?: boolean
}): string => {
  const attributes = [
    `${name}=${value}`,
    'Path=/',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAgeSeconds}`
  ]
  if (httpOnly) attributes.push('HttpOnly')

  return attributes.join('; ')
}

export const clearCookieHeader = (name: string): string =>
  `${name}=; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=0`

export const createSessionCookie = async ({
  secret,
  sessionId,
  expiresAt
}: {
  secret: string
  sessionId: string
  expiresAt: string
}): Promise<string> => {
  const value = await signedValue(secret, [
    sessionId,
    String(Date.parse(expiresAt))
  ])

  return setCookieHeader({
    name: SESSION_COOKIE,
    value,
    maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000)
  })
}

export const createOAuthStateCookie = async ({
  secret,
  state,
  expiresAtMs
}: {
  secret: string
  state: string
  expiresAtMs: number
}): Promise<string> => {
  const value = await signedValue(secret, [state, String(expiresAtMs)])

  return setCookieHeader({
    name: OAUTH_STATE_COOKIE,
    value,
    maxAgeSeconds: Math.floor(OAUTH_STATE_TTL_MS / 1000)
  })
}

export const verifyOAuthStateCookie = async ({
  secret,
  cookieValue,
  state,
  nowMs = Date.now()
}: {
  secret: string
  cookieValue: string | undefined
  state: string | null
  nowMs?: number
}): Promise<boolean> => {
  if (!cookieValue || !state) return false
  const parts = await verifySignedValue(secret, cookieValue, 2)
  if (!parts) return false
  const [storedState, expiresAtMs] = parts
  return storedState === state && Number(expiresAtMs) > nowMs
}

export const createSessionExpiry = (nowMs = Date.now()): string =>
  new Date(nowMs + SESSION_TTL_MS).toISOString()

export const verifySessionCookieValue = async ({
  secret,
  cookieValue,
  nowMs = Date.now()
}: {
  secret: string
  cookieValue: string | undefined
  nowMs?: number
}): Promise<{ sessionId: string; expiresAtMs: number } | null> => {
  if (!cookieValue) return null
  const parts = await verifySignedValue(secret, cookieValue, 2)
  if (!parts) return null
  const [sessionId, rawExpiresAtMs] = parts
  const expiresAtMs = Number(rawExpiresAtMs)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null

  return { sessionId, expiresAtMs }
}

export const sessionAuthConfigured = (env: Env): boolean =>
  Boolean(env.CEPHEUS_DB && env.SESSION_SECRET)

export const discordAuthConfigured = (env: Env): boolean =>
  Boolean(
    env.CEPHEUS_DB &&
      env.SESSION_SECRET &&
      env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET &&
      env.APP_BASE_URL
  )

export const userIdFromDiscordProfile = (profile: DiscordProfile): UserId =>
  asUserId(`discord:${profile.id}`)

export const getAuthenticatedSession = async (
  request: Request,
  env: Env
): Promise<AuthenticatedSession | null> => {
  if (!env.CEPHEUS_DB || !env.SESSION_SECRET) return null

  const verified = await verifySessionCookieValue({
    secret: env.SESSION_SECRET,
    cookieValue: parseCookies(request)[SESSION_COOKIE]
  })
  if (!verified) return null

  const store = new PrivateBetaStore(env.CEPHEUS_DB)
  const session = await store.getSession(verified.sessionId)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null

  const user = await store.getUser(session.userId)
  if (!user) return null

  return {
    sessionId: session.id,
    user,
    expiresAt: session.expiresAt
  }
}
