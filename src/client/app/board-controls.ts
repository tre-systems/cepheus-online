import type { GameState } from '../../shared/state'
import {
  boardList,
  boardOptionLabel,
  boardSelectTitle,
  boardStatusLabel,
  selectedBoard
} from './board-view.js'

export interface BoardControlsElements {
  boardStatus: Pick<HTMLElement, 'textContent'>
  boardSelect: Pick<
    HTMLSelectElement,
    'disabled' | 'replaceChildren' | 'title' | 'value'
  >
  zoomOut: Pick<HTMLButtonElement, 'disabled'>
  zoomReset: Pick<HTMLButtonElement, 'disabled' | 'textContent'>
  zoomIn: Pick<HTMLButtonElement, 'disabled'>
}

export interface BoardControlsDocument {
  createElement: (tagName: 'option') => HTMLOptionElement
}

export interface BoardControlsViewModel {
  statusLabel: string
  selectedBoardId: string
  boardSelectDisabled: boolean
  boardSelectTitle: string
  zoomDisabled: boolean
  zoomResetLabel: string
  options: readonly {
    value: string
    label: string
  }[]
}

export const deriveBoardControlsViewModel = ({
  state,
  canSelectBoards,
  currentZoom
}: {
  state: GameState | null
  canSelectBoards: boolean
  currentZoom: number
}): BoardControlsViewModel => {
  const boards = boardList(state)
  const board = selectedBoard(state)

  return {
    statusLabel: boardStatusLabel(boards, board),
    selectedBoardId: board?.id || '',
    boardSelectDisabled: boards.length === 0 || !canSelectBoards,
    boardSelectTitle: boardSelectTitle(board, canSelectBoards),
    zoomDisabled: !board,
    zoomResetLabel: `${Math.round(currentZoom * 100)}%`,
    options: boards.map((candidate, index) => ({
      value: candidate.id,
      label: boardOptionLabel(candidate, index)
    }))
  }
}

export const renderBoardControls = ({
  elements,
  state,
  canSelectBoards,
  currentZoom,
  documentLike = document
}: {
  elements: BoardControlsElements
  state: GameState | null
  canSelectBoards: boolean
  currentZoom: number
  documentLike?: BoardControlsDocument
}): void => {
  const viewModel = deriveBoardControlsViewModel({
    state,
    canSelectBoards,
    currentZoom
  })

  elements.boardStatus.textContent = viewModel.statusLabel
  const options = viewModel.options.map((candidate) => {
    const option = documentLike.createElement('option')
    option.value = candidate.value
    option.textContent = candidate.label
    return option
  })
  elements.boardSelect.replaceChildren(...options)
  elements.boardSelect.value = viewModel.selectedBoardId
  elements.boardSelect.disabled = viewModel.boardSelectDisabled
  elements.boardSelect.title = viewModel.boardSelectTitle
  elements.zoomOut.disabled = viewModel.zoomDisabled
  elements.zoomReset.disabled = viewModel.zoomDisabled
  elements.zoomIn.disabled = viewModel.zoomDisabled
  elements.zoomReset.textContent = viewModel.zoomResetLabel
}
