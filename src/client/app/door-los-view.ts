import type {
  MapDoorStateLookup,
  MapOccluder,
  MapVisibilityTarget
} from '../../shared/mapAssets'
import { filterVisibleMapTargets } from '../../shared/mapAssets.js'
import type { PieceId } from '../../shared/ids'
import type { BoardState, PieceState } from '../../shared/state'

export interface DoorToggleViewModel {
  id: string
  open: boolean
  label: string
  stateLabel: 'Open' | 'Closed'
  toggleLabel: string
  nextOpen: boolean
}

export interface PieceRectTarget extends MapVisibilityTarget {
  id: PieceId
}

export const deriveDoorToggleViewModels = (
  board: Pick<BoardState, 'doors'> | null | undefined
): DoorToggleViewModel[] =>
  Object.values(board?.doors ?? {}).map((door) => ({
    id: door.id,
    open: door.open,
    label: door.id,
    stateLabel: door.open ? 'Open' : 'Closed',
    toggleLabel: door.open ? `Close ${door.id}` : `Open ${door.id}`,
    nextOpen: !door.open
  }))

export const derivePieceRectTargets = (
  pieces: readonly PieceState[]
): PieceRectTarget[] =>
  pieces.map((piece) => ({
    id: piece.id,
    rect: {
      x: piece.x,
      y: piece.y,
      width: piece.width * piece.scale,
      height: piece.height * piece.scale
    }
  }))

export const deriveVisiblePieceIds = (
  sourcePieceId: PieceId,
  pieces: readonly PieceState[],
  occluders: readonly MapOccluder[],
  doorStates: MapDoorStateLookup = {}
): PieceId[] => {
  const targets = derivePieceRectTargets(pieces)
  const source = targets.find((target) => target.id === sourcePieceId)

  if (!source) return []

  return filterVisibleMapTargets(
    source.rect,
    targets.filter((target) => target.id !== sourcePieceId),
    occluders,
    doorStates
  ).map((target) => target.id)
}
