import { asBoardId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'
import type { BoardCommand } from './app-command-router.js'
import type { RequiredAppElements } from './app-elements.js'
import {
  renderBoardControls,
  type BoardControlsElements
} from './board-controls.js'

export interface BoardControlsWiring {
  render: () => void
}

export interface BoardControlsWiringOptions {
  elements: RequiredAppElements
  getState: () => GameState | null
  canSelectBoards: boolean
  getSelectedBoardId: () => string | null
  getCurrentZoom: () => number
  setCameraZoom: (nextZoom: number) => void
  resetCamera: () => void
  clearBoardDrag: () => void
  selectPiece: (pieceId: null) => void
  getCommandIdentity: () => ClientIdentity
  postBoardCommand: (command: BoardCommand) => Promise<unknown>
  requestRender: () => void
  reportError: (message: string) => void
  renderControls?: (options: {
    elements: BoardControlsElements
    state: GameState | null
    canSelectBoards: boolean
    currentZoom: number
  }) => void
}

export const createBoardControlsWiring = ({
  elements,
  getState,
  canSelectBoards,
  getSelectedBoardId,
  getCurrentZoom,
  setCameraZoom,
  resetCamera,
  clearBoardDrag,
  selectPiece,
  getCommandIdentity,
  postBoardCommand,
  requestRender,
  reportError,
  renderControls = renderBoardControls
}: BoardControlsWiringOptions): BoardControlsWiring => {
  const boardControlElements = {
    boardStatus: elements.boardStatus,
    boardSelect: elements.boardSelect,
    zoomOut: elements.zoomOut,
    zoomReset: elements.zoomReset,
    zoomIn: elements.zoomIn
  }

  elements.boardSelect.addEventListener('change', () => {
    const boardId = elements.boardSelect.value
    if (!boardId || boardId === getSelectedBoardId() || !canSelectBoards) {
      return
    }
    selectPiece(null)
    clearBoardDrag()
    postBoardCommand({
      type: 'SelectBoard',
      ...getCommandIdentity(),
      boardId: asBoardId(boardId)
    }).catch((error) => {
      reportError(error.message)
      requestRender()
    })
  })

  elements.zoomOut.addEventListener('click', () => {
    setCameraZoom(getCurrentZoom() / 1.25)
  })

  elements.zoomReset.addEventListener('click', () => {
    resetCamera()
    requestRender()
  })

  elements.zoomIn.addEventListener('click', () => {
    setCameraZoom(getCurrentZoom() * 1.25)
  })

  return {
    render: () => {
      renderControls({
        elements: boardControlElements,
        state: getState(),
        canSelectBoards,
        currentZoom: getCurrentZoom()
      })
    }
  }
}
