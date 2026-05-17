import type { PieceId } from '../../../../shared/ids'
import type { PieceState } from '../../../../shared/state'
import { createDisposer, type Disposable } from '../../core/disposable.js'
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
}: CharacterSheetControlsWiringOptions): Disposable => {
  const disposer = createDisposer()
  disposer.listen(elements.sheetButton, 'click', () => {
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

  disposer.listen(elements.sheetClose, 'click', () => {
    controller.setOpen(false)
  })

  for (const tab of elements.sheetTabs) {
    disposer.listen(tab, 'click', () => {
      controller.selectTab(tab.dataset.sheetTab)
    })
  }

  return disposer
}
