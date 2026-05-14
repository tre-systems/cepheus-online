import type { PieceId } from '../../../../shared/ids.js'
import type { PieceState } from '../../../../shared/state.js'
import { pieceImageUrl } from '../../board/view.js'
import { cssUrl } from '../../assets/images.js'

export interface CharacterRailControllerOptions {
  document: Document
  rail: HTMLElement
  getPieces: () => readonly PieceState[]
  getSelectedPieceId: () => PieceId | null
  selectPiece: (pieceId: PieceId) => void
  openCharacterSheet: () => void
  startCharacterCreation: () => Promise<unknown>
  renderSheet: () => void
  requestRender: () => void
  reportError: (message: string) => void
}

export interface CharacterRailController {
  render: () => void
}

export const createCharacterRailController = ({
  document,
  rail,
  getPieces,
  getSelectedPieceId,
  selectPiece,
  openCharacterSheet,
  startCharacterCreation,
  renderSheet,
  requestRender,
  reportError
}: CharacterRailControllerOptions): CharacterRailController => {
  const renderEmptyRail = (): void => {
    const empty = document.createElement('button')
    empty.className = 'rail-piece rail-create-piece'
    empty.type = 'button'
    empty.title = 'Create traveller'
    empty.setAttribute('aria-label', 'Create traveller')
    const score = document.createElement('span')
    score.className = 'rail-score'
    score.textContent = '+'
    const avatar = document.createElement('span')
    avatar.className = 'rail-avatar'
    avatar.textContent = '+'
    empty.append(score, avatar)
    empty.addEventListener('click', () => {
      startCharacterCreation().catch((error) => reportError(error.message))
    })
    rail.replaceChildren(empty)
    renderSheet()
  }

  const renderPieceButton = (piece: PieceState, index: number): HTMLElement => {
    const selectedPieceId = getSelectedPieceId()
    const button = document.createElement('button')
    button.className = `rail-piece${piece.id === selectedPieceId ? ' selected' : ''}`
    button.type = 'button'
    button.title = piece.name
    const score = document.createElement('span')
    score.className = 'rail-score'
    score.textContent = String(Math.max(1, 7 - index))
    const avatar = document.createElement('span')
    avatar.className = 'rail-avatar'
    const imageUrl = pieceImageUrl(piece)
    if (imageUrl) {
      avatar.style.backgroundImage = cssUrl(imageUrl)
      avatar.style.backgroundSize = 'cover'
      avatar.style.backgroundPosition = 'center'
    } else {
      avatar.textContent = (piece.name || '?').slice(0, 1).toUpperCase()
    }
    button.append(score, avatar)
    button.addEventListener('click', () => {
      selectPiece(piece.id)
      openCharacterSheet()
      requestRender()
    })
    return button
  }

  const render = (): void => {
    const pieces = getPieces()
    if (pieces.length === 0) {
      renderEmptyRail()
      return
    }

    rail.replaceChildren(...pieces.map(renderPieceButton))
    renderSheet()
  }

  return { render }
}
