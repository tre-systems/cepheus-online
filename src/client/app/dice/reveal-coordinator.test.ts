import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId, asUserId } from '../../../shared/ids'
import type { DiceRollState, GameState } from '../../../shared/state'
import type { ClientDiceRollActivity } from '../../game-commands'
import {
  createDiceRevealCoordinator,
  shouldAnimateLatestDiceRoll
} from './reveal-coordinator'

const flushMicrotasks = () => Promise.resolve()

const diceRoll = (id: string, revealAt = '2026-05-08T10:00:02.000Z') =>
  ({
    id,
    actorId: null,
    createdAt: '2026-05-08T10:00:00.000Z',
    revealAt,
    expression: '2d6',
    reason: 'Test roll',
    rolls: [3, 4],
    total: 7
  }) satisfies DiceRollState

const activity = (
  id: string,
  revealAt = '2026-05-08T10:00:02.000Z'
): ClientDiceRollActivity => ({
  id,
  revealAt,
  rolls: [3, 4],
  total: 7
})

const redactedActivity = (
  id: string,
  revealAt = '2026-05-08T10:00:02.000Z'
): ClientDiceRollActivity => ({
  id,
  revealAt
})

type RedactedDiceRollState = Omit<DiceRollState, 'rolls' | 'total'>

const redactedDiceRoll = (
  id: string,
  revealAt = '2026-05-08T10:00:02.000Z'
): RedactedDiceRollState => ({
  id,
  actorId: null,
  createdAt: '2026-05-08T10:00:00.000Z',
  revealAt,
  expression: '2d6',
  reason: 'Test roll'
})

const gameState = (
  diceLog: readonly (DiceRollState | RedactedDiceRollState)[]
): GameState => ({
  id: asGameId('game-1'),
  slug: 'game-1',
  name: 'Game 1',
  ownerId: asUserId('referee'),
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [...diceLog] as DiceRollState[],
  selectedBoardId: null,
  eventSeq: diceLog.length
})

describe('dice reveal coordinator', () => {
  it('animates a revealed result even after the pending placeholder resolved', () => {
    assert.equal(
      shouldAnimateLatestDiceRoll({
        latestRoll: diceRoll('roll-1'),
        animateLatestDiceLog: true,
        previousDiceId: 'roll-0',
        wasFirstStateApplied: true,
        revealedDiceIds: new Set(['roll-1'])
      }),
      true
    )
  })

  it('does not replay an already-resolved redacted placeholder', () => {
    assert.equal(
      shouldAnimateLatestDiceRoll({
        latestRoll: redactedDiceRoll('roll-1'),
        animateLatestDiceLog: true,
        previousDiceId: 'roll-0',
        wasFirstStateApplied: true,
        revealedDiceIds: new Set(['roll-1'])
      }),
      false
    )
  })

  it('marks rolls revealed and resolves pending waiters', async () => {
    const coordinator = createDiceRevealCoordinator()
    let resolved = false

    const pending = coordinator.waitForReveal(diceRoll('roll-1')).then(() => {
      resolved = true
    })

    await flushMicrotasks()
    assert.equal(resolved, false)

    coordinator.markRevealed('roll-1')
    await pending

    assert.equal(resolved, true)
    assert.deepEqual([...coordinator.revealedDiceIds], ['roll-1'])
  })

  it('uses revealAt as a fallback when no reveal signal arrives', async () => {
    let timer: (() => void) | null = null
    let delayMs: number | null = null
    const coordinator = createDiceRevealCoordinator({
      nowMs: () => Date.parse('2026-05-08T10:00:00.000Z'),
      setTimer: (callback, delay) => {
        timer = callback
        delayMs = delay
        return 1
      },
      revealFallbackBufferMs: 220
    })
    let resolved = false

    const pending = coordinator
      .waitForRevealOrDelay(diceRoll('roll-1'))
      .then(() => {
        resolved = true
      })

    await flushMicrotasks()
    assert.equal(resolved, false)
    assert.equal(delayMs, 2220)

    if (!timer) {
      throw new Error('Expected reveal fallback timer to be scheduled')
    }
    const runTimer: () => void = timer
    runTimer()
    await pending

    assert.equal(resolved, true)
  })

  it('uses revealAt as a fallback for redacted reveal targets', async () => {
    let timer: (() => void) | null = null
    let delayMs: number | null = null
    const coordinator = createDiceRevealCoordinator({
      nowMs: () => Date.parse('2026-05-08T10:00:00.000Z'),
      setTimer: (callback, delay) => {
        timer = callback
        delayMs = delay
        return 1
      },
      revealFallbackBufferMs: 220
    })
    let resolved = false

    const pending = coordinator
      .waitForRevealOrDelay(redactedActivity('roll-1'))
      .then(() => {
        resolved = true
      })

    await flushMicrotasks()
    assert.equal(resolved, false)
    assert.equal(delayMs, 2220)

    if (!timer) {
      throw new Error('Expected reveal fallback timer to be scheduled')
    }
    const runTimer: () => void = timer
    runTimer()
    await pending

    assert.equal(resolved, true)
  })

  it('keeps elapsed redacted reveals behind the pending dice animation boundary', async () => {
    let delayMs: number | null = null
    const coordinator = createDiceRevealCoordinator({
      nowMs: () => Date.parse('2026-05-08T10:00:03.000Z'),
      setTimer: (_callback, delay) => {
        delayMs = delay
        return 1
      }
    })

    void coordinator.waitForRevealOrDelay(
      redactedActivity('roll-1', '2026-05-08T10:00:02.000Z')
    )

    await flushMicrotasks()
    assert.equal(delayMs, 1420)
  })

  it('falls back to explicit reveal waiting when revealAt is invalid', async () => {
    let timerScheduled = false
    const coordinator = createDiceRevealCoordinator({
      setTimer: () => {
        timerScheduled = true
        return 1
      }
    })
    let resolved = false

    const pending = coordinator
      .waitForRevealOrDelay(diceRoll('roll-1', 'not-a-date'))
      .then(() => {
        resolved = true
      })

    await flushMicrotasks()
    assert.equal(timerScheduled, false)
    assert.equal(resolved, false)

    coordinator.markRevealed('roll-1')
    await pending

    assert.equal(resolved, true)
  })

  it('does not defer the first applied state update', () => {
    const coordinator = createDiceRevealCoordinator()

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1')]),
        diceRollActivities: []
      }),
      []
    )
  })

  it('defers pending live dice activities after state has been applied', () => {
    const coordinator = createDiceRevealCoordinator()
    coordinator.recordStateApplied(gameState([]))

    const pending = activity('roll-1')
    const revealed = activity('roll-2')
    coordinator.markRevealed(revealed.id)

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1')]),
        diceRollActivities: [pending, revealed]
      }),
      [pending]
    )
  })

  it('defers redacted pending live dice activities after state has been applied', () => {
    const coordinator = createDiceRevealCoordinator()
    coordinator.recordStateApplied(gameState([]))

    const pending = redactedActivity('roll-1')

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([redactedDiceRoll('roll-1')]),
        diceRollActivities: [pending]
      }),
      [pending]
    )
  })

  it('defers redacted pending live dice activities before first state is applied', () => {
    const coordinator = createDiceRevealCoordinator()
    const pending = redactedActivity('roll-1')

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([redactedDiceRoll('roll-1')]),
        diceRollActivities: [pending]
      }),
      [pending]
    )
  })

  it('keeps deferring a redacted dice log roll until a visible refresh arrives', () => {
    const coordinator = createDiceRevealCoordinator()
    const pending = redactedDiceRoll('roll-1')

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([pending]),
        diceRollActivities: []
      }),
      [pending]
    )

    coordinator.markRevealed('roll-1')

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([pending]),
        diceRollActivities: []
      }),
      [pending]
    )
  })

  it('does not defer a first state that already contains visible dice results', () => {
    const coordinator = createDiceRevealCoordinator()

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1')]),
        diceRollActivities: []
      }),
      []
    )
  })

  it('uses live activity reveal targets before falling back to the latest dice log roll', () => {
    const coordinator = createDiceRevealCoordinator()
    coordinator.recordStateApplied(gameState([diceRoll('roll-1')]))

    const liveRoll = activity('live-roll-1')
    const latestRoll = diceRoll('roll-2')

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1'), latestRoll]),
        diceRollActivities: [liveRoll]
      }),
      [liveRoll]
    )

    coordinator.markRevealed(liveRoll.id)

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1'), latestRoll]),
        diceRollActivities: [liveRoll]
      }),
      [latestRoll]
    )
  })

  it('defers a new latest dice log roll until it is revealed', () => {
    const coordinator = createDiceRevealCoordinator()
    coordinator.recordStateApplied(gameState([diceRoll('roll-1')]))

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1'), diceRoll('roll-2')]),
        diceRollActivities: []
      }),
      [diceRoll('roll-2')]
    )

    coordinator.markRevealed('roll-2')

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-1'), diceRoll('roll-2')]),
        diceRollActivities: []
      }),
      []
    )
  })

  it('reports previous and latest dice IDs when state is applied', () => {
    const coordinator = createDiceRevealCoordinator()

    const first = coordinator.recordStateApplied(
      gameState([diceRoll('roll-1')])
    )
    const second = coordinator.recordStateApplied(
      gameState([diceRoll('roll-1'), diceRoll('roll-2')])
    )

    assert.equal(first.wasFirstStateApplied, false)
    assert.equal(first.previousDiceId, null)
    assert.equal(first.latestRoll?.id, 'roll-1')
    assert.equal(second.wasFirstStateApplied, true)
    assert.equal(second.previousDiceId, 'roll-1')
    assert.equal(second.latestRoll?.id, 'roll-2')
  })

  it('records applied redacted dice log rolls without result fields', () => {
    const coordinator = createDiceRevealCoordinator()

    const first = coordinator.recordStateApplied(
      gameState([redactedDiceRoll('roll-1')])
    )
    const second = coordinator.recordStateApplied(
      gameState([redactedDiceRoll('roll-1'), redactedDiceRoll('roll-2')])
    )

    assert.equal(first.wasFirstStateApplied, false)
    assert.equal(first.previousDiceId, null)
    assert.equal(first.latestRoll?.id, 'roll-1')
    assert.equal('rolls' in (first.latestRoll ?? {}), false)
    assert.equal('total' in (first.latestRoll ?? {}), false)
    assert.equal(second.wasFirstStateApplied, true)
    assert.equal(second.previousDiceId, 'roll-1')
    assert.equal(second.latestRoll?.id, 'roll-2')
    assert.equal('rolls' in (second.latestRoll ?? {}), false)
    assert.equal('total' in (second.latestRoll ?? {}), false)
  })

  it('resets state tracking for room changes', () => {
    const coordinator = createDiceRevealCoordinator()
    coordinator.recordStateApplied(gameState([diceRoll('roll-1')]))
    coordinator.resetStateTracking()

    assert.deepEqual(
      coordinator.diceRollsForStateDeferral({
        nextState: gameState([diceRoll('roll-2')]),
        diceRollActivities: []
      }),
      []
    )
  })
})
