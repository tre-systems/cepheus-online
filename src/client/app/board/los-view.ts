import type {
  MapDoorStateLookup,
  MapOccluder,
  MapVisibilityTarget
} from '../../../shared/mapAssets'
import { filterVisibleMapTargets } from '../../../shared/mapAssets'
import type { PieceId } from '../../../shared/ids'
import type { BoardState, PieceState } from '../../../shared/state'

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

export interface LosOverlaySegmentViewModel {
  id: string
  type: MapOccluder['type']
  x1: number
  y1: number
  x2: number
  y2: number
  open: boolean
  blocked: boolean
  label: string
}

export const deriveDoorToggleViewModels = (
  board: Pick<BoardState, 'doors' | 'losSidecar'> | null | undefined
): DoorToggleViewModel[] => {
  if (!board) return []

  const sidecarDoorIds = new Set<string>()
  const sidecarDoors =
    board.losSidecar?.occluders
      .filter((occluder) => occluder.type === 'door')
      .map((occluder) => {
        sidecarDoorIds.add(occluder.id)
        return {
          id: occluder.id,
          open: board.doors[occluder.id]?.open ?? occluder.open
        }
      }) ?? []
  const legacyDoors = Object.values(board.doors).filter(
    (door) => !sidecarDoorIds.has(door.id)
  )

  return [...sidecarDoors, ...legacyDoors].map((door) => ({
    id: door.id,
    open: door.open,
    label: door.id,
    stateLabel: door.open ? 'Open' : 'Closed',
    toggleLabel: door.open ? `Close ${door.id}` : `Open ${door.id}`,
    nextOpen: !door.open
  }))
}

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

export const deriveLosOverlaySegments = (
  occluders: readonly MapOccluder[],
  doorStates: MapDoorStateLookup = {}
): LosOverlaySegmentViewModel[] =>
  occluders.map((occluder) => {
    const currentDoorState = doorStates[occluder.id]
    const open =
      occluder.type === 'door'
        ? typeof currentDoorState === 'boolean'
          ? currentDoorState
          : (currentDoorState?.open ?? occluder.open)
        : false
    const blocked = occluder.type === 'wall' || !open

    return {
      id: occluder.id,
      type: occluder.type,
      x1: occluder.x1,
      y1: occluder.y1,
      x2: occluder.x2,
      y2: occluder.y2,
      open,
      blocked,
      label:
        occluder.type === 'wall'
          ? `Wall ${occluder.id}`
          : `${open ? 'Open' : 'Closed'} door ${occluder.id}`
    }
  })
