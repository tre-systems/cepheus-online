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

const isLocalMapAssetRoot = (value: unknown): value is LocalMapAssetRoot =>
  LOCAL_MAP_ASSET_ROOTS.includes(value as LocalMapAssetRoot)

const isMapAssetKind = (value: unknown): value is MapAssetKind =>
  value === 'geomorph' || value === 'counter'

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const hasUnsafePathSegment = (path: string): boolean =>
  path
    .split(/[\\/]/)
    .some((segment) => segment === '' || segment === '.' || segment === '..')

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
