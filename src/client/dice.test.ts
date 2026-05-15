import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  deriveD6Face,
  deriveDicePipSlots,
  deriveDiceRollTiming,
  deriveDieFaces,
  deriveDieTilt
} from './dice'

describe('client dice helpers', () => {
  it('normalizes arbitrary values to d6 faces', () => {
    assert.equal(deriveD6Face(1), 1)
    assert.equal(deriveD6Face(6), 6)
    assert.equal(deriveD6Face(7), 1)
    assert.equal(deriveD6Face(0), 1)
    assert.equal(deriveD6Face(-1), 5)
    assert.equal(deriveD6Face(2.9), 2)
  })

  it('derives pip slots for d6 values and leaves larger faces numeric', () => {
    assert.deepEqual(deriveDicePipSlots(5), [
      'top-left',
      'top-right',
      'center',
      'bottom-left',
      'bottom-right'
    ])
    assert.equal(deriveDicePipSlots(8), null)
  })

  it('keeps the rolled value on the front face', () => {
    assert.deepEqual(deriveDieFaces(8), [
      { name: 'front', value: 8 },
      { name: 'back', value: 5 },
      { name: 'right', value: 3 },
      { name: 'left', value: 5 },
      { name: 'top', value: 6 },
      { name: 'bottom', value: 4 }
    ])
  })

  it('alternates the existing visual die tilt by index parity', () => {
    assert.deepEqual(deriveDieTilt(0), {
      x: '-22deg',
      y: '-34deg',
      z: '1deg'
    })
    assert.deepEqual(deriveDieTilt(1), {
      x: '-18deg',
      y: '-24deg',
      z: '-4deg'
    })
  })

  it('clamps roll animation timing to the visible reveal window', () => {
    const nowMs = Date.parse('2026-05-03T12:00:00.000Z')

    assert.deepEqual(
      deriveDiceRollTiming({
        revealAt: '2026-05-03T12:00:01.200Z',
        nowMs
      }),
      {
        rollDurationMs: 1200,
        visibleDurationMs: 1550
      }
    )
    assert.equal(
      deriveDiceRollTiming({
        revealAt: '2026-05-03T12:00:10.000Z',
        nowMs
      }).rollDurationMs,
      2200
    )
    assert.equal(
      deriveDiceRollTiming({
        revealAt: '2026-05-03T11:59:59.000Z',
        nowMs
      }).rollDurationMs,
      500
    )
  })
})
