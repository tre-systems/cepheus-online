import type { GameId } from '../../shared/ids'
import type { LiveActivityDescriptor } from '../../shared/live-activity'
import type { GameState } from '../../shared/state'
import type { DurableObjectStorage } from '../cloudflare'
import { getProjectedGameState } from './projection'

const revealAtMsForActivity = (
  activity: LiveActivityDescriptor
): number | null => {
  const revealAt =
    activity.type === 'diceRoll'
      ? activity.reveal.revealAt
      : activity.reveal?.revealAt
  if (!revealAt) return null

  const parsed = Date.parse(revealAt)
  return Number.isFinite(parsed) ? parsed : null
}

export const nextRevealBroadcastAtMs = (
  state: GameState,
  liveActivities: readonly LiveActivityDescriptor[],
  nowMs = Date.now()
): number | null => {
  const candidates = [
    ...state.diceLog.map((roll) => Date.parse(roll.revealAt)),
    ...liveActivities.flatMap((activity) => {
      const revealAt = revealAtMsForActivity(activity)
      return revealAt === null ? [] : [revealAt]
    })
  ].filter((revealAt) => Number.isFinite(revealAt) && revealAt > nowMs)

  return candidates.length === 0 ? null : Math.min(...candidates)
}

export interface RevealBroadcastScheduler {
  schedule: (
    state: GameState,
    liveActivities?: readonly LiveActivityDescriptor[]
  ) => void
  scheduleForGame: (gameId: GameId) => Promise<void>
  dispose: () => void
}

export const createRevealBroadcastScheduler = ({
  storage,
  broadcastState,
  reportError = () => {}
}: {
  storage: DurableObjectStorage
  broadcastState: (
    state: GameState,
    liveActivities?: readonly LiveActivityDescriptor[]
  ) => void
  reportError?: (error: unknown) => void
}): RevealBroadcastScheduler => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const schedule = (
    state: GameState,
    liveActivities: readonly LiveActivityDescriptor[] = []
  ): void => {
    const revealAtMs = nextRevealBroadcastAtMs(state, liveActivities)
    if (revealAtMs === null) return

    const key = `${state.id}:${revealAtMs}`
    if (timers.has(key)) return

    const timer = setTimeout(
      () => {
        timers.delete(key)
        void getProjectedGameState(storage, state.id)
          .then((projectedState) => {
            if (projectedState) {
              broadcastState(projectedState, liveActivities)
            }
          })
          .catch(reportError)
      },
      Math.max(0, revealAtMs - Date.now() + 20)
    )

    ;(timer as { unref?: () => void }).unref?.()
    timers.set(key, timer)
  }

  return {
    schedule,
    scheduleForGame: async (gameId) => {
      const projectedState = await getProjectedGameState(storage, gameId)
      if (projectedState) {
        schedule(projectedState)
      }
    },
    dispose: () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }
}
