import type { GameState } from '../state'

export const requireState = (
  state: GameState | null,
  eventType: string
): GameState => {
  if (!state) throw new Error(`${eventType} before GameCreated`)
  return state
}
