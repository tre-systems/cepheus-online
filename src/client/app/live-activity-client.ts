import type {
  ClientDiceRollActivity,
  ClientMessageApplication
} from '../game-commands.js'

export interface LiveActivityClientState {
  animatedDiceRollActivityIds: ReadonlySet<string>
  revealedDiceIds: ReadonlySet<string>
}

export interface PreparedLiveActivityApplication {
  diceRollActivities: readonly ClientDiceRollActivity[]
  deferDiceRevealIds: ReadonlySet<string>
  animateLatestDiceLog: boolean
}

export const filterPendingDiceRollActivities = (
  diceRollActivities: readonly ClientDiceRollActivity[],
  { animatedDiceRollActivityIds, revealedDiceIds }: LiveActivityClientState
): ClientDiceRollActivity[] =>
  diceRollActivities.filter(
    (activity) =>
      !animatedDiceRollActivityIds.has(activity.id) &&
      !revealedDiceIds.has(activity.id)
  )

export const prepareLiveActivityApplication = (
  application: Pick<ClientMessageApplication, 'diceRollActivities'>,
  state: LiveActivityClientState
): PreparedLiveActivityApplication => {
  const diceRollActivities = filterPendingDiceRollActivities(
    application.diceRollActivities,
    state
  )

  return {
    diceRollActivities,
    deferDiceRevealIds: new Set(
      diceRollActivities.map((activity) => activity.id)
    ),
    animateLatestDiceLog: application.diceRollActivities.length === 0
  }
}
