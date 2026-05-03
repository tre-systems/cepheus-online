import type { BoardId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import { browserImageUrl } from './image-assets.js'

export const boardList = (
  state: Pick<GameState, 'boards'> | null | undefined
): BoardState[] => Object.values(state?.boards ?? {})

export const selectedBoardId = (
  state: Pick<GameState, 'boards' | 'selectedBoardId'> | null | undefined
): BoardId | null => {
  if (!state) return null
  if (state.selectedBoardId && state.boards[state.selectedBoardId]) {
    return state.selectedBoardId
  }

  return boardList(state)[0]?.id ?? null
}

export const selectedBoard = (
  state: Pick<GameState, 'boards' | 'selectedBoardId'> | null | undefined
): BoardState | null => {
  const boardId = selectedBoardId(state)
  return boardId ? (state?.boards[boardId] ?? null) : null
}

export const boardPieces = (
  state: Pick<GameState, 'pieces'> | null | undefined,
  board: Pick<BoardState, 'id'> | BoardId | null | undefined
): PieceState[] => {
  if (!state || !board) return []

  const boardId = typeof board === 'string' ? board : board.id
  return Object.values(state.pieces)
    .filter((piece) => piece.boardId === boardId)
    .sort((left, right) => left.z - right.z)
}

export const selectedBoardPieces = (
  state:
    | Pick<GameState, 'boards' | 'pieces' | 'selectedBoardId'>
    | null
    | undefined
): PieceState[] => boardPieces(state, selectedBoard(state))

export const pieceImageUrl = (piece: Pick<PieceState, 'imageAssetId'>) =>
  browserImageUrl(piece.imageAssetId)

export const boardImageUrl = (
  board: Pick<BoardState, 'url' | 'imageAssetId'>
) => browserImageUrl(board.url) || browserImageUrl(board.imageAssetId)

export const boardStatusLabel = (
  boards: readonly BoardState[],
  board: BoardState | null
) => {
  if (!board) return 'No board'
  const selectedIndex = boards.findIndex(
    (candidate) => candidate.id === board.id
  )
  return `${board.name} (${selectedIndex + 1}/${boards.length})`
}

export const boardOptionLabel = (
  board: Pick<BoardState, 'name'>,
  index: number
) => `B${index + 1} ${board.name}`

export const boardSelectTitle = (
  board: Pick<BoardState, 'name'> | null,
  canSelectBoards: boolean
) =>
  canSelectBoards ? board?.name || 'Board' : 'Board selection is referee-only'
