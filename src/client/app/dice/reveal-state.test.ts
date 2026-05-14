import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDiceRevealState } from './reveal-state'

const flushMicrotasks = () => Promise.resolve()

describe('dice reveal state', () => {
  it('resolves immediately when a roll is already revealed', async () => {
    const state = createDiceRevealState()
    state.markRevealed('roll-1')

    await state.waitForReveal({ id: 'roll-1' })

    assert.equal(state.isRevealed('roll-1'), true)
    assert.deepEqual([...state.revealedDiceIds], ['roll-1'])
  })

  it('resolves a pending waiter when the roll is revealed', async () => {
    const state = createDiceRevealState()
    let resolved = false

    const pending = state.waitForReveal({ id: 'roll-1' }).then(() => {
      resolved = true
    })

    await flushMicrotasks()
    assert.equal(resolved, false)

    state.markRevealed('roll-1')
    await pending

    assert.equal(resolved, true)
    assert.equal(state.isRevealed('roll-1'), true)
  })

  it('resolves multiple waiters for the same roll', async () => {
    const state = createDiceRevealState()
    const resolved: string[] = []

    const first = state.waitForReveal({ id: 'roll-1' }).then(() => {
      resolved.push('first')
    })
    const second = state.waitForReveal({ id: 'roll-1' }).then(() => {
      resolved.push('second')
    })

    await flushMicrotasks()
    assert.deepEqual(resolved, [])

    state.markRevealed('roll-1')
    await Promise.all([first, second])

    assert.deepEqual(resolved.sort(), ['first', 'second'])
  })
})
