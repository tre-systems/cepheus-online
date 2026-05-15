import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameCommand } from '../../../../shared/commands'
import {
  asBoardId,
  asCharacterId,
  asGameId,
  asUserId
} from '../../../../shared/ids'
import type {
  BoardState,
  CharacterState,
  GameState
} from '../../../../shared/state'
import { createRoomAssetCreationController } from './controller'

class FakeTarget {
  listeners: Record<string, EventListener[]> = {}
  disabled = false

  addEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter(
      (candidate) => candidate !== listener
    )
  }

  dispatch(type: string): void {
    for (const listener of this.listeners[type] ?? []) {
      listener(new Event(type))
    }
  }
}

class FakeInput extends FakeTarget {
  value = ''
  checked = false
  focused = false
  files: FileList | null = null

  focus(): void {
    this.focused = true
  }
}

class FakeSelect extends FakeInput {
  children: unknown[] = []
  ownerDocument = {
    createElement: () => ({
      value: '',
      textContent: ''
    })
  }

  replaceChildren(...children: unknown[]): void {
    this.children = children
  }
}

class FakeStatus {
  textContent = ''
}

class FakeDialog {
  closed = false

  close(): void {
    this.closed = true
  }
}

const gameId = asGameId('room-1')
const actorId = asUserId('player-1')
const boardId = asBoardId('main-board')

const board = (): BoardState => ({
  id: boardId,
  name: 'Main Board',
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {}
})

const character = (id: string, name: string): CharacterState => ({
  id: asCharacterId(id),
  ownerId: actorId,
  type: 'PLAYER',
  name,
  active: true,
  notes: '',
  age: 22,
  characteristics: {
    str: 7,
    dex: 7,
    end: 7,
    int: 7,
    edu: 7,
    soc: 7
  },
  skills: [],
  equipment: [],
  credits: 0,
  creation: null
})

const gameState = (): GameState => ({
  id: gameId,
  slug: 'room-1',
  name: 'Room 1',
  ownerId: actorId,
  players: {},
  characters: {},
  boards: { [boardId]: board() },
  pieces: {},
  diceLog: [],
  selectedBoardId: boardId,
  eventSeq: 1
})

const flushAsyncListeners = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const createHarness = (initialState: GameState | null = gameState()) => {
  let state = initialState
  const errors: string[] = []
  const postedCommands: GameCommand[] = []
  const boardCommands: GameCommand[] = []
  const commandBatches: GameCommand[][] = []
  const selectedPieces: string[] = []
  let renderCount = 0

  const elements = {
    createPiece: new FakeTarget(),
    createBoard: new FakeTarget(),
    pieceNameInput: new FakeInput(),
    pieceImageInput: new FakeInput(),
    pieceImageFileInput: new FakeInput(),
    pieceCropInput: new FakeInput(),
    pieceCropXInput: new FakeInput(),
    pieceCropYInput: new FakeInput(),
    pieceCropWidthInput: new FakeInput(),
    pieceCropHeightInput: new FakeInput(),
    pieceWidthInput: new FakeInput(),
    pieceHeightInput: new FakeInput(),
    pieceScaleInput: new FakeInput(),
    pieceSheetInput: new FakeInput(),
    pieceCharacterSelect: new FakeSelect(),
    localAssetMetadataInput: new FakeInput(),
    loadLocalAssets: new FakeTarget(),
    boardAssetSelect: new FakeSelect(),
    useBoardAsset: new FakeTarget(),
    counterAssetSelect: new FakeSelect(),
    useCounterAsset: new FakeTarget(),
    localAssetStatus: new FakeStatus(),
    boardNameInput: new FakeInput(),
    boardImageInput: new FakeInput(),
    boardImageFileInput: new FakeInput(),
    boardWidthInput: new FakeInput(),
    boardHeightInput: new FakeInput(),
    boardScaleInput: new FakeInput(),
    roomDialog: new FakeDialog()
  }
  elements.pieceWidthInput.value = '50'
  elements.pieceHeightInput.value = '50'
  elements.pieceScaleInput.value = '1'
  elements.pieceCropXInput.value = '0'
  elements.pieceCropYInput.value = '0'
  elements.pieceCropWidthInput.value = '150'
  elements.pieceCropHeightInput.value = '150'
  elements.boardWidthInput.value = '1200'
  elements.boardHeightInput.value = '800'
  elements.boardScaleInput.value = '50'

  const controller = createRoomAssetCreationController({
    elements: elements as unknown as Parameters<
      typeof createRoomAssetCreationController
    >[0]['elements'],
    getState: () => state,
    getSelectedBoard: () => state?.boards[boardId] ?? null,
    getSelectedBoardPieces: () => [],
    getClientIdentity: () => ({ gameId, actorId }),
    getBootstrapIdentity: () => ({ roomId: gameId, actorId }),
    getCommandIdentity: () => ({ gameId, actorId }),
    createRequestId: (scope) => scope,
    postCommand: async (command) => {
      postedCommands.push(command)
      state = {
        ...gameState(),
        boards: {},
        selectedBoardId: null,
        eventSeq: 1
      }
    },
    postBoardCommand: async (command) => {
      boardCommands.push(command)
    },
    dispatchCommandsSequential: async (commands) => {
      commandBatches.push(Array.from(commands))
    },
    selectPiece: (pieceId) => {
      selectedPieces.push(pieceId)
    },
    requestRender: () => {
      renderCount += 1
    },
    reportError: (message) => {
      errors.push(message)
    },
    getCanPickLocalAssets: () => true,
    dependencies: {
      readImageDimensions: async () => ({ width: 200, height: 100 }),
      readImageDataUrl: async (input) =>
        input.files?.[0] ? 'data:image/png;base64,test' : null,
      readCroppedImageDataUrl: async () => 'data:image/png;base64,crop'
    }
  })

  return {
    controller,
    elements,
    errors,
    postedCommands,
    boardCommands,
    commandBatches,
    selectedPieces,
    renderCount: () => renderCount
  }
}

describe('room asset creation controller', () => {
  it('reports missing board state before creating a piece', async () => {
    const harness = createHarness(null)

    harness.elements.createPiece.dispatch('click')
    await flushAsyncListeners()

    assert.deepEqual(harness.errors, [
      'Bootstrap a board before creating a piece'
    ])
    assert.deepEqual(harness.commandBatches, [])
  })

  it('focuses the piece name when a custom piece has no name', async () => {
    const harness = createHarness()

    harness.elements.createPiece.dispatch('click')
    await flushAsyncListeners()

    assert.deepEqual(harness.errors, ['Piece name is required'])
    assert.equal(harness.elements.pieceNameInput.focused, true)
    assert.deepEqual(harness.commandBatches, [])
  })

  it('creates a custom piece, resets the form, closes the dialog, and renders', async () => {
    const harness = createHarness()
    harness.elements.pieceNameInput.value = 'Corsair'
    harness.elements.pieceWidthInput.value = '80'
    harness.elements.pieceHeightInput.value = '40'
    harness.elements.pieceScaleInput.value = '1.5'
    harness.elements.pieceImageInput.value = '/counter.png'

    harness.elements.createPiece.dispatch('click')
    await flushAsyncListeners()

    const batch = harness.commandBatches[0]
    assert.equal(batch?.length, 1)
    const command = batch?.[0]
    assert.equal(command?.type, 'CreatePiece')
    if (command?.type !== 'CreatePiece') {
      throw new Error('Expected a CreatePiece command')
    }
    assert.equal(command.name, 'Corsair')
    assert.deepEqual(harness.selectedPieces, ['corsair-1'])
    assert.equal(harness.elements.pieceNameInput.value, '')
    assert.equal(harness.elements.pieceWidthInput.value, '50')
    assert.equal(harness.elements.pieceHeightInput.value, '50')
    assert.equal(harness.elements.pieceScaleInput.value, '1')
    assert.equal(harness.elements.roomDialog.closed, true)
    assert.equal(harness.renderCount(), 1)
  })

  it('links a new piece to an existing character without creating a blank sheet', async () => {
    const harness = createHarness({
      ...gameState(),
      characters: {
        [asCharacterId('mae-1')]: character('mae-1', 'Mae')
      }
    })

    harness.elements.pieceCharacterSelect.dispatch('focus')
    harness.elements.pieceCharacterSelect.value = 'mae-1'
    harness.elements.pieceCharacterSelect.dispatch('change')
    harness.elements.createPiece.dispatch('click')
    await flushAsyncListeners()

    const batch = harness.commandBatches[0]
    assert.deepEqual(
      batch?.map((command) => command.type),
      ['CreatePiece']
    )
    const command = batch?.[0]
    assert.equal(command?.type, 'CreatePiece')
    if (command?.type !== 'CreatePiece') return
    assert.equal(command.name, 'Mae')
    assert.equal(command.characterId, 'mae-1')
  })

  it('creates a game before creating a board when the room is empty', async () => {
    const harness = createHarness(null)
    harness.elements.boardNameInput.value = 'Derelict'

    harness.elements.createBoard.dispatch('click')
    await flushAsyncListeners()

    assert.equal(harness.postedCommands[0]?.type, 'CreateGame')
    assert.equal(harness.boardCommands[0]?.type, 'CreateBoard')
    const command = harness.boardCommands[0]
    if (command?.type !== 'CreateBoard') {
      throw new Error('Expected a CreateBoard command')
    }
    assert.equal(command.name, 'Derelict')
    assert.equal(harness.elements.roomDialog.closed, true)
    assert.equal(harness.renderCount(), 1)
  })

  it('applies validated local geomorph metadata to board fields', async () => {
    const harness = createHarness()
    harness.elements.localAssetMetadataInput.value = JSON.stringify({
      assets: [
        {
          root: 'Geomorphs',
          relativePath: 'standard/deck-01.jpg',
          kind: 'geomorph',
          width: 1000,
          height: 1000,
          gridScale: 50
        }
      ]
    })

    harness.elements.loadLocalAssets.dispatch('click')
    harness.elements.boardAssetSelect.value = 'Geomorphs/standard/deck-01.jpg'
    harness.elements.useBoardAsset.dispatch('click')

    assert.equal(harness.elements.boardNameInput.value, 'deck 01')
    assert.equal(
      harness.elements.boardImageInput.value,
      'Geomorphs/standard/deck-01.jpg'
    )
    assert.equal(harness.elements.boardWidthInput.value, '1000')
    assert.equal(harness.elements.boardHeightInput.value, '1000')
    assert.equal(harness.elements.boardScaleInput.value, '50')
    assert.equal(
      harness.elements.localAssetStatus.textContent,
      '1 board asset(s), 0 counter asset(s)'
    )
  })

  it('creates local geomorph boards as asset ids, not browser urls', async () => {
    const harness = createHarness()
    harness.elements.localAssetMetadataInput.value = JSON.stringify({
      assets: [
        {
          root: 'Geomorphs',
          relativePath: 'standard/deck-01.jpg',
          kind: 'geomorph',
          width: 1000,
          height: 1000,
          gridScale: 50
        }
      ],
      losSidecars: [
        {
          assetRef: 'Geomorphs/standard/deck-01.jpg',
          width: 1000,
          height: 1000,
          gridScale: 50,
          occluders: [
            {
              type: 'door',
              id: 'iris-1',
              x1: 400,
              y1: 300,
              x2: 480,
              y2: 300,
              open: false
            }
          ]
        }
      ]
    })

    harness.elements.loadLocalAssets.dispatch('click')
    harness.elements.boardAssetSelect.value = 'Geomorphs/standard/deck-01.jpg'
    harness.elements.useBoardAsset.dispatch('click')

    harness.elements.createBoard.dispatch('click')
    await flushAsyncListeners()

    const command = harness.boardCommands[0]
    assert.equal(command?.type, 'CreateBoard')
    if (command?.type !== 'CreateBoard') {
      throw new Error('Expected a CreateBoard command')
    }
    assert.equal(command.imageAssetId, 'Geomorphs/standard/deck-01.jpg')
    assert.equal(command.url, null)
    assert.equal(command.losSidecar?.occluders[0]?.id, 'iris-1')
  })

  it('applies validated local counter metadata to piece fields', () => {
    const harness = createHarness()
    harness.elements.localAssetMetadataInput.value = JSON.stringify([
      {
        root: 'Counters',
        relativePath: 'crew/free-trader.svg',
        kind: 'counter',
        width: 600,
        height: 600,
        gridScale: 50
      }
    ])

    harness.elements.loadLocalAssets.dispatch('click')
    harness.elements.counterAssetSelect.value = 'Counters/crew/free-trader.svg'
    harness.elements.useCounterAsset.dispatch('click')

    assert.equal(harness.elements.pieceNameInput.value, 'free trader')
    assert.equal(
      harness.elements.pieceImageInput.value,
      'Counters/crew/free-trader.svg'
    )
    assert.equal(harness.elements.pieceWidthInput.value, '600')
    assert.equal(harness.elements.pieceHeightInput.value, '600')
    assert.equal(harness.elements.pieceScaleInput.value, String(50 / 600))
  })

  it('reports invalid local asset metadata without changing picker options', () => {
    const harness = createHarness()
    harness.elements.localAssetMetadataInput.value = '"invalid"'

    harness.elements.loadLocalAssets.dispatch('click')

    assert.deepEqual(harness.errors.filter(Boolean), [
      'Local asset metadata must be a JSON object, array, or assets object'
    ])
  })

  it('applies board and piece dimensions from selected images', async () => {
    const harness = createHarness()
    const imageFile = { type: 'image/png' } as File
    harness.elements.boardImageFileInput.files = [
      imageFile
    ] as unknown as FileList
    harness.elements.pieceImageFileInput.files = [
      imageFile
    ] as unknown as FileList

    harness.elements.boardImageFileInput.dispatch('change')
    harness.elements.pieceImageFileInput.dispatch('change')
    await flushAsyncListeners()

    assert.equal(
      harness.elements.boardImageInput.value,
      'data:image/png;base64,test'
    )
    assert.equal(harness.elements.boardWidthInput.value, '200')
    assert.equal(harness.elements.boardHeightInput.value, '100')
    assert.equal(
      harness.elements.pieceImageInput.value,
      'data:image/png;base64,test'
    )
    assert.equal(harness.elements.pieceWidthInput.value, '100')
    assert.equal(harness.elements.pieceHeightInput.value, '50')
  })
})
