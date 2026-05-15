import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  type AppElements,
  getAppElements,
  requireAppElements
} from './elements'

const elementIds = {
  status: 'connectionStatus',
  roomForm: 'roomForm',
  roomInput: 'roomInput',
  userInput: 'userInput',
  bootstrap: 'bootstrapButton',
  refresh: 'refreshButton',
  createCharacterRail: 'createCharacterRailButton',
  characterCreator: 'characterCreator',
  creatorBody: 'creatorBody',
  creatorActions: 'creatorActions',
  characterCreatorClose: 'characterCreatorCloseButton',
  characterCreatorTitle: 'characterCreatorTitle',
  creatorStartSection: 'creatorStartSection',
  creatorQuickSection: 'creatorQuickSection',
  startCharacterWizard: 'startCharacterWizardButton',
  backCharacterWizard: 'backCharacterWizardButton',
  nextCharacterWizard: 'nextCharacterWizardButton',
  characterCreationWizard: 'characterCreationWizard',
  characterCreationSteps: 'characterCreationSteps',
  characterCreationStatus: 'characterCreationStatus',
  characterCreationFields: 'characterCreationFields',
  createPiece: 'createPieceButton',
  createBoard: 'createBoardButton',
  pieceNameInput: 'pieceNameInput',
  pieceImageInput: 'pieceImageInput',
  pieceImageFileInput: 'pieceImageFileInput',
  pieceCropInput: 'pieceCropInput',
  pieceCropXInput: 'pieceCropXInput',
  pieceCropYInput: 'pieceCropYInput',
  pieceCropWidthInput: 'pieceCropWidthInput',
  pieceCropHeightInput: 'pieceCropHeightInput',
  pieceWidthInput: 'pieceWidthInput',
  pieceHeightInput: 'pieceHeightInput',
  pieceScaleInput: 'pieceScaleInput',
  pieceSheetInput: 'pieceSheetInput',
  pieceCharacterSelect: 'pieceCharacterSelect',
  localAssetMetadataInput: 'localAssetMetadataInput',
  loadLocalAssets: 'loadLocalAssetsButton',
  boardAssetSelect: 'boardAssetSelect',
  useBoardAsset: 'useBoardAssetButton',
  counterAssetSelect: 'counterAssetSelect',
  useCounterAsset: 'useCounterAssetButton',
  localAssetStatus: 'localAssetStatus',
  boardNameInput: 'boardNameInput',
  boardImageInput: 'boardImageInput',
  boardImageFileInput: 'boardImageFileInput',
  boardWidthInput: 'boardWidthInput',
  boardHeightInput: 'boardHeightInput',
  boardScaleInput: 'boardScaleInput',
  roll: 'rollButton',
  diceExpression: 'diceExpression',
  error: 'errorText',
  boardStatus: 'boardStatus',
  boardSelect: 'boardSelect',
  zoomOut: 'zoomOutButton',
  zoomReset: 'zoomResetButton',
  zoomIn: 'zoomInButton',
  canvas: 'boardCanvas',
  diceStage: 'diceStage',
  diceOverlay: 'diceOverlay',
  creationActivityFeed: 'creationActivityFeed',
  creationPresenceDock: 'creationPresenceDock',
  pwaInstallPrompt: 'pwaInstallPrompt',
  pwaInstallButton: 'pwaInstallButton',
  pwaInstallDismissButton: 'pwaInstallDismissButton',
  initiativeRail: 'initiativeRail',
  sheet: 'characterSheet',
  sheetButton: 'sheetButton',
  sheetClose: 'sheetCloseButton',
  sheetName: 'sheetName',
  sheetBody: 'sheetBody',
  menu: 'menuButton',
  roomDialog: 'roomDialog',
  roomCancel: 'roomCancelButton'
} satisfies Record<Exclude<keyof AppElements, 'sheetTabs'>, string>

type FakeElement = HTMLElement & { readonly id: string }

class FakeDocument {
  readonly elements = new Map<string, FakeElement>()
  readonly requestedIds: string[] = []
  readonly requestedSelectors: string[] = []

  constructor(
    ids: readonly string[],
    private readonly sheetTabs: HTMLElement[]
  ) {
    for (const id of ids) {
      this.elements.set(id, { id } as FakeElement)
    }
  }

  getElementById(id: string): HTMLElement | null {
    this.requestedIds.push(id)
    return this.elements.get(id) ?? null
  }

  querySelectorAll<T extends Element>(selectors: string): T[] {
    this.requestedSelectors.push(selectors)
    return this.sheetTabs as unknown as T[]
  }
}

describe('app elements', () => {
  it('binds the app element ids and sheet tab selector', () => {
    const ids = Object.values(elementIds)
    const tabs = [
      { id: 'details' } as FakeElement,
      { id: 'items' } as FakeElement
    ]
    const fakeDocument = new FakeDocument(ids, tabs)

    const elements = getAppElements(fakeDocument)

    for (const [key, id] of Object.entries(elementIds)) {
      const elementKey = key as Exclude<keyof AppElements, 'sheetTabs'>
      assert.equal(elements[elementKey], fakeDocument.elements.get(id))
    }
    assert.deepEqual(elements.sheetTabs, tabs)
    assert.deepEqual(fakeDocument.requestedIds, ids)
    assert.deepEqual(fakeDocument.requestedSelectors, ['[data-sheet-tab]'])
  })

  it('preserves nullable element lookup behavior for missing ids', () => {
    const fakeDocument = new FakeDocument([], [])

    const elements = getAppElements(fakeDocument)

    assert.equal(elements.status, null)
    assert.equal(elements.roomDialog, null)
    assert.deepEqual(elements.sheetTabs, [])
  })

  it('requires all runtime shell elements except retired quick creation', () => {
    const ids = Object.values(elementIds).filter(
      (id) => id !== elementIds.creatorQuickSection
    )
    const fakeDocument = new FakeDocument(ids, [])

    const elements = requireAppElements(getAppElements(fakeDocument))

    assert.equal(elements.status, fakeDocument.elements.get(elementIds.status))
    assert.equal(elements.creatorQuickSection, null)
  })

  it('reports the missing required shell element key', () => {
    const ids = Object.values(elementIds).filter(
      (id) => id !== elementIds.status
    )
    const fakeDocument = new FakeDocument(ids, [])

    let message = ''
    try {
      requireAppElements(getAppElements(fakeDocument))
    } catch (error) {
      message = String(error)
    }
    assert.equal(message.includes('Missing required app element: status'), true)
  })
})
