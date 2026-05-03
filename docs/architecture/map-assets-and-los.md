# Map Assets And Line Of Sight

Cepheus Online should support image-backed tactical boards built from local or
uploaded map assets. Published map products must not be committed to this
repository.

## Local Asset Policy

- `Geomorphs/` is a local-only source folder and is ignored by git.
- `Counters/` is a local-only source folder and is ignored by git.
- Published product images and PDFs stay out of source control.
- Runtime board images should be user-provided assets. Local development may
  bridge browser-selected files into the event stream as `data:` URLs, but
  production should upload the images to R2 and reference them by asset id.
- Runtime piece counters use the same policy. The event stream stores only an
  image asset reference, not bundled product art.
- Derived per-game map metadata should be stored as game data, not as bundled
  repository fixtures.

## Observed Geomorph Shape

The local geomorph set is regular enough to drive a first importer:

- 120 standard tiles at `1000x1000`.
- 160 edge tiles at `1000x530`.
- 120 corner tiles at `530x530`.
- Images are JPEGs at 200 DPI.
- The visual language is consistent: light grid, heavy black walls, white
  openings, door glyphs, labels, furniture, and grey filled areas.

The board importer should treat these as calibrated image tiles rather than as
arbitrary art. The tile dimensions and grid pitch can be inferred, then offered
for referee confirmation.

## Board Composition

The first map-building flow should be:

1. Referee selects or drops local geomorph images.
2. The browser decodes them with Canvas APIs and creates local previews.
3. Referee arranges tiles on a board grid.
4. The app stores board composition as asset references plus transforms.
5. Local development may encode selected files as `data:` URLs for immediate
   board/piece creation.
6. Production uploads the selected images to R2 and stores asset ids instead of
   embedding image bytes in events.

The app must never depend on checked-in copies of the published assets.

## Piece Counters

Pieces can carry an optional `imageAssetId`. The current browser renderer treats
URL-like references and `data:image/` references as image sources for Canvas
pieces and rail avatars. This is enough for local file-input previews and future
R2 URLs while keeping the published counter source folder outside git.

## Occlusion Model

Line of sight should use a vector sidecar over the raster map:

```ts
type Occluder =
  | {type: 'wall'; id: string; x1: number; y1: number; x2: number; y2: number}
  | {
      type: 'door'
      id: string
      x1: number
      y1: number
      x2: number
      y2: number
      open: boolean
    }
```

Closed doors block line of sight. Open doors do not. Door state changes are game
events so every client sees the same map state.

## Extraction Pipeline

Use browser Canvas APIs first; avoid adding image-processing runtime
dependencies.

1. Decode image to `ImageData`.
2. Estimate grid pitch from the regular grey grid.
3. Build a dark-pixel mask for heavy black strokes.
4. Prefer long, grid-aligned dark runs as wall candidates.
5. Ignore small isolated dark clusters where possible; these are often labels,
   furniture, fixtures, or icons.
6. Detect door candidates as short white gaps or standardized door glyphs on a
   wall line.
7. Snap candidates to board/grid coordinates.
8. Show the extracted wall/door overlay to the referee for correction.
9. Persist the reviewed vector sidecar with the board composition.

The review step is required. These maps are standardized, but automatic
thresholding can still confuse labels, consoles, furniture, and decorative line
work for blockers.

## Runtime LOS

The client can compute vision from the reviewed occluder sidecar:

- broad phase: use a spatial grid over occluder segments
- narrow phase: ray/segment intersection for visibility checks
- reveal polygon: cast toward segment endpoints with small angular offsets
- per-piece visibility: use the piece center and configured sight radius

The server remains authoritative for door open/closed state and piece position.
The client can render visibility cheaply from the latest projected state.
