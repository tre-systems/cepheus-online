import type { PieceId } from '../../../../shared/ids'
import type { PieceState } from '../../../../shared/state'
import type { RequiredAppElements } from '../../core/elements.js'
import type { CharacterSheetController } from './controller.js'

export interface CharacterSheetControlsWiringOptions {
  elements: Pick<
    RequiredAppElements,
    'sheetButton' | 'sheetClose' | 'sheetTabs'
  >
  controller: Pick<
    CharacterSheetController,
    'setOpen' | 'toggleOpen' | 'selectTab'
  >
  getCurrentSelectedPieceId: () => PieceId | null
  getSelectedPiece: () => PieceState | null
  selectPiece: (pieceId: PieceId) => void
  openCharacterCreationPanel: () => void
  requestRender: () => void
}

export const createCharacterSheetControlsWiring = ({
  elements,
  controller,
  getCurrentSelectedPieceId,
  getSelectedPiece,
  selectPiece,
  openCharacterCreationPanel,
  requestRender
}: CharacterSheetControlsWiringOptions): void => {
  elements.sheetButton.addEventListener('click', () => {
    const piece = getSelectedPiece()
    if (!getCurrentSelectedPieceId() && piece) {
      selectPiece(piece.id)
    }
    if (!getCurrentSelectedPieceId()) {
      openCharacterCreationPanel()
      return
    }
    controller.toggleOpen()
    requestRender()
  })

  elements.sheetClose.addEventListener('click', () => {
    controller.setOpen(false)
  })

  for (const tab of elements.sheetTabs) {
    tab.addEventListener('click', () => {
      controller.selectTab(tab.dataset.sheetTab)
    })
  }
}
