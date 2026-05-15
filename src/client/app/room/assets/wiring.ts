import type { GameCommand } from '../../../../shared/commands'
import type { PieceId } from '../../../../shared/ids'
import type {
  BoardState,
  GameState,
  PieceState
} from '../../../../shared/state'
import type { ClientIdentity } from '../../../game-commands.js'
import type { BoardCommand } from '../../core/command-router.js'
import type { RequiredAppElements } from '../../core/elements.js'
import type { BootstrapCommandContext } from '../bootstrap-flow.js'
import {
  createRoomAssetCreationController,
  type RoomAssetCreationController,
  type RoomAssetCreationOptions
} from './controller.js'

export interface RoomAssetCreationWiringOptions {
  elements: RequiredAppElements
  getState: () => GameState | null
  getSelectedBoard: () => BoardState | null
  getSelectedBoardPieces: () => readonly PieceState[]
  getClientIdentity: () => ClientIdentity
  getBootstrapIdentity: () => BootstrapCommandContext
  createRequestId: (scope: string) => string
  postCommand: (command: GameCommand, requestId?: string) => Promise<unknown>
  postBoardCommand: (command: BoardCommand) => Promise<unknown>
  dispatchCommandsSequential: (
    commands: readonly GameCommand[]
  ) => Promise<unknown>
  selectPiece: (pieceId: PieceId) => void
  requestRender: () => void
  reportError: (message: string) => void
  getCanPickLocalAssets?: () => boolean
  createController?: (
    options: RoomAssetCreationOptions
  ) => RoomAssetCreationController
}

export const createRoomAssetCreationWiring = ({
  elements,
  getState,
  getSelectedBoard,
  getSelectedBoardPieces,
  getClientIdentity,
  getBootstrapIdentity,
  createRequestId,
  postCommand,
  postBoardCommand,
  dispatchCommandsSequential,
  selectPiece,
  requestRender,
  reportError,
  getCanPickLocalAssets,
  createController = createRoomAssetCreationController
}: RoomAssetCreationWiringOptions): RoomAssetCreationController => {
  return createController({
    elements: {
      createPiece: elements.createPiece,
      createBoard: elements.createBoard,
      pieceNameInput: elements.pieceNameInput,
      pieceImageInput: elements.pieceImageInput,
      pieceImageFileInput: elements.pieceImageFileInput,
      pieceCropInput: elements.pieceCropInput,
      pieceCropXInput: elements.pieceCropXInput,
      pieceCropYInput: elements.pieceCropYInput,
      pieceCropWidthInput: elements.pieceCropWidthInput,
      pieceCropHeightInput: elements.pieceCropHeightInput,
      pieceWidthInput: elements.pieceWidthInput,
      pieceHeightInput: elements.pieceHeightInput,
      pieceScaleInput: elements.pieceScaleInput,
      pieceSheetInput: elements.pieceSheetInput,
      pieceCharacterSelect: elements.pieceCharacterSelect,
      localAssetMetadataInput: elements.localAssetMetadataInput,
      loadLocalAssets: elements.loadLocalAssets,
      boardAssetSelect: elements.boardAssetSelect,
      useBoardAsset: elements.useBoardAsset,
      counterAssetSelect: elements.counterAssetSelect,
      useCounterAsset: elements.useCounterAsset,
      localAssetStatus: elements.localAssetStatus,
      boardNameInput: elements.boardNameInput,
      boardImageInput: elements.boardImageInput,
      boardImageFileInput: elements.boardImageFileInput,
      boardWidthInput: elements.boardWidthInput,
      boardHeightInput: elements.boardHeightInput,
      boardScaleInput: elements.boardScaleInput,
      roomDialog: elements.roomDialog
    },
    getState,
    getSelectedBoard,
    getSelectedBoardPieces,
    getClientIdentity,
    getBootstrapIdentity,
    getCommandIdentity: getClientIdentity,
    createRequestId,
    postCommand,
    postBoardCommand: (command) => postBoardCommand(command as BoardCommand),
    dispatchCommandsSequential,
    selectPiece,
    requestRender,
    reportError,
    getCanPickLocalAssets
  })
}
