import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  actorSessionStorageKey,
  resolveActorSessionSecret,
  type ActorSessionCrypto,
  type ActorSessionStorage
} from './actor-session'

const createStorage = (): ActorSessionStorage & {
  values: Map<string, string>
} => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

const deterministicCrypto = (start = 0): ActorSessionCrypto => ({
  getRandomValues: <T extends Exclude<BufferSource, ArrayBuffer>>(
    array: T
  ): T => {
    const bytes = new Uint8Array(
      array.buffer,
      array.byteOffset,
      array.byteLength
    )
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = (start + index) & 0xff
    }
    return array
  }
})

describe('actor session secrets', () => {
  it('creates and stores a per-room per-actor browser session secret', () => {
    const storage = createStorage()

    const secret = resolveActorSessionSecret({
      roomId: 'demo-room',
      actorId: 'local-user',
      storage,
      crypto: deterministicCrypto()
    })

    assert.equal(secret.length, 48)
    assert.equal(
      storage.values.get(actorSessionStorageKey('demo-room', 'local-user')),
      secret
    )
  })

  it('reuses an existing browser session secret', () => {
    const storage = createStorage()
    storage.setItem(
      actorSessionStorageKey('demo-room', 'local-user'),
      'existing-session-token'
    )

    const secret = resolveActorSessionSecret({
      roomId: 'demo-room',
      actorId: 'local-user',
      storage,
      crypto: deterministicCrypto(100)
    })

    assert.equal(secret, 'existing-session-token')
  })
})
