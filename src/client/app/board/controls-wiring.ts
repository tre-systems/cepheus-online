import { asBoardId } from '../../../shared/ids'
import type { GameState } from '../../../shared/state'
import type { ClientIdentity } from '../../game-commands'
import type { BoardCommand } from '../core/command-router'
import { createDisposer, type Disposable } from '../core/disposable'
import type { RequiredAppElements } from '../core/elements'
import { renderBoardControls, type BoardControlsElements } from './controls'

export interface BoardControlsWiring extends Disposable {
  render: () => void
}

export interface BoardControlsWiringOptions {
  elements: RequiredAppElements
  getState: () => GameState | null
  canSelectBoards: () => boolean
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
  const disposer = createDisposer()
  const boardControlElements = {
    boardStatus: elements.boardStatus,
    boardSelect: elements.boardSelect,
    zoomOut: elements.zoomOut,
    zoomReset: elements.zoomReset,
    zoomIn: elements.zoomIn
  }

  disposer.listen(elements.boardSelect, 'change', () => {
    const boardId = elements.boardSelect.value
    if (!boardId || boardId === getSelectedBoardId() || !canSelectBoards()) {
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

  disposer.listen(elements.zoomOut, 'click', () => {
    setCameraZoom(getCurrentZoom() / 1.25)
  })

  disposer.listen(elements.zoomReset, 'click', () => {
    resetCamera()
    requestRender()
  })

  disposer.listen(elements.zoomIn, 'click', () => {
    setCameraZoom(getCurrentZoom() * 1.25)
  })

  return {
    render: () => {
      renderControls({
        elements: boardControlElements,
        state: getState(),
        canSelectBoards: canSelectBoards(),
        currentZoom: getCurrentZoom()
      })
    },
    dispose: disposer.dispose
  }
}
