export interface ActorSessionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ActorSessionCrypto {
  getRandomValues<T extends Exclude<BufferSource, ArrayBuffer>>(array: T): T
}

export interface ResolveActorSessionSecretOptions {
  roomId: string
  actorId: string
  storage?: ActorSessionStorage
  crypto?: ActorSessionCrypto
}

const ACTOR_SESSION_PREFIX = 'cepheus.actorSession'

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const createActorSessionSecret = (crypto: ActorSessionCrypto): string => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export const actorSessionStorageKey = (
  roomId: string,
  actorId: string
): string => `${ACTOR_SESSION_PREFIX}.${roomId}.${actorId}`

export const resolveActorSessionSecret = ({
  roomId,
  actorId,
  storage = globalThis.localStorage,
  crypto = globalThis.crypto
}: ResolveActorSessionSecretOptions): string => {
  const key = actorSessionStorageKey(roomId, actorId)
  const existing = storage.getItem(key)
  if (existing) return existing

  const secret = createActorSessionSecret(crypto)
  storage.setItem(key, secret)
  return secret
}
