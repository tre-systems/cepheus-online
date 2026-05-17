import type { GameState } from '../../../shared/state'
import type { ClientDiceRollActivity } from '../../game-commands'

export interface DiceRevealRoll {
  id: string
  revealAt: string
  rolls?: readonly number[]
  total?: number
}

export interface DiceRevealCoordinator {
  readonly revealedDiceIds: ReadonlySet<string>
  markRevealed: (rollId: string | null | undefined) => void
  waitForReveal: (roll: DiceRevealRoll | null | undefined) => Promise<void>
  waitForRevealOrDelay: (
    roll: DiceRevealRoll | null | undefined
  ) => Promise<void>
  diceRollsForStateDeferral: ({
    nextState,
    diceRollActivities
  }: DiceRevealStateDeferralInput) => DiceRevealRoll[]
  recordStateApplied: (nextState: GameState | null) => DiceRevealApplication
  resetStateTracking: () => void
  dispose: () => void
}

export interface DiceRevealStateDeferralInput {
  nextState: GameState | null
  diceRollActivities: readonly ClientDiceRollActivity[]
}

export interface DiceRevealApplication {
  previousDiceId: string | null
  latestRoll: DiceRevealRoll | null
  wasFirstStateApplied: boolean
}

export interface DiceRevealAnimationDecisionInput {
  latestRoll: DiceRevealRoll | null
  animateLatestDiceLog: boolean
  previousDiceId: string | null
  wasFirstStateApplied: boolean
  revealedDiceIds: ReadonlySet<string>
}

interface DiceRevealCoordinatorOptions {
  nowMs?: () => number
  setTimer?: (callback: () => void, delayMs: number) => unknown
  revealFallbackBufferMs?: number
}

const DEFAULT_REVEAL_FALLBACK_BUFFER_MS = 1_420

export const rollHasVisibleResult = (
  roll: DiceRevealRoll | null | undefined
): roll is DiceRevealRoll & { rolls: readonly number[]; total: number } =>
  Array.isArray(roll?.rolls) && typeof roll?.total === 'number'

export const shouldAnimateLatestDiceRoll = ({
  latestRoll,
  animateLatestDiceLog,
  previousDiceId,
  wasFirstStateApplied,
  revealedDiceIds
}: DiceRevealAnimationDecisionInput): boolean =>
  Boolean(
    latestRoll &&
      animateLatestDiceLog &&
      wasFirstStateApplied &&
      latestRoll.id !== previousDiceId &&
      (rollHasVisibleResult(latestRoll) || !revealedDiceIds.has(latestRoll.id))
  )

export const createDiceRevealCoordinator = ({
  nowMs = Date.now,
  setTimer = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  revealFallbackBufferMs = DEFAULT_REVEAL_FALLBACK_BUFFER_MS
}: DiceRevealCoordinatorOptions = {}): DiceRevealCoordinator => {
  const revealedDiceIds = new Set<string>()
  const revealWaiters = new Map<string, Array<() => void>>()
  let firstStateApplied = false
  let latestDiceId: string | null = null

  const resolveWaiters = (rollId: string): void => {
    const waiters = revealWaiters.get(rollId) || []
    revealWaiters.delete(rollId)
    for (const resolve of waiters) resolve()
  }

  const waitForReveal = (
    roll: DiceRevealRoll | null | undefined
  ): Promise<void> => {
    const rollId = roll?.id
    if (!rollId || revealedDiceIds.has(rollId)) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const waiters = revealWaiters.get(rollId) || []
      waiters.push(resolve)
      revealWaiters.set(rollId, waiters)
    })
  }

  return {
    revealedDiceIds,
    markRevealed: (rollId) => {
      if (!rollId) return
      revealedDiceIds.add(rollId)
      resolveWaiters(rollId)
    },
    waitForReveal,
    waitForRevealOrDelay: (roll) => {
      const revealAtMs = Date.parse(roll?.revealAt ?? '')
      if (!Number.isFinite(revealAtMs)) return waitForReveal(roll)
      const delayMs = Math.max(0, revealAtMs - nowMs()) + revealFallbackBufferMs
      return Promise.race([
        waitForReveal(roll),
        new Promise<void>((resolve) => setTimer(resolve, delayMs))
      ])
    },
    diceRollsForStateDeferral: ({ nextState, diceRollActivities }) => {
      const pendingActivities = diceRollActivities.filter(
        (activity) => !revealedDiceIds.has(activity.id)
      )
      if (pendingActivities.length > 0) return pendingActivities

      const latestRoll =
        nextState?.diceLog?.[nextState.diceLog.length - 1] ?? null
      if (!latestRoll) return []
      if (!rollHasVisibleResult(latestRoll)) return [latestRoll]
      if (!firstStateApplied && rollHasVisibleResult(latestRoll)) return []
      if (latestRoll.id === latestDiceId) return []
      if (revealedDiceIds.has(latestRoll.id)) return []
      return [latestRoll]
    },
    recordStateApplied: (nextState) => {
      const previousDiceId = latestDiceId
      const latestRoll =
        nextState?.diceLog?.[nextState.diceLog.length - 1] ?? null
      const wasFirstStateApplied = firstStateApplied
      latestDiceId = latestRoll?.id || null
      firstStateApplied = true

      return {
        previousDiceId,
        latestRoll,
        wasFirstStateApplied
      }
    },
    resetStateTracking: () => {
      firstStateApplied = false
      latestDiceId = null
    },
    dispose: () => {
      for (const rollId of revealWaiters.keys()) {
        resolveWaiters(rollId)
      }
    }
  }
}
