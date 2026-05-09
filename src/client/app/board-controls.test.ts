import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asUserId } from '../../shared/ids'
import type { BoardState, GameState } from '../../shared/state'
import {
  deriveBoardControlsViewModel,
  renderBoardControls
} from './board-controls'

const board = (id: string, name = id): BoardState => ({
  id: asBoardId(id),
  name,
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {}
})

const gameState = (boards: readonly BoardState[]): GameState => ({
  id: asGameId('demo-room'),
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: asUserId('owner'),
  players: {},
  characters: {},
  boards: Object.fromEntries(
    boards.map((candidate) => [candidate.id, candidate])
  ),
  pieces: {},
  diceLog: [],
  selectedBoardId: boards[0]?.id ?? null,
  eventSeq: 12
})

class FakeOption {
  value = ''
  textContent: string | null = null
}

class FakeSelect {
  disabled = false
  title = ''
  value = ''
  children: FakeOption[] = []

  replaceChildren(...children: FakeOption[]): void {
    this.children = children
  }
}

const fakeDocument = {
  createElement: (tagName: 'option') => {
    assert.equal(tagName, 'option')
    return new FakeOption() as HTMLOptionElement
  }
}

describe('board controls', () => {
  it('derives an empty-board view model', () => {
    assert.deepEqual(
      deriveBoardControlsViewModel({
        state: null,
        canSelectBoards: true,
        currentZoom: 1
      }),
      {
        statusLabel: 'No board',
        selectedBoardId: '',
        boardSelectDisabled: true,
        boardSelectTitle: 'Board',
        zoomDisabled: true,
        zoomResetLabel: '100%',
        options: []
      }
    )
  })

  it('derives referee board options and zoom labels', () => {
    const scoutDeck = board('scout-deck', 'Scout Deck')
    const starport = board('starport', 'Starport')

    assert.deepEqual(
      deriveBoardControlsViewModel({
        state: gameState([scoutDeck, starport]),
        canSelectBoards: true,
        currentZoom: 1.25
      }),
      {
        statusLabel: 'Scout Deck (1/2)',
        selectedBoardId: 'scout-deck',
        boardSelectDisabled: false,
        boardSelectTitle: 'Scout Deck',
        zoomDisabled: false,
        zoomResetLabel: '125%',
        options: [
          { value: 'scout-deck', label: 'B1 Scout Deck' },
          { value: 'starport', label: 'B2 Starport' }
        ]
      }
    )
  })

  it('renders board control state without owning browser globals', () => {
    const boardSelect = new FakeSelect()
    const boardStatus = { textContent: '' }
    const zoomOut = { disabled: false }
    const zoomReset = { disabled: false, textContent: '' }
    const zoomIn = { disabled: false }

    renderBoardControls({
      elements: {
        boardStatus: boardStatus as HTMLElement,
        boardSelect: boardSelect as unknown as HTMLSelectElement,
        zoomOut: zoomOut as HTMLButtonElement,
        zoomReset: zoomReset as HTMLButtonElement,
        zoomIn: zoomIn as HTMLButtonElement
      },
      state: gameState([board('scout-deck', 'Scout Deck')]),
      canSelectBoards: false,
      currentZoom: 0.8,
      documentLike: fakeDocument
    })

    assert.equal(boardStatus.textContent, 'Scout Deck (1/1)')
    assert.equal(boardSelect.value, 'scout-deck')
    assert.equal(boardSelect.disabled, true)
    assert.equal(boardSelect.title, 'Board selection is referee-only')
    assert.deepEqual(
      boardSelect.children.map((option) => ({
        value: option.value,
        label: option.textContent
      })),
      [{ value: 'scout-deck', label: 'B1 Scout Deck' }]
    )
    assert.equal(zoomOut.disabled, false)
    assert.equal(zoomReset.disabled, false)
    assert.equal(zoomIn.disabled, false)
    assert.equal(zoomReset.textContent, '80%')
  })
})
