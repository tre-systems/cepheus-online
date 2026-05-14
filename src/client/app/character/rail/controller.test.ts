import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asPieceId, type PieceId } from '../../../../shared/ids'
import type { PieceState } from '../../../../shared/state'
import { createCharacterRailController } from './controller'

type ClickListener = () => void

class FakeElement {
  className = ''
  textContent = ''
  type = ''
  title = ''
  readonly style: Record<string, string> = {}
  readonly attributes: Record<string, string> = {}
  readonly listeners: Record<string, ClickListener[]> = {}
  children: FakeElement[] = []

  constructor(readonly tagName: string) {}

  append(...children: FakeElement[]) {
    this.children.push(...children)
  }

  replaceChildren(...children: FakeElement[]) {
    this.children = children
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value
  }

  addEventListener(type: string, listener: ClickListener) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener()
    }
  }
}

class FakeDocument {
  createElement(tagName: string) {
    return new FakeElement(tagName)
  }
}

const asDocument = (document: FakeDocument): Document =>
  document as unknown as Document

const asElement = (element: FakeElement): HTMLElement =>
  element as unknown as HTMLElement

const firstChild = (element: FakeElement): FakeElement => {
  const child = element.children[0]
  if (!child) throw new Error('Expected element to have a child')
  return child
}

const piece = ({
  id,
  name,
  imageAssetId = null
}: {
  id: string
  name: string
  imageAssetId?: string | null
}): PieceState =>
  ({
    id: asPieceId(id),
    boardId: asBoardId('board-1'),
    characterId: null,
    imageAssetId,
    name,
    x: 0,
    y: 0,
    z: 0,
    width: 1,
    height: 1,
    scale: 1,
    visibility: 'VISIBLE',
    freedom: 'LOCKED'
  }) satisfies PieceState

describe('character rail controller', () => {
  it('renders an empty rail action that starts character creation', () => {
    const rail = new FakeElement('div')
    const events: string[] = []

    const controller = createCharacterRailController({
      document: asDocument(new FakeDocument()),
      rail: asElement(rail),
      getPieces: () => [],
      getSelectedPieceId: () => null,
      selectPiece: (pieceId) => events.push(`select:${pieceId}`),
      openCharacterSheet: () => events.push('open-sheet'),
      startCharacterCreation: async () => {
        events.push('start-creation')
      },
      renderSheet: () => events.push('render-sheet'),
      requestRender: () => events.push('render'),
      reportError: (message) => events.push(`error:${message}`)
    })

    controller.render()
    const button = firstChild(rail)
    button.click()

    assert.equal(button.className, 'rail-piece rail-create-piece')
    assert.equal(button.attributes['aria-label'], 'Create traveller')
    assert.deepEqual(events, ['render-sheet', 'start-creation'])
  })

  it('reports character creation start failures', async () => {
    const rail = new FakeElement('div')
    const events: string[] = []
    const controller = createCharacterRailController({
      document: asDocument(new FakeDocument()),
      rail: asElement(rail),
      getPieces: () => [],
      getSelectedPieceId: () => null,
      selectPiece: (pieceId) => events.push(`select:${pieceId}`),
      openCharacterSheet: () => events.push('open-sheet'),
      startCharacterCreation: async () => {
        throw new Error('Creation failed')
      },
      renderSheet: () => events.push('render-sheet'),
      requestRender: () => events.push('render'),
      reportError: (message) => events.push(`error:${message}`)
    })

    controller.render()
    firstChild(rail).click()
    await Promise.resolve()

    assert.deepEqual(events, ['render-sheet', 'error:Creation failed'])
  })

  it('renders pieces and opens the selected piece sheet', () => {
    const rail = new FakeElement('div')
    const events: string[] = []
    let selectedPieceId: PieceId | null = asPieceId('piece-2')
    const controller = createCharacterRailController({
      document: asDocument(new FakeDocument()),
      rail: asElement(rail),
      getPieces: () => [
        piece({ id: 'piece-1', name: 'Scout' }),
        piece({ id: 'piece-2', name: 'Merchant' })
      ],
      getSelectedPieceId: () => selectedPieceId,
      selectPiece: (pieceId) => {
        selectedPieceId = pieceId
        events.push(`select:${pieceId}`)
      },
      openCharacterSheet: () => events.push('open-sheet'),
      startCharacterCreation: async () => events.push('start-creation'),
      renderSheet: () => events.push('render-sheet'),
      requestRender: () => events.push('render'),
      reportError: (message) => events.push(`error:${message}`)
    })

    controller.render()
    assert.equal(rail.children.length, 2)
    assert.equal(rail.children[0]?.className, 'rail-piece')
    assert.equal(rail.children[1]?.className, 'rail-piece selected')
    assert.equal(rail.children[0]?.children[0]?.textContent, '7')
    assert.equal(rail.children[0]?.children[1]?.textContent, 'S')

    rail.children[0]?.click()

    assert.equal(selectedPieceId, asPieceId('piece-1'))
    assert.deepEqual(events, [
      'render-sheet',
      'select:piece-1',
      'open-sheet',
      'render'
    ])
  })

  it('uses browser-safe piece image URLs for avatars', () => {
    const rail = new FakeElement('div')
    const controller = createCharacterRailController({
      document: asDocument(new FakeDocument()),
      rail: asElement(rail),
      getPieces: () => [
        piece({
          id: 'piece-1',
          name: 'Scout',
          imageAssetId: '/assets/scout.png'
        })
      ],
      getSelectedPieceId: () => null,
      selectPiece: () => {},
      openCharacterSheet: () => {},
      startCharacterCreation: async () => {},
      renderSheet: () => {},
      requestRender: () => {},
      reportError: () => {}
    })

    controller.render()
    const avatar = rail.children[0]?.children[1]

    assert.equal(avatar?.textContent, '')
    assert.equal(avatar?.style.backgroundImage, 'url("/assets/scout.png")')
    assert.equal(avatar?.style.backgroundSize, 'cover')
    assert.equal(avatar?.style.backgroundPosition, 'center')
  })
})
