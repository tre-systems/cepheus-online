import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asUserId } from '../../../shared/ids'
import type { GameState } from '../../../shared/state'
import type { BoardCommand } from '../core/command-router'
import type { RequiredAppElements } from '../core/elements'
import type { BoardControlsElements } from './controls'
import { createBoardControlsWiring } from './controls-wiring'

const gameId = asGameId('room-1')
const actorId = asUserId('actor-1')

type Listener = () => void

class FakeButton {
  disabled = false
  textContent: string | null = ''
  readonly listeners: Record<string, Listener> = {}

  addEventListener(type: string, listener: Listener): void {
    this.listeners[type] = listener
  }
}

class FakeSelect {
  disabled = false
  title = ''
  value = ''
  readonly listeners: Record<string, Listener> = {}

  addEventListener(type: string, listener: Listener): void {
    this.listeners[type] = listener
  }

  replaceChildren(): void {
    return
  }
}

const fakeElement = <T>(): T => ({}) as T

const createElements = () => {
  const boardSelect = new FakeSelect()
  const zoomOut = new FakeButton()
  const zoomReset = new FakeButton()
  const zoomIn = new FakeButton()
  const elements = {
    boardStatus: fakeElement<HTMLElement>(),
    boardSelect,
    zoomOut,
    zoomReset,
    zoomIn
  } as unknown as RequiredAppElements

  return { elements, boardSelect, zoomOut, zoomReset, zoomIn }
}

describe('board controls wiring', () => {
  it('maps app elements and delegates control dependencies', async () => {
    const { elements, boardSelect, zoomOut, zoomReset, zoomIn } =
      createElements()
    const state = fakeElement<GameState>()
    const postedBoardCommands: BoardCommand[] = []
    const selectedPieces: (null | string)[] = []
    const clearedDrag: string[] = []
    const cameraZooms: number[] = []
    const cameraResets: string[] = []
    const rendered: string[] = []
    const errors: string[] = []
    const renderCalls: {
      elements: BoardControlsElements
      state: GameState | null
      canSelectBoards: boolean
      currentZoom: number
    }[] = []

    const wiring = createBoardControlsWiring({
      elements,
      getState: () => state,
      canSelectBoards: true,
      getSelectedBoardId: () => asBoardId('board-1'),
      getCurrentZoom: () => 2,
      setCameraZoom: (nextZoom) => {
        cameraZooms.push(nextZoom)
      },
      resetCamera: () => {
        cameraResets.push('reset')
      },
      clearBoardDrag: () => {
        clearedDrag.push('clear')
      },
      selectPiece: (pieceId) => {
        selectedPieces.push(pieceId)
      },
      getCommandIdentity: () => ({ gameId, actorId }),
      postBoardCommand: async (command) => {
        postedBoardCommands.push(command)
      },
      requestRender: () => {
        rendered.push('render')
      },
      reportError: (message) => {
        errors.push(message)
      },
      renderControls: (options) => {
        renderCalls.push(options)
      }
    })

    wiring.render()

    const renderCall = renderCalls[0]
    if (!renderCall) throw new Error('Expected render options')
    assert.equal(renderCall.elements.boardStatus, elements.boardStatus)
    assert.equal(renderCall.elements.boardSelect, elements.boardSelect)
    assert.equal(renderCall.elements.zoomOut, elements.zoomOut)
    assert.equal(renderCall.elements.zoomReset, elements.zoomReset)
    assert.equal(renderCall.elements.zoomIn, elements.zoomIn)
    assert.equal(renderCall.state, state)
    assert.equal(renderCall.canSelectBoards, true)
    assert.equal(renderCall.currentZoom, 2)

    boardSelect.value = 'board-2'
    boardSelect.listeners.change?.()
    await Promise.resolve()

    zoomOut.listeners.click?.()
    zoomReset.listeners.click?.()
    zoomIn.listeners.click?.()

    assert.deepEqual(selectedPieces, [null])
    assert.deepEqual(clearedDrag, ['clear'])
    assert.deepEqual(postedBoardCommands, [
      {
        type: 'SelectBoard',
        gameId,
        actorId,
        boardId: asBoardId('board-2')
      }
    ])
    assert.deepEqual(cameraZooms, [1.6, 2.5])
    assert.deepEqual(cameraResets, ['reset'])
    assert.deepEqual(rendered, ['render'])
    assert.deepEqual(errors, [])
  })

  it('renders and reports the post failure path without changing behavior', async () => {
    const { elements, boardSelect } = createElements()
    const errors: string[] = []
    const rendered: string[] = []

    createBoardControlsWiring({
      elements,
      getState: () => null,
      canSelectBoards: true,
      getSelectedBoardId: () => null,
      getCurrentZoom: () => 1,
      setCameraZoom: () => undefined,
      resetCamera: () => undefined,
      clearBoardDrag: () => undefined,
      selectPiece: () => undefined,
      getCommandIdentity: () => ({ gameId, actorId }),
      postBoardCommand: async () => {
        throw new Error('denied')
      },
      requestRender: () => {
        rendered.push('render')
      },
      reportError: (message) => {
        errors.push(message)
      },
      renderControls: () => undefined
    })

    boardSelect.value = 'board-2'
    boardSelect.listeners.change?.()
    await Promise.resolve()
    await Promise.resolve()

    assert.deepEqual(errors, ['denied'])
    assert.deepEqual(rendered, ['render'])
  })
})
