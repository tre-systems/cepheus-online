import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import type { DurableObjectStorage } from '../cloudflare'
import { createRevealBroadcastScheduler } from './reveal-scheduler'

const futureState = (revealAt: string): GameState =>
  ({
    id: asGameId('game-1'),
    diceLog: [
      {
        id: 'roll-1',
        expression: '2d6',
        reason: 'Hidden roll',
        rolls: [3, 4],
        total: 7,
        createdAt: '2026-05-16T10:00:00.000Z',
        revealAt
      }
    ]
  }) as unknown as GameState

describe('reveal broadcast scheduler', () => {
  it('does not schedule duplicate timers for the same reveal instant', () => {
    const originalSetTimeout = globalThis.setTimeout
    const originalDateNow = Date.now
    const scheduledCallbacks: Array<() => void> = []

    globalThis.setTimeout = ((callback: TimerHandler) => {
      scheduledCallbacks.push(
        typeof callback === 'function' ? (callback as () => void) : () => {}
      )
      return { unref() {} } as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout
    Date.now = () => Date.parse('2026-05-16T10:00:00.000Z')

    try {
      const scheduler = createRevealBroadcastScheduler({
        storage: {} as DurableObjectStorage,
        broadcastState: () => {}
      })
      const state = futureState('2026-05-16T10:00:10.000Z')

      scheduler.schedule(state, [])
      scheduler.schedule(state, [])

      assert.equal(scheduledCallbacks.length, 1)
      scheduler.dispose()
    } finally {
      globalThis.setTimeout = originalSetTimeout
      Date.now = originalDateNow
    }
  })

  it('reports failed post-reveal projection work', async () => {
    const originalSetTimeout = globalThis.setTimeout
    const originalDateNow = Date.now
    const scheduledCallbacks: Array<() => void> = []
    const errors: unknown[] = []

    globalThis.setTimeout = ((callback: TimerHandler) => {
      scheduledCallbacks.push(
        typeof callback === 'function' ? (callback as () => void) : () => {}
      )
      return { unref() {} } as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout
    Date.now = () => Date.parse('2026-05-16T10:00:00.000Z')

    try {
      const scheduler = createRevealBroadcastScheduler({
        storage: {
          async get() {
            throw new Error('projection failed')
          },
          async put() {},
          async delete() {
            return false
          }
        },
        broadcastState: () => {
          throw new Error('broadcast should not run')
        },
        reportError: (error) => errors.push(error)
      })

      scheduler.schedule(futureState('2026-05-16T10:00:01.000Z'), [])
      const callback = scheduledCallbacks[0]
      if (!callback) {
        throw new Error('Expected reveal callback to be scheduled')
      }
      callback()
      await new Promise<void>((resolve) => originalSetTimeout(resolve, 0))

      assert.equal(errors.length, 1)
      assert.equal((errors[0] as Error).message, 'projection failed')
      scheduler.dispose()
    } finally {
      globalThis.setTimeout = originalSetTimeout
      Date.now = originalDateNow
    }
  })
})
