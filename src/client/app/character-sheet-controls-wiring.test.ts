import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asPieceId, type PieceId } from '../../shared/ids'
import type { PieceState } from '../../shared/state'
import { createCharacterSheetControlsWiring } from './character-sheet-controls-wiring'

type ClickListener = () => void

class FakeButton {
  readonly dataset: Record<string, string> = {}
  private readonly listeners: Record<string, ClickListener[]> = {}

  addEventListener(type: string, listener: ClickListener) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener()
    }
  }
}

const asButton = (button: FakeButton): HTMLButtonElement =>
  button as unknown as HTMLButtonElement

const piece = (id: string): PieceState => ({ id: asPieceId(id) }) as PieceState

describe('character sheet controls wiring', () => {
  it('opens character creation when no selected piece is available', () => {
    const sheetButton = new FakeButton()
    const events: string[] = []

    createCharacterSheetControlsWiring({
      elements: {
        sheetButton: asButton(sheetButton),
        sheetClose: asButton(new FakeButton()),
        sheetTabs: []
      },
      controller: {
        setOpen: (open) => events.push(`set:${open}`),
        toggleOpen: () => events.push('toggle'),
        selectTab: (tab) => events.push(`tab:${tab}`)
      },
      getCurrentSelectedPieceId: () => null,
      getSelectedPiece: () => null,
      selectPiece: (pieceId) => events.push(`select:${pieceId}`),
      openCharacterCreationPanel: () => events.push('open-creation'),
      requestRender: () => events.push('render')
    })

    sheetButton.click()

    assert.deepEqual(events, ['open-creation'])
  })

  it('selects the current board piece before toggling the sheet', () => {
    const sheetButton = new FakeButton()
    const selectedPiece = piece('piece-1')
    let selectedPieceId: PieceId | null = null
    const events: string[] = []

    createCharacterSheetControlsWiring({
      elements: {
        sheetButton: asButton(sheetButton),
        sheetClose: asButton(new FakeButton()),
        sheetTabs: []
      },
      controller: {
        setOpen: (open) => events.push(`set:${open}`),
        toggleOpen: () => events.push('toggle'),
        selectTab: (tab) => events.push(`tab:${tab}`)
      },
      getCurrentSelectedPieceId: () => selectedPieceId,
      getSelectedPiece: () => selectedPiece,
      selectPiece: (pieceId) => {
        selectedPieceId = pieceId
        events.push(`select:${pieceId}`)
      },
      openCharacterCreationPanel: () => events.push('open-creation'),
      requestRender: () => events.push('render')
    })

    sheetButton.click()

    assert.deepEqual(events, ['select:piece-1', 'toggle', 'render'])
  })

  it('wires close and tab buttons to the sheet controller', () => {
    const sheetButton = new FakeButton()
    const sheetClose = new FakeButton()
    const detailsTab = new FakeButton()
    const notesTab = new FakeButton()
    detailsTab.dataset.sheetTab = 'details'
    notesTab.dataset.sheetTab = 'notes'
    const events: string[] = []

    createCharacterSheetControlsWiring({
      elements: {
        sheetButton: asButton(sheetButton),
        sheetClose: asButton(sheetClose),
        sheetTabs: [
          detailsTab as unknown as HTMLElement,
          notesTab as unknown as HTMLElement
        ]
      },
      controller: {
        setOpen: (open) => events.push(`set:${open}`),
        toggleOpen: () => events.push('toggle'),
        selectTab: (tab) => events.push(`tab:${tab}`)
      },
      getCurrentSelectedPieceId: () => asPieceId('piece-1'),
      getSelectedPiece: () => null,
      selectPiece: (pieceId) => events.push(`select:${pieceId}`),
      openCharacterCreationPanel: () => events.push('open-creation'),
      requestRender: () => events.push('render')
    })

    sheetButton.click()
    sheetClose.click()
    detailsTab.click()
    notesTab.click()

    assert.deepEqual(events, [
      'toggle',
      'render',
      'set:false',
      'tab:details',
      'tab:notes'
    ])
  })
})
