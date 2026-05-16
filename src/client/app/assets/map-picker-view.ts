import type {
  GeomorphTileKind,
  LocalMapAssetMetadata,
  LocalMapAssetRoot,
  MapLosSidecar,
  MapAssetKind
} from '../../../shared/mapAssets'
import { validateMapLosSidecar } from '../../../shared/mapAssets.js'
import {
  deriveMapAssetLabel,
  validateMapAssetCandidates
} from './map-library.js'

export type MapAssetPickerSectionId =
  | 'geomorph-standard'
  | 'geomorph-edge'
  | 'geomorph-corner'
  | 'geomorph-custom'
  | 'counter'

export interface MapAssetDimensionsViewModel {
  width: number
  height: number
  gridScale: number
  label: string
}

export interface MapAssetLosSidecarSummary {
  wallCount: number
  doorCount: number
  label: string
}

export interface GeomorphBoardCommandDefaults {
  name: string
  imageAssetId: string
  width: number
  height: number
  scale: number
}

export interface CounterPieceCommandDefaults {
  name: string
  imageAssetId: string
  width: number
  height: number
  scale: number
}

export interface MapAssetPickerItemViewModel {
  asset: LocalMapAssetMetadata
  assetRef: string
  root: LocalMapAssetRoot
  relativePath: string
  kind: MapAssetKind
  label: string
  dimensions: MapAssetDimensionsViewModel
  tileKind: GeomorphTileKind | null
  losSidecar: MapLosSidecar | null
  losSummary: MapAssetLosSidecarSummary | null
  boardDefaults: GeomorphBoardCommandDefaults | null
  pieceDefaults: CounterPieceCommandDefaults | null
}

export interface MapAssetPickerSectionViewModel {
  id: MapAssetPickerSectionId
  title: string
  kind: MapAssetKind
  tileKind: GeomorphTileKind | null
  items: MapAssetPickerItemViewModel[]
}

export interface MapAssetPickerEmptyState {
  title: string
  message: string
}

export interface MapAssetValidationSummary {
  hasErrors: boolean
  errorCount: number
  title: string | null
  messages: string[]
}

export interface MapAssetPickerViewModel {
  sections: MapAssetPickerSectionViewModel[]
  emptyState: MapAssetPickerEmptyState | null
  validationSummary: MapAssetValidationSummary
}

const GEOMORPH_SECTION_ORDER = [
  'standard',
  'edge',
  'corner',
  'custom'
] satisfies GeomorphTileKind[]

const SECTION_TITLES: Record<MapAssetPickerSectionId, string> = {
  'geomorph-standard': 'Standard geomorph boards',
  'geomorph-edge': 'Edge geomorph boards',
  'geomorph-corner': 'Corner geomorph boards',
  'geomorph-custom': 'Custom geomorph boards',
  counter: 'Counters'
}

const DEFAULT_VALIDATION_MESSAGE_LIMIT = 3

export const buildLocalMapAssetRef = (
  asset: Pick<LocalMapAssetMetadata, 'root' | 'relativePath'>
): string => `${asset.root}/${asset.relativePath}`

export const deriveMapAssetDimensionsViewModel = (
  asset: Pick<LocalMapAssetMetadata, 'width' | 'height' | 'gridScale'>
): MapAssetDimensionsViewModel => ({
  width: asset.width,
  height: asset.height,
  gridScale: asset.gridScale,
  label: `${asset.width} x ${asset.height} px, ${asset.gridScale} px grid`
})

export const deriveMapAssetLosSidecarSummary = (
  sidecar: MapLosSidecar | null
): MapAssetLosSidecarSummary | null => {
  if (!sidecar) return null
  const wallCount = sidecar.occluders.filter(
    (occluder) => occluder.type === 'wall'
  ).length
  const doorCount = sidecar.occluders.filter(
    (occluder) => occluder.type === 'door'
  ).length

  return {
    wallCount,
    doorCount,
    label: `${wallCount} wall(s), ${doorCount} door(s)`
  }
}

export const deriveGeomorphBoardCommandDefaults = (
  asset: LocalMapAssetMetadata
): GeomorphBoardCommandDefaults | null => {
  if (asset.kind !== 'geomorph') return null

  return {
    name: deriveMapAssetLabel(asset),
    imageAssetId: buildLocalMapAssetRef(asset),
    width: asset.width,
    height: asset.height,
    scale: asset.gridScale
  }
}

export const deriveCounterPieceCommandDefaults = (
  asset: LocalMapAssetMetadata
): CounterPieceCommandDefaults | null => {
  if (asset.kind !== 'counter') return null

  return {
    name: deriveMapAssetLabel(asset),
    imageAssetId: buildLocalMapAssetRef(asset),
    width: asset.width,
    height: asset.height,
    scale: asset.gridScale / Math.max(asset.width, asset.height)
  }
}

const validateMapLosSidecarCandidates = (
  candidates: readonly unknown[]
): {
  sidecars: MapLosSidecar[]
  errors: string[]
} => {
  const sidecars: MapLosSidecar[] = []
  const errors: string[] = []

  for (const [index, candidate] of candidates.entries()) {
    const result = validateMapLosSidecar(candidate)
    if (result.ok) {
      sidecars.push(result.value)
      continue
    }

    for (const error of result.error) {
      errors.push(`LOS sidecar ${index}: ${error}`)
    }
  }

  return { sidecars, errors }
}

export const deriveMapAssetPickerItemViewModel = (
  asset: LocalMapAssetMetadata,
  sidecarByAssetRef: ReadonlyMap<string, MapLosSidecar> = new Map()
): MapAssetPickerItemViewModel => ({
  asset,
  assetRef: buildLocalMapAssetRef(asset),
  root: asset.root,
  relativePath: asset.relativePath,
  kind: asset.kind,
  label: deriveMapAssetLabel(asset),
  dimensions: deriveMapAssetDimensionsViewModel(asset),
  tileKind: asset.tileKind,
  losSidecar: sidecarByAssetRef.get(buildLocalMapAssetRef(asset)) ?? null,
  losSummary: deriveMapAssetLosSidecarSummary(
    sidecarByAssetRef.get(buildLocalMapAssetRef(asset)) ?? null
  ),
  boardDefaults: deriveGeomorphBoardCommandDefaults(asset),
  pieceDefaults: deriveCounterPieceCommandDefaults(asset)
})

const buildSection = (
  id: MapAssetPickerSectionId,
  kind: MapAssetKind,
  tileKind: GeomorphTileKind | null,
  items: MapAssetPickerItemViewModel[]
): MapAssetPickerSectionViewModel | null => {
  if (items.length === 0) return null

  return {
    id,
    title: SECTION_TITLES[id],
    kind,
    tileKind,
    items
  }
}

export const deriveMapAssetPickerSections = (
  assets: readonly LocalMapAssetMetadata[],
  sidecars: readonly MapLosSidecar[] = []
): MapAssetPickerSectionViewModel[] => {
  const sidecarByAssetRef = new Map(
    sidecars.map((sidecar) => [sidecar.assetRef, sidecar])
  )
  const items = assets.map((asset) =>
    deriveMapAssetPickerItemViewModel(asset, sidecarByAssetRef)
  )
  const sections: MapAssetPickerSectionViewModel[] = []

  for (const tileKind of GEOMORPH_SECTION_ORDER) {
    const section = buildSection(
      `geomorph-${tileKind}`,
      'geomorph',
      tileKind,
      items.filter((item) => item.tileKind === tileKind)
    )
    if (section) sections.push(section)
  }

  const counterSection = buildSection(
    'counter',
    'counter',
    null,
    items.filter((item) => item.kind === 'counter')
  )
  if (counterSection) sections.push(counterSection)

  return sections
}

export const deriveMapAssetPickerEmptyState = (
  sections: readonly MapAssetPickerSectionViewModel[]
): MapAssetPickerEmptyState | null => {
  if (sections.some((section) => section.items.length > 0)) return null

  return {
    title: 'No local map assets',
    message: 'Validated Geomorphs or Counters metadata will appear here.'
  }
}

export const deriveMapAssetValidationSummary = (
  errors: readonly string[],
  messageLimit = DEFAULT_VALIDATION_MESSAGE_LIMIT
): MapAssetValidationSummary => {
  const visibleErrors = errors.slice(0, Math.max(0, messageLimit))
  const hiddenCount = errors.length - visibleErrors.length
  const messages =
    hiddenCount > 0
      ? [...visibleErrors, `${hiddenCount} more validation error(s).`]
      : visibleErrors

  return {
    hasErrors: errors.length > 0,
    errorCount: errors.length,
    title:
      errors.length === 0
        ? null
        : `${errors.length} local map asset validation error(s)`,
    messages
  }
}

export const deriveMapAssetPickerViewModel = (
  candidates: readonly unknown[],
  losSidecarCandidates: readonly unknown[] = []
): MapAssetPickerViewModel => {
  const { assets, errors } = validateMapAssetCandidates(candidates)
  const { sidecars, errors: sidecarErrors } =
    validateMapLosSidecarCandidates(losSidecarCandidates)
  const sections = deriveMapAssetPickerSections(assets, sidecars)

  return {
    sections,
    emptyState: deriveMapAssetPickerEmptyState(sections),
    validationSummary: deriveMapAssetValidationSummary([
      ...errors,
      ...sidecarErrors
    ])
  }
}
