export interface BoardGeometry {
  width: number
  height: number
}

export interface PieceGeometry {
  width: number
  height: number
  scale: number
}

export interface PositionedPieceGeometry extends PieceGeometry {
  x: number
  y: number
  z: number
}

export interface Point {
  x: number
  y: number
}

export interface BoardCamera {
  zoom: number
  panX: number
  panY: number
}

export interface BoardTransform {
  scale: number
  x: number
  y: number
}

export const DEFAULT_BOARD_CAMERA: BoardCamera = { zoom: 1, panX: 0, panY: 0 }
export const DEFAULT_TOUCH_HIT_TARGET_PX = 44
export const MIN_BOARD_ZOOM = 0.5
export const MAX_BOARD_ZOOM = 5

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const deriveBoardTransform = (
  board: BoardGeometry,
  camera: BoardCamera,
  cssWidth: number,
  cssHeight: number
): BoardTransform => {
  const baseScale = Math.min(cssWidth / board.width, cssHeight / board.height)
  const scale = baseScale * camera.zoom
  return {
    scale,
    x: (cssWidth - board.width * scale) / 2 + camera.panX,
    y: (cssHeight - board.height * scale) / 2 + camera.panY
  }
}

export const screenToBoard = (
  screen: Point,
  transform: BoardTransform
): Point => ({
  x: (screen.x - transform.x) / transform.scale,
  y: (screen.y - transform.y) / transform.scale
})

export const clampPiecePosition = (
  board: BoardGeometry,
  piece: PieceGeometry,
  x: number,
  y: number
): Point => ({
  x: clamp(x, 0, Math.max(0, board.width - piece.width * piece.scale)),
  y: clamp(y, 0, Math.max(0, board.height - piece.height * piece.scale))
})

export const deriveCameraZoom = ({
  board,
  camera,
  cssWidth,
  cssHeight,
  nextZoom,
  anchorScreen,
  minZoom = MIN_BOARD_ZOOM,
  maxZoom = MAX_BOARD_ZOOM
}: {
  board: BoardGeometry
  camera: BoardCamera
  cssWidth: number
  cssHeight: number
  nextZoom: number
  anchorScreen?: Point | null
  minZoom?: number
  maxZoom?: number
}): BoardCamera => {
  const beforeTransform = deriveBoardTransform(
    board,
    camera,
    cssWidth,
    cssHeight
  )
  const anchor = anchorScreen || { x: cssWidth / 2, y: cssHeight / 2 }
  const boardAnchor = screenToBoard(anchor, beforeTransform)
  const zoom = clamp(nextZoom, minZoom, maxZoom)
  const zoomedCamera = { ...camera, zoom }
  const afterTransform = deriveBoardTransform(
    board,
    zoomedCamera,
    cssWidth,
    cssHeight
  )

  return {
    zoom,
    panX:
      camera.panX +
      anchor.x -
      (afterTransform.x + boardAnchor.x * afterTransform.scale),
    panY:
      camera.panY +
      anchor.y -
      (afterTransform.y + boardAnchor.y * afterTransform.scale)
  }
}

export const derivePieceTouchPadding = (
  piece: PieceGeometry,
  transform: BoardTransform | null,
  pointerType: string,
  touchHitTargetPx = DEFAULT_TOUCH_HIT_TARGET_PX
): Point => {
  if (pointerType === 'mouse' || !transform) return { x: 0, y: 0 }
  const drawW = piece.width * piece.scale
  const drawH = piece.height * piece.scale
  const targetBoardSize = touchHitTargetPx / transform.scale
  return {
    x: Math.max(0, (targetBoardSize - drawW) / 2),
    y: Math.max(0, (targetBoardSize - drawH) / 2)
  }
}

export const findHitPiece = <T extends PositionedPieceGeometry>(
  point: Point,
  pieces: readonly T[],
  transform: BoardTransform | null = null,
  pointerType = 'mouse',
  touchHitTargetPx = DEFAULT_TOUCH_HIT_TARGET_PX
): T | null =>
  [...pieces]
    .sort((a, b) => b.z - a.z)
    .find((piece) => {
      const padding = derivePieceTouchPadding(
        piece,
        transform,
        pointerType,
        touchHitTargetPx
      )
      return (
        point.x >= piece.x - padding.x &&
        point.x <= piece.x + piece.width * piece.scale + padding.x &&
        point.y >= piece.y - padding.y &&
        point.y <= piece.y + piece.height * piece.scale + padding.y
      )
    }) || null
