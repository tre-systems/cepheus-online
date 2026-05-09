import type { GameState } from '../../shared/state'

export interface ProjectionParityMatch {
  readonly matches: true
}

export interface ProjectionParityMismatch {
  readonly matches: false
  readonly message: string
}

export type ProjectionParityResult =
  | ProjectionParityMatch
  | ProjectionParityMismatch

export const compareProjectionParity = (
  storedState: GameState | null,
  liveState: GameState | null
): ProjectionParityResult => {
  if (JSON.stringify(storedState) === JSON.stringify(liveState)) {
    return { matches: true }
  }

  return {
    matches: false,
    message: 'Stored event stream does not match live projection'
  }
}
