import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {asGameId} from '../../shared/ids'
import type {GameEvent} from '../../shared/events'
import {createMemoryStorage} from './test-support'
import {
  appendEvents,
  EVENT_CHUNK_SIZE,
  getEventSeq,
  readEventStream,
  readEventStreamTail
} from './storage'

const diceEvent = (total: number): GameEvent => ({
  type: 'DiceRolled',
  expression: '1d6',
  reason: `roll ${total}`,
  rolls: [total],
  total
})

describe('chunked event storage', () => {
  it('appends events across chunk boundaries', async () => {
    const storage = createMemoryStorage()
    const gameId = asGameId('game-1')
    const events = Array.from({length: EVENT_CHUNK_SIZE + 1}, (_, index) =>
      diceEvent(index + 1)
    )

    const envelopes = await appendEvents(
      storage,
      gameId,
      null,
      events,
      '2026-05-03T00:00:00.000Z'
    )

    assert.equal(envelopes.length, EVENT_CHUNK_SIZE + 1)
    assert.equal(envelopes[0]?.version, 1)
    assert.equal(envelopes[EVENT_CHUNK_SIZE]?.version, 1)
    assert.equal(await getEventSeq(storage, gameId), EVENT_CHUNK_SIZE + 1)
    assert.equal(storage.records.get(`eventChunkCount:${gameId}`), 2)
    const storedEvents = await readEventStream(storage, gameId)
    assert.equal(storedEvents.length, 65)
    assert.equal(storedEvents[0]?.version, 1)
    assert.equal(storedEvents[EVENT_CHUNK_SIZE]?.version, 1)
  })

  it('reads event tails without scanning earlier chunks', async () => {
    const storage = createMemoryStorage()
    const gameId = asGameId('game-1')

    await appendEvents(
      storage,
      gameId,
      null,
      Array.from({length: 70}, (_, index) => diceEvent(index + 1)),
      '2026-05-03T00:00:00.000Z'
    )

    const tail = await readEventStreamTail(storage, gameId, 64)

    assert.deepEqual(
      tail.map((event) => event.seq),
      [65, 66, 67, 68, 69, 70]
    )
  })
})
