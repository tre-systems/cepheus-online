import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRequestIdFactory } from './request-id'

describe('request id factory', () => {
  it('preserves the prefix, base36 timestamp, and base36 counter shape', () => {
    const requestId = createRequestIdFactory({ now: () => 1234567890 })

    assert.equal(requestId('MovePiece'), 'MovePiece-kf12oi-1')
    assert.equal(requestId('MovePiece'), 'MovePiece-kf12oi-2')
  })

  it('uses an injected clock object when no now function is provided', () => {
    const requestId = createRequestIdFactory({
      clock: {
        now: () => 35
      }
    })

    assert.equal(requestId('CreateGame'), 'CreateGame-z-1')
  })

  it('keeps counters independent per factory instance', () => {
    const firstRequestId = createRequestIdFactory({ now: () => 71 })
    const secondRequestId = createRequestIdFactory({ now: () => 71 })

    assert.equal(firstRequestId('RollDice'), 'RollDice-1z-1')
    assert.equal(firstRequestId('RollDice'), 'RollDice-1z-2')
    assert.equal(secondRequestId('RollDice'), 'RollDice-1z-1')
  })
})
