import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {parseDiceExpression, rollDiceExpression} from './dice'

describe('dice expressions', () => {
  it('parses count, sides, and signed modifier', () => {
    const result = parseDiceExpression('2d6+3')

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, {
      count: 2,
      sides: 6,
      modifier: 3
    })
  })

  it('rolls with injected rng and persists the total', () => {
    const result = rollDiceExpression('2d6-1', () => 0)

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value.rolls, [1, 1])
    assert.equal(result.value.total, 1)
  })

  it('rejects unsupported notation', () => {
    const result = parseDiceExpression('d6')

    assert.equal(result.ok, false)
  })
})
