import type { BoardId, PieceId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import {
  type BoardCamera,
  type BoardTransform,
  DEFAULT_BOARD_CAMERA,
  type PieceGeometry,
  type Point,
  clampPiecePosition,
  deriveBoardTransform,
  deriveCameraZoom,
  findHitPiece,
  screenToBoard
} from './board-geometry.js'
import { buildMovePieceCommand, type ClientIdentity } from '../game-commands.js'
import {
  boardImageUrl,
  pieceImageUrl,
  selectedBoard,
  selectedBoardPieces
} from './board-view.js'
import {
  type BrowserImageCacheEntry,
  loadBrowserImage
} from './image-assets.js'
import type { LosOverlaySegmentViewModel } from './door-los-view.js'
import type { BoardCommand } from './app-command-router.js'

const DRAG_START_SLOP_PX = 6

export interface LosOverlayCanvasStyle {
  wallStroke: string
  closedDoorStroke: string
  openDoorStroke: string
  wallLineWidth: number
  doorLineWidth: number
  dashLength: number
  gapLength: number
}

export const DEFAULT_LOS_OVERLAY_CANVAS_STYLE: LosOverlayCanvasStyle = {
  wallStroke: 'rgba(255, 255, 255, 0.72)',
  closedDoorStroke: 'rgba(255, 119, 107, 0.9)',
  openDoorStroke: 'rgba(72, 255, 173, 0.76)',
  wallLineWidth: 3,
  doorLineWidth: 4,
  dashLength: 10,
  gapLength: 7
}

type BoardDrag =
  | {
      kind: 'piece'
      pieceId: PieceId
      offsetX: number
      offsetY: number
      startPointerX: number
      startPointerY: number
      moved: boolean
      x: number
      y: number
      startX: number
      startY: number
    }
  | {
      kind: 'pan'
      pointerX: number
      pointerY: number
      startPointerX: number
      startPointerY: number
      moved: boolean
      panX: number
      panY: number
    }

export type CompletedPieceDrag = Extract<BoardDrag, { kind: 'piece' }>

export interface BoardControllerOptions {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  getState: () => GameState | null
  getIdentity: () => ClientIdentity
  getSelectedPieceId: () => PieceId | null
  setSelectedPieceId: (pieceId: PieceId | null) => void
  sendCommand: (command: BoardCommand) => Promise<unknown>
  setError: (message: string) => void
  requestRender: () => void
  devicePixelRatio?: () => number
}

export interface BoardController {
  clearDrag: () => void
  currentZoom: () => number
  selectedPiece: () => PieceState | null
  render: () => void
  resetCamera: () => void
  setCameraZoom: (nextZoom: number, anchorScreen?: Point | null) => void
}

export const buildCompletedPieceDragMoveCommand = ({
  drag,
  identity,
  state
}: {
  drag: CompletedPieceDrag
  identity: ClientIdentity
  state: GameState | null
}): BoardCommand | null => {
  if (!state || !drag.moved) return null

  const x = Math.round(drag.x)
  const y = Math.round(drag.y)
  if (x === Math.round(drag.startX) && y === Math.round(drag.startY)) {
    return null
  }

  return buildMovePieceCommand({
    identity,
    state,
    pieceId: drag.pieceId,
    x,
    y
  }) as BoardCommand
}

export const drawLosOverlaySegments = (
  ctx: Pick<
    CanvasRenderingContext2D,
    | 'beginPath'
    | 'lineTo'
    | 'moveTo'
    | 'restore'
    | 'save'
    | 'setLineDash'
    | 'stroke'
    | 'strokeStyle'
    | 'lineWidth'
    | 'lineCap'
  >,
  segments: readonly LosOverlaySegmentViewModel[],
  transform: Pick<BoardTransform, 'scale'>,
  style: LosOverlayCanvasStyle = DEFAULT_LOS_OVERLAY_CANVAS_STYLE
) => {
  if (segments.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  for (const segment of segments) {
    ctx.strokeStyle =
      segment.type === 'wall'
        ? style.wallStroke
        : segment.open
          ? style.openDoorStroke
          : style.closedDoorStroke
    ctx.lineWidth =
      (segment.type === 'wall' ? style.wallLineWidth : style.doorLineWidth) /
      transform.scale
    ctx.setLineDash(
      segment.type === 'door' && segment.open
        ? [
            style.dashLength / transform.scale,
            style.gapLength / transform.scale
          ]
        : []
    )
    ctx.beginPath()
    ctx.moveTo(segment.x1, segment.y1)
    ctx.lineTo(segment.x2, segment.y2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()
}

export const createBoardController = ({
  canvas,
  context: ctx,
  getState,
  getIdentity,
  getSelectedPieceId,
  setSelectedPieceId,
  sendCommand,
  setError,
  requestRender,
  devicePixelRatio = () => window.devicePixelRatio || 1
}: BoardControllerOptions): BoardController => {
  let drag: BoardDrag | null = null
  let boardCamera: BoardCamera = { ...DEFAULT_BOARD_CAMERA }
  let cameraBoardId: BoardId | null = null
  const boardImageCache = new Map<string, BrowserImageCacheEntry>()
  const pieceImageCache = new Map<string, BrowserImageCacheEntry>()

  const currentBoard = () => selectedBoard(getState())
  const currentPieces = () => selectedBoardPieces(getState())

  const loadImage = (
    url: string | null,
    cache: Map<string, BrowserImageCacheEntry>
  ) => loadBrowserImage(url, cache, requestRender)

  const loadBoardImage = (board: BoardState) =>
    loadImage(boardImageUrl(board), boardImageCache)

  const loadPieceImage = (piece: PieceState) =>
    loadImage(pieceImageUrl(piece), pieceImageCache)

  const resetCamera = () => {
    boardCamera = { ...DEFAULT_BOARD_CAMERA }
  }

  const ensureBoardCamera = (board: BoardState | null) => {
    if (!board || cameraBoardId === board.id) return
    cameraBoardId = board.id
    resetCamera()
  }

  const canvasCssSize = () => {
    const rect = canvas.getBoundingClientRect()
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height))
    }
  }

  const boardTransform = (
    board: BoardState,
    cssWidth: number,
    cssHeight: number
  ) => deriveBoardTransform(board, boardCamera, cssWidth, cssHeight)

  const screenPoint = (
    event: Pick<PointerEvent | WheelEvent, 'clientX' | 'clientY'>
  ) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const canvasPoint = (event: PointerEvent) => {
    const board = currentBoard()
    if (!board) return { x: 0, y: 0 }
    const size = canvasCssSize()
    return screenToBoard(
      screenPoint(event),
      boardTransform(board, size.width, size.height)
    )
  }

  const clampDraggedPiecePosition = (
    piece: PieceGeometry,
    x: number,
    y: number
  ) => {
    const board = currentBoard()
    if (!board) return { x, y }
    return clampPiecePosition(board, piece, x, y)
  }

  const releaseCanvasPointer = (pointerId: number) => {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId)
    }
  }

  const hitPiece = (
    point: Point,
    transform: BoardTransform | null = null,
    pointerType = 'mouse'
  ) => findHitPiece(point, currentPieces(), transform, pointerType)

  const drawGrid = (board: BoardState) => {
    const grid = Math.max(25, board.scale || 50)
    ctx.strokeStyle = 'rgba(238, 244, 241, 0.08)'
    ctx.lineWidth = 1
    for (let x = 0; x <= board.width; x += grid) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, board.height)
      ctx.stroke()
    }
    for (let y = 0; y <= board.height; y += grid) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(board.width, y)
      ctx.stroke()
    }
  }

  const renderPiece = (piece: PieceState, transform: BoardTransform) => {
    const isSelected = piece.id === getSelectedPieceId()
    const drawX =
      drag && drag.kind === 'piece' && drag.pieceId === piece.id
        ? drag.x
        : piece.x
    const drawY =
      drag && drag.kind === 'piece' && drag.pieceId === piece.id
        ? drag.y
        : piece.y
    const drawW = piece.width * piece.scale
    const drawH = piece.height * piece.scale
    const radius = Math.min(10, drawW / 3, drawH / 3)
    const image = loadPieceImage(piece)
    if (isSelected) {
      ctx.save()
      ctx.shadowColor = 'rgba(72, 255, 173, 0.88)'
      ctx.shadowBlur = 18 / transform.scale
      ctx.strokeStyle = 'rgba(72, 255, 173, 0.95)'
      ctx.lineWidth = 8 / transform.scale
      ctx.beginPath()
      ctx.roundRect(drawX - 4, drawY - 4, drawW + 8, drawH + 8, radius + 4)
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = piece.visibility === 'PREVIEW' ? '#f2b84b' : '#5fd0a2'
    ctx.strokeStyle = isSelected ? '#f7fff9' : '#0b1211'
    ctx.lineWidth = (isSelected ? 3 : 2) / transform.scale
    ctx.beginPath()
    ctx.roundRect(drawX, drawY, drawW, drawH, radius)
    ctx.fill()
    if (image) {
      ctx.save()
      ctx.clip()
      ctx.drawImage(image, drawX, drawY, drawW, drawH)
      ctx.restore()
    }
    ctx.stroke()
    if (isSelected) {
      const corner = Math.min(drawW, drawH, 12)
      ctx.strokeStyle = '#48ffad'
      ctx.lineWidth = 2 / transform.scale
      ctx.beginPath()
      ctx.moveTo(drawX, drawY + corner)
      ctx.lineTo(drawX, drawY)
      ctx.lineTo(drawX + corner, drawY)
      ctx.moveTo(drawX + drawW - corner, drawY)
      ctx.lineTo(drawX + drawW, drawY)
      ctx.lineTo(drawX + drawW, drawY + corner)
      ctx.moveTo(drawX + drawW, drawY + drawH - corner)
      ctx.lineTo(drawX + drawW, drawY + drawH)
      ctx.lineTo(drawX + drawW - corner, drawY + drawH)
      ctx.moveTo(drawX + corner, drawY + drawH)
      ctx.lineTo(drawX, drawY + drawH)
      ctx.lineTo(drawX, drawY + drawH - corner)
      ctx.stroke()
    }
    if (!image) {
      ctx.fillStyle = '#07100d'
      ctx.font = '700 13px system-ui'
      ctx.fillText(piece.name, drawX + 8, drawY + 22)
    }
  }

  const render = () => {
    const board = currentBoard()
    ensureBoardCamera(board)
    const size = canvasCssSize()
    const dpr = devicePixelRatio()
    const cssWidth = size.width
    const cssHeight = size.height
    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr
      canvas.height = cssHeight * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    if (!board) {
      ctx.fillStyle = '#253130'
      ctx.fillRect(0, 0, cssWidth, cssHeight)
      ctx.fillStyle = '#a6b4af'
      ctx.font = '16px system-ui'
      ctx.fillText('Open or bootstrap a room from the menu', 24, 34)
      return
    }

    const transform = boardTransform(board, cssWidth, cssHeight)
    ctx.fillStyle = '#253130'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    ctx.save()
    ctx.translate(transform.x, transform.y)
    ctx.scale(transform.scale, transform.scale)
    ctx.fillStyle = '#06100d'
    ctx.fillRect(0, 0, board.width, board.height)
    const boardImage = loadBoardImage(board)
    if (boardImage) {
      ctx.drawImage(boardImage, 0, 0, board.width, board.height)
    }
    drawGrid(board)
    for (const piece of currentPieces()) {
      renderPiece(piece, transform)
    }
    ctx.restore()
  }

  const setCameraZoom = (
    nextZoom: number,
    anchorScreen: Point | null = null
  ) => {
    const board = currentBoard()
    if (!board) return
    const size = canvasCssSize()
    boardCamera = deriveCameraZoom({
      board,
      camera: boardCamera,
      cssWidth: size.width,
      cssHeight: size.height,
      nextZoom,
      anchorScreen
    })
    requestRender()
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const screen = screenPoint(event)
    const board = currentBoard()
    const size = canvasCssSize()
    const transform = board
      ? boardTransform(board, size.width, size.height)
      : null
    const point =
      board && transform ? screenToBoard(screen, transform) : { x: 0, y: 0 }
    const piece = hitPiece(point, transform, event.pointerType)
    setSelectedPieceId(piece?.id || null)
    if (piece) {
      drag = {
        kind: 'piece',
        pieceId: piece.id,
        offsetX: point.x - piece.x,
        offsetY: point.y - piece.y,
        startPointerX: screen.x,
        startPointerY: screen.y,
        moved: false,
        x: piece.x,
        y: piece.y,
        startX: piece.x,
        startY: piece.y
      }
    } else {
      drag = {
        kind: 'pan',
        pointerX: screen.x,
        pointerY: screen.y,
        startPointerX: screen.x,
        startPointerY: screen.y,
        moved: false,
        panX: boardCamera.panX,
        panY: boardCamera.panY
      }
    }
    canvas.setPointerCapture(event.pointerId)
    requestRender()
  })

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return
    event.preventDefault()
    const screen = screenPoint(event)
    if (!drag.moved) {
      drag.moved =
        Math.hypot(
          screen.x - drag.startPointerX,
          screen.y - drag.startPointerY
        ) >= DRAG_START_SLOP_PX
    }
    if (drag.kind === 'pan') {
      boardCamera.panX = drag.panX + screen.x - drag.pointerX
      boardCamera.panY = drag.panY + screen.y - drag.pointerY
      requestRender()
      return
    }
    const point = canvasPoint(event)
    const next = clampDraggedPiecePosition(
      getState()?.pieces?.[drag.pieceId] || { width: 0, height: 0, scale: 1 },
      point.x - drag.offsetX,
      point.y - drag.offsetY
    )
    drag.x = next.x
    drag.y = next.y
    requestRender()
  })

  canvas.addEventListener('pointerup', (event) => {
    if (!drag) return
    event.preventDefault()
    const completed = drag
    drag = null
    releaseCanvasPointer(event.pointerId)
    if (completed.kind !== 'piece') {
      requestRender()
      return
    }

    const command = buildCompletedPieceDragMoveCommand({
      drag: completed,
      identity: getIdentity(),
      state: getState()
    })
    if (!command) {
      requestRender()
      return
    }

    sendCommand(command)
      .catch((error: Error) => setError(error.message))
      .finally(requestRender)
  })

  canvas.addEventListener('pointercancel', (event) => {
    drag = null
    releaseCanvasPointer(event.pointerId)
    requestRender()
  })

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      setCameraZoom(boardCamera.zoom * zoomFactor, screenPoint(event))
    },
    { passive: false }
  )

  return {
    clearDrag: () => {
      drag = null
    },
    currentZoom: () => boardCamera.zoom,
    selectedPiece: () => {
      const pieces = currentPieces()
      const selectedPieceId = getSelectedPieceId()
      return (
        pieces.find((piece) => piece.id === selectedPieceId) ||
        pieces[0] ||
        null
      )
    },
    render,
    resetCamera,
    setCameraZoom
  }
}
