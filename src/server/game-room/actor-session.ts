import type { GameId } from '../../shared/ids'
import type { CommandError } from '../../shared/protocol'
import type { Result } from '../../shared/result'
import type { DurableObjectStorage } from '../cloudflare'
import { commandError } from './command-helpers'

export const ACTOR_SESSION_HEADER = 'x-cepheus-actor-session'
export const ACTOR_SESSION_TAG_PREFIX = 'session:'

const ACTOR_SESSION_PATTERN = /^[A-Za-z0-9_-]{24,128}$/

const actorSessionKey = (gameId: GameId, actorId: string): string =>
  `actorSession:${gameId}:${actorId}`

export const normalizeActorSessionSecret = (
  value: string | null
): string | null => {
  const trimmed = value?.trim()
  if (!trimmed || !ACTOR_SESSION_PATTERN.test(trimmed)) return null
  return trimmed
}

export const actorSessionTag = (actorSessionSecret: string): string =>
  `${ACTOR_SESSION_TAG_PREFIX}${actorSessionSecret}`

export const actorSessionSecretFromTags = (
  tags: readonly string[]
): string | null => {
  const sessionTag = tags.find((tag) =>
    tag.startsWith(ACTOR_SESSION_TAG_PREFIX)
  )
  return normalizeActorSessionSecret(
    sessionTag?.slice(ACTOR_SESSION_TAG_PREFIX.length) ?? null
  )
}

export const bindOrVerifyActorSession = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  actorId: string,
  actorSessionSecret: string | null
): Promise<Result<void, CommandError>> => {
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
  const existing = await storage.get<string>(key)
  if (existing === undefined) {
    await storage.put(key, actorSessionSecret)
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
