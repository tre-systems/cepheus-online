import { err, ok, type Result } from './result'
import { isObject } from './util'

export const LOCAL_MAP_ASSET_ROOTS = ['Geomorphs', 'Counters'] as const

export type LocalMapAssetRoot = (typeof LOCAL_MAP_ASSET_ROOTS)[number]

export type MapAssetKind = 'geomorph' | 'counter'

export type GeomorphTileKind = 'standard' | 'edge' | 'corner' | 'custom'

export interface LocalMapAssetMetadataInput {
  root: LocalMapAssetRoot
  relativePath: string
  kind: MapAssetKind
  width: number
  height: number
  gridScale: number
}

export interface LocalMapAssetMetadata extends LocalMapAssetMetadataInput {
  tileKind: GeomorphTileKind | null
}

export type MapOccluder =
  | {
      type: 'wall'
      id: string
      x1: number
      y1: number
      x2: number
      y2: number
    }
  | {
      type: 'door'
      id: string
      x1: number
      y1: number
      x2: number
      y2: number
      open: boolean
    }

export interface MapLosSidecar {
  assetRef: string
  width: number
  height: number
  gridScale: number
  occluders: MapOccluder[]
}

export interface MapPoint {
  x: number
  y: number
}

export interface MapSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MapDoorStateLookup = Readonly<
  Record<
    string,
    { readonly id?: string; readonly open: boolean } | boolean | undefined
  >
>

const isLocalMapAssetRoot = (value: unknown): value is LocalMapAssetRoot =>
  LOCAL_MAP_ASSET_ROOTS.includes(value as LocalMapAssetRoot)

const isMapAssetKind = (value: unknown): value is MapAssetKind =>
  value === 'geomorph' || value === 'counter'

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const hasUnsafePathSegment = (path: string): boolean =>
  path
    .split(/[\\/]/)
    .some((segment) => segment === '' || segment === '.' || segment === '..')

const isCoordinateInBounds = (value: unknown, max: number): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= max

const pushSegmentErrors = (
  errors: string[],
  occluder: Record<string, unknown>,
  index: number,
  width: number,
  height: number
): void => {
  const { x1, y1, x2, y2 } = occluder

  if (!isCoordinateInBounds(x1, width)) {
    errors.push(`Occluder ${index} x1 must be within map bounds.`)
  }
  if (!isCoordinateInBounds(x2, width)) {
    errors.push(`Occluder ${index} x2 must be within map bounds.`)
  }
  if (!isCoordinateInBounds(y1, height)) {
    errors.push(`Occluder ${index} y1 must be within map bounds.`)
  }
  if (!isCoordinateInBounds(y2, height)) {
    errors.push(`Occluder ${index} y2 must be within map bounds.`)
  }

  if (x1 === x2 && y1 === y2) {
    errors.push(`Occluder ${index} must have a non-zero segment length.`)
  }
}

const validateMapOccluder = (
  value: unknown,
  index: number,
  width: number,
  height: number,
  seenIds: Set<string>
): Result<MapOccluder, string[]> => {
  const errors: string[] = []

  if (!isObject(value)) {
    return err([`Occluder ${index} must be an object.`])
  }

  const { type, id, x1, y1, x2, y2, open } = value

  if (type !== 'wall' && type !== 'door') {
    errors.push(`Occluder ${index} type must be wall or door.`)
  }

  if (typeof id !== 'string' || id.length === 0) {
    errors.push(`Occluder ${index} id is required.`)
  } else if (seenIds.has(id)) {
    errors.push(`Occluder ${index} id must be unique.`)
  } else {
    seenIds.add(id)
  }

  pushSegmentErrors(errors, value, index, width, height)

  if (type === 'door' && typeof open !== 'boolean') {
    errors.push(`Occluder ${index} door open state must be boolean.`)
  }

  if (errors.length > 0) return err(errors)

  const segment = { id, x1, y1, x2, y2 } as {
    id: string
    x1: number
    y1: number
    x2: number
    y2: number
  }

  if (type === 'door') {
    return ok({
      type,
      ...segment,
      open
    } as MapOccluder)
  }

  return ok({
    type,
    ...segment
  } as MapOccluder)
}

export const deriveGeomorphTileKind = (
  width: number,
  height: number
): GeomorphTileKind => {
  if (width === 1000 && height === 1000) return 'standard'
  if (width === 1000 && height === 530) return 'edge'
  if (width === 530 && height === 530) return 'corner'

  return 'custom'
}

export const validateLocalMapAssetMetadata = (
  value: unknown
): Result<LocalMapAssetMetadata, string[]> => {
  const errors: string[] = []

  if (!isObject(value)) {
    return err(['Metadata must be an object.'])
  }

  const { root, relativePath, kind, width, height, gridScale } = value

  if (!isLocalMapAssetRoot(root)) {
    errors.push('Root must be Geomorphs or Counters.')
  }

  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    errors.push('Relative path is required.')
  } else if (
    relativePath.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    hasUnsafePathSegment(relativePath)
  ) {
    errors.push('Relative path must stay inside the local asset root.')
  }

  if (!isMapAssetKind(kind)) {
    errors.push('Kind must be geomorph or counter.')
  } else if (root === 'Geomorphs' && kind !== 'geomorph') {
    errors.push('Geomorphs assets must use geomorph kind.')
  } else if (root === 'Counters' && kind !== 'counter') {
    errors.push('Counters assets must use counter kind.')
  }

  if (!isPositiveFiniteNumber(width)) errors.push('Width must be positive.')
  if (!isPositiveFiniteNumber(height)) errors.push('Height must be positive.')
  if (!isPositiveFiniteNumber(gridScale)) {
    errors.push('Grid scale must be positive.')
  }

  if (errors.length > 0) return err(errors)

  const metadata = {
    root,
    relativePath,
    kind,
    width,
    height,
    gridScale
  } as LocalMapAssetMetadataInput

  const tileKind =
    metadata.kind === 'geomorph'
      ? deriveGeomorphTileKind(metadata.width, metadata.height)
      : null

  return ok({
    ...metadata,
    tileKind
  })
}

export const validateMapLosSidecar = (
  value: unknown
): Result<MapLosSidecar, string[]> => {
  const errors: string[] = []

  if (!isObject(value)) {
    return err(['LOS sidecar must be an object.'])
  }

  const { assetRef, width, height, gridScale, occluders } = value

  if (typeof assetRef !== 'string' || assetRef.length === 0) {
    errors.push('Asset reference is required.')
  }
  if (!isPositiveFiniteNumber(width)) errors.push('Width must be positive.')
  if (!isPositiveFiniteNumber(height)) errors.push('Height must be positive.')
  if (!isPositiveFiniteNumber(gridScale)) {
    errors.push('Grid scale must be positive.')
  }
  if (!Array.isArray(occluders)) {
    errors.push('Occluders must be an array.')
  }

  if (errors.length > 0) return err(errors)

  const validWidth = width as number
  const validHeight = height as number
  const seenIds = new Set<string>()
  const validOccluders: MapOccluder[] = []

  for (const [index, occluder] of (occluders as unknown[]).entries()) {
    const result = validateMapOccluder(
      occluder,
      index,
      validWidth,
      validHeight,
      seenIds
    )
    if (result.ok) {
      validOccluders.push(result.value)
    } else {
      errors.push(...result.error)
    }
  }

  if (errors.length > 0) return err(errors)

  return ok({
    assetRef,
    width: validWidth,
    height: validHeight,
    gridScale: gridScale as number,
    occluders: validOccluders
  } as MapLosSidecar)
}

const orientation = (a: MapPoint, b: MapPoint, c: MapPoint): -1 | 0 | 1 => {
  const cross = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)

  if (cross === 0) return 0

  return cross > 0 ? 1 : -1
}

const isPointOnSegment = (
  point: MapPoint,
  segmentStart: MapPoint,
  segmentEnd: MapPoint
): boolean =>
  point.x >= Math.min(segmentStart.x, segmentEnd.x) &&
  point.x <= Math.max(segmentStart.x, segmentEnd.x) &&
  point.y >= Math.min(segmentStart.y, segmentEnd.y) &&
  point.y <= Math.max(segmentStart.y, segmentEnd.y)

export const doMapSegmentsIntersect = (
  first: MapSegment,
  second: MapSegment
): boolean => {
  const firstStart = { x: first.x1, y: first.y1 }
  const firstEnd = { x: first.x2, y: first.y2 }
  const secondStart = { x: second.x1, y: second.y1 }
  const secondEnd = { x: second.x2, y: second.y2 }

  const o1 = orientation(firstStart, firstEnd, secondStart)
  const o2 = orientation(firstStart, firstEnd, secondEnd)
  const o3 = orientation(secondStart, secondEnd, firstStart)
  const o4 = orientation(secondStart, secondEnd, firstEnd)

  if (o1 !== o2 && o3 !== o4) return true

  return (
    (o1 === 0 && isPointOnSegment(secondStart, firstStart, firstEnd)) ||
    (o2 === 0 && isPointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (o3 === 0 && isPointOnSegment(firstStart, secondStart, secondEnd)) ||
    (o4 === 0 && isPointOnSegment(firstEnd, secondStart, secondEnd))
  )
}

export const isMapDoorOpen = (
  door: Extract<MapOccluder, { type: 'door' }>,
  doorStates: MapDoorStateLookup = {}
): boolean => {
  const boardState = doorStates[door.id]

  if (typeof boardState === 'boolean') return boardState
  if (boardState !== undefined) return boardState.open

  return door.open
}

export const isBlockingMapOccluder = (
  occluder: MapOccluder,
  doorStates: MapDoorStateLookup = {}
): boolean => occluder.type === 'wall' || !isMapDoorOpen(occluder, doorStates)

export const filterBlockingMapOccluders = (
  occluders: readonly MapOccluder[],
  doorStates: MapDoorStateLookup = {}
): MapOccluder[] =>
  occluders.filter((occluder) => isBlockingMapOccluder(occluder, doorStates))

export const findBlockingMapOccluderForSegment = (
  segment: MapSegment,
  occluders: readonly MapOccluder[],
  doorStates: MapDoorStateLookup = {}
): MapOccluder | null =>
  occluders.find(
    (occluder) =>
      isBlockingMapOccluder(occluder, doorStates) &&
      doMapSegmentsIntersect(segment, occluder)
  ) ?? null

export const hasMapLineOfSight = (
  from: MapPoint,
  to: MapPoint,
  occluders: readonly MapOccluder[],
  doorStates: MapDoorStateLookup = {}
): boolean =>
  findBlockingMapOccluderForSegment(
    { x1: from.x, y1: from.y, x2: to.x, y2: to.y },
    occluders,
    doorStates
  ) === null
