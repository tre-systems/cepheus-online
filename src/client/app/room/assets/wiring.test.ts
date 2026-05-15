import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameCommand } from '../../../../shared/commands'
import { asGameId, asPieceId, asUserId } from '../../../../shared/ids'
import type {
  BoardState,
  GameState,
  PieceState
} from '../../../../shared/state'
import type { BoardCommand } from '../../core/command-router'
import type { RequiredAppElements } from '../../core/elements'
import type { RoomAssetCreationOptions } from './controller'
import { createRoomAssetCreationWiring } from './wiring'

const gameId = asGameId('room-1')
const actorId = asUserId('actor-1')

const fakeElement = <T>(): T => ({}) as T

const createElements = (): RequiredAppElements =>
  ({
    createPiece: fakeElement<HTMLButtonElement>(),
    createBoard: fakeElement<HTMLButtonElement>(),
    pieceNameInput: fakeElement<HTMLInputElement>(),
    pieceImageInput: fakeElement<HTMLInputElement>(),
    pieceImageFileInput: fakeElement<HTMLInputElement>(),
    pieceCropInput: fakeElement<HTMLInputElement>(),
    pieceCropXInput: fakeElement<HTMLInputElement>(),
    pieceCropYInput: fakeElement<HTMLInputElement>(),
    pieceCropWidthInput: fakeElement<HTMLInputElement>(),
    pieceCropHeightInput: fakeElement<HTMLInputElement>(),
    pieceWidthInput: fakeElement<HTMLInputElement>(),
    pieceHeightInput: fakeElement<HTMLInputElement>(),
    pieceScaleInput: fakeElement<HTMLInputElement>(),
    pieceSheetInput: fakeElement<HTMLInputElement>(),
    localAssetMetadataInput: fakeElement<HTMLTextAreaElement>(),
    loadLocalAssets: fakeElement<HTMLButtonElement>(),
    boardAssetSelect: fakeElement<HTMLSelectElement>(),
    useBoardAsset: fakeElement<HTMLButtonElement>(),
    counterAssetSelect: fakeElement<HTMLSelectElement>(),
    useCounterAsset: fakeElement<HTMLButtonElement>(),
    localAssetStatus: fakeElement<HTMLElement>(),
    boardNameInput: fakeElement<HTMLInputElement>(),
    boardImageInput: fakeElement<HTMLInputElement>(),
    boardImageFileInput: fakeElement<HTMLInputElement>(),
    boardWidthInput: fakeElement<HTMLInputElement>(),
    boardHeightInput: fakeElement<HTMLInputElement>(),
    boardScaleInput: fakeElement<HTMLInputElement>(),
    roomDialog: fakeElement<HTMLDialogElement>()
  }) as RequiredAppElements

describe('room asset creation wiring', () => {
  it('maps app elements and delegates dependencies to the controller', async () => {
    const elements = createElements()
    const state = fakeElement<GameState>()
    const board = fakeElement<BoardState>()
    const piece = fakeElement<PieceState>()
    const command = { type: 'CreateBoard' } as BoardCommand
    const commands = [{ type: 'CreatePiece' }] as GameCommand[]
    const postedBoardCommands: BoardCommand[] = []
    const postedCommands: GameCommand[] = []
    const selectedPieces: string[] = []
    const rendered: string[] = []
    const errors: string[] = []
    const capturedOptions: RoomAssetCreationOptions[] = []

    const controller = createRoomAssetCreationWiring({
      elements,
      getState: () => state,
      getSelectedBoard: () => board,
      getSelectedBoardPieces: () => [piece],
      getClientIdentity: () => ({ gameId, actorId }),
      getBootstrapIdentity: () => ({ roomId: gameId, actorId }),
      createRequestId: (scope) => `request:${scope}`,
      postCommand: async (nextCommand) => {
        postedCommands.push(nextCommand)
      },
      postBoardCommand: async (nextCommand) => {
        postedBoardCommands.push(nextCommand)
      },
      dispatchCommandsSequential: async (nextCommands) => {
        postedCommands.push(...nextCommands)
      },
      selectPiece: (pieceId) => {
        selectedPieces.push(pieceId)
      },
      requestRender: () => {
        rendered.push('render')
      },
      reportError: (message) => {
        errors.push(message)
      },
      getCanPickLocalAssets: () => true,
      createController: (options) => {
        capturedOptions.push(options)
        return {
          dispose: () => {
            rendered.push('dispose')
          }
        }
      }
    })

    const options = capturedOptions[0]
    if (!options) throw new Error('Expected controller options')
    assert.equal(options.elements.createPiece, elements.createPiece)
    assert.equal(options.elements.createBoard, elements.createBoard)
    assert.equal(options.elements.pieceNameInput, elements.pieceNameInput)
    assert.equal(
      options.elements.pieceImageFileInput,
      elements.pieceImageFileInput
    )
    assert.equal(
      options.elements.localAssetMetadataInput,
      elements.localAssetMetadataInput
    )
    assert.equal(options.elements.boardAssetSelect, elements.boardAssetSelect)
    assert.equal(
      options.elements.counterAssetSelect,
      elements.counterAssetSelect
    )
    assert.equal(
      options.elements.boardImageFileInput,
      elements.boardImageFileInput
    )
    assert.equal(options.elements.roomDialog, elements.roomDialog)
    assert.equal(options.getState(), state)
    assert.equal(options.getSelectedBoard(), board)
    assert.deepEqual(options.getSelectedBoardPieces(), [piece])
    assert.deepEqual(options.getClientIdentity(), { gameId, actorId })
    assert.deepEqual(options.getCommandIdentity(), { gameId, actorId })
    assert.deepEqual(options.getBootstrapIdentity(), {
      roomId: gameId,
      actorId
    })
    assert.equal(options.getCanPickLocalAssets?.(), true)
    assert.equal(options.createRequestId('board'), 'request:board')

    await options.postBoardCommand(command)
    await options.dispatchCommandsSequential(commands)
    await options.postCommand(command)
    options.selectPiece(asPieceId('piece-1'))
    options.requestRender()
    options.reportError('failed')
    controller.dispose()

    assert.deepEqual(postedBoardCommands, [command])
    assert.deepEqual(postedCommands, [...commands, command])
    assert.deepEqual(selectedPieces, ['piece-1'])
    assert.deepEqual(rendered, ['render', 'dispose'])
    assert.deepEqual(errors, ['failed'])
  })
})
