export interface DiceRevealTarget {
  id?: string | null
}

export interface DiceRevealState {
  readonly revealedDiceIds: ReadonlySet<string>
  markRevealed: (rollId: string | null | undefined) => void
  waitForReveal: (roll: DiceRevealTarget | null | undefined) => Promise<void>
  isRevealed: (rollId: string | null | undefined) => boolean
  dispose: () => void
}

export const createDiceRevealState = (): DiceRevealState => {
  const revealedDiceIds = new Set<string>()
  const revealWaiters = new Map<string, Array<() => void>>()

  const resolveWaiters = (rollId: string): void => {
    const waiters = revealWaiters.get(rollId) || []
    revealWaiters.delete(rollId)
    for (const resolve of waiters) resolve()
  }

  return {
    revealedDiceIds,
    markRevealed: (rollId) => {
      if (!rollId) return
      revealedDiceIds.add(rollId)
      resolveWaiters(rollId)
    },
    waitForReveal: (roll) => {
      const rollId = roll?.id
      if (!rollId || revealedDiceIds.has(rollId)) {
        return Promise.resolve()
      }

      return new Promise((resolve) => {
        const waiters = revealWaiters.get(rollId) || []
        waiters.push(resolve)
        revealWaiters.set(rollId, waiters)
      })
    },
    isRevealed: (rollId) => Boolean(rollId && revealedDiceIds.has(rollId)),
    dispose: () => {
      for (const rollId of revealWaiters.keys()) {
        resolveWaiters(rollId)
      }
    }
  }
}
