import {
  type GeomorphTileKind,
  type LocalMapAssetMetadata,
  type LocalMapAssetRoot,
  type MapAssetKind,
  validateLocalMapAssetMetadata
} from '../../../shared/mapAssets'

export interface MapAssetCandidateFilters {
  kind?: MapAssetKind
  root?: LocalMapAssetRoot
  tileKind?: GeomorphTileKind
}

export interface ValidatedMapAssetCandidates {
  assets: LocalMapAssetMetadata[]
  errors: string[]
}

export interface BoardAssetDefaults {
  width: number
  height: number
  scale: number
}

export type MapAssetKindGroups = Record<MapAssetKind, LocalMapAssetMetadata[]>

export type MapAssetRootGroups = Record<
  LocalMapAssetRoot,
  LocalMapAssetMetadata[]
>

export type GeomorphTileKindGroups = Record<
  GeomorphTileKind,
  LocalMapAssetMetadata[]
>

const LABEL_SEPARATOR_PATTERN = /[\s_-]+/g
const UNSAFE_LABEL_CHAR_PATTERN = /[<>&"']/g

const replaceControlCharacters = (value: string): string =>
  [...value]
    .map((char) => {
      const code = char.charCodeAt(0)
      return code <= 31 || code === 127 ? ' ' : char
    })
    .join('')

export const validateMapAssetCandidates = (
  candidates: readonly unknown[]
): ValidatedMapAssetCandidates => {
  const assets: LocalMapAssetMetadata[] = []
  const errors: string[] = []

  for (const [index, candidate] of candidates.entries()) {
    const result = validateLocalMapAssetMetadata(candidate)
    if (result.ok) {
      assets.push(result.value)
      continue
    }

    for (const error of result.error) {
      errors.push(`Asset ${index}: ${error}`)
    }
  }

  return { assets, errors }
}

export const filterMapAssetCandidates = (
  assets: readonly LocalMapAssetMetadata[],
  filters: MapAssetCandidateFilters = {}
): LocalMapAssetMetadata[] =>
  assets.filter((asset) => {
    if (filters.kind && asset.kind !== filters.kind) return false
    if (filters.root && asset.root !== filters.root) return false
    if (filters.tileKind && asset.tileKind !== filters.tileKind) return false

    return true
  })

export const groupMapAssetsByKind = (
  assets: readonly LocalMapAssetMetadata[]
): MapAssetKindGroups => {
  const groups: MapAssetKindGroups = {
    geomorph: [],
    counter: []
  }

  for (const asset of assets) {
    groups[asset.kind].push(asset)
  }

  return groups
}

export const groupMapAssetsByRoot = (
  assets: readonly LocalMapAssetMetadata[]
): MapAssetRootGroups => {
  const groups: MapAssetRootGroups = {
    Geomorphs: [],
    Counters: []
  }

  for (const asset of assets) {
    groups[asset.root].push(asset)
  }

  return groups
}

export const groupGeomorphAssetsByTileKind = (
  assets: readonly LocalMapAssetMetadata[]
): GeomorphTileKindGroups => {
  const groups: GeomorphTileKindGroups = {
    standard: [],
    edge: [],
    corner: [],
    custom: []
  }

  for (const asset of assets) {
    if (asset.tileKind) {
      groups[asset.tileKind].push(asset)
    }
  }

  return groups
}

export const deriveMapAssetLabel = (
  asset: Pick<LocalMapAssetMetadata, 'kind' | 'relativePath'>
): string => {
  const pathParts = asset.relativePath.split(/[\\/]/).filter(Boolean)
  const fileName = pathParts.at(-1) || asset.kind
  const extensionStart = fileName.lastIndexOf('.')
  const baseName =
    extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName
  const label = replaceControlCharacters(baseName)
    .replace(UNSAFE_LABEL_CHAR_PATTERN, ' ')
    .replace(LABEL_SEPARATOR_PATTERN, ' ')
    .trim()

  if (label.length > 0) return label

  return asset.kind === 'geomorph' ? 'Geomorph asset' : 'Counter asset'
}

export const deriveBoardDefaultsFromGeomorph = (
  asset: LocalMapAssetMetadata
): BoardAssetDefaults | null => {
  if (asset.kind !== 'geomorph') return null

  return {
    width: asset.width,
    height: asset.height,
    scale: asset.gridScale
  }
}

export const chooseDefaultBoardDefaults = (
  assets: readonly LocalMapAssetMetadata[],
  preferredTileKind: GeomorphTileKind = 'standard'
): BoardAssetDefaults | null => {
  const geomorphs = filterMapAssetCandidates(assets, { kind: 'geomorph' })
  const asset =
    geomorphs.find((candidate) => candidate.tileKind === preferredTileKind) ||
    geomorphs[0]

  return asset ? deriveBoardDefaultsFromGeomorph(asset) : null
}
