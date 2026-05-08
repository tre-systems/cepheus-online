import type { GameCommand } from '../../shared/commands'
import type { PieceId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'
import {
  createGameCommand,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
  parsePositiveNumberValue,
  type BootstrapCommandContext,
  uniqueBoardId
} from './bootstrap-flow.js'
import {
  readImageDimensions as readImageDimensionsFromFile,
  readSelectedCroppedImageFileAsDataUrl,
  readSelectedImageFileAsDataUrl,
  type ImageDimensions,
  type ImageFileInput
} from './image-assets.js'
import { planCreatePieceCommands } from './piece-command-plan.js'

export interface RoomAssetCreationElements {
  createPiece: HTMLButtonElement
  createBoard: HTMLButtonElement
  pieceNameInput: HTMLInputElement
  pieceImageInput: HTMLInputElement
  pieceImageFileInput: HTMLInputElement
  pieceCropInput: HTMLInputElement
  pieceCropXInput: HTMLInputElement
  pieceCropYInput: HTMLInputElement
  pieceCropWidthInput: HTMLInputElement
  pieceCropHeightInput: HTMLInputElement
  pieceWidthInput: HTMLInputElement
  pieceHeightInput: HTMLInputElement
  pieceScaleInput: HTMLInputElement
  pieceSheetInput: HTMLInputElement
  boardNameInput: HTMLInputElement
  boardImageInput: HTMLInputElement
  boardImageFileInput: HTMLInputElement
  boardWidthInput: HTMLInputElement
  boardHeightInput: HTMLInputElement
  boardScaleInput: HTMLInputElement
  roomDialog: Pick<HTMLDialogElement, 'close'>
}

export interface RoomAssetCreationController {
  dispose(): void
}

export interface RoomAssetCreationDependencies {
  readImageDimensions?: (file: File) => Promise<ImageDimensions>
  readImageDataUrl?: (input: ImageFileInput) => Promise<string | null>
  readCroppedImageDataUrl?: (
    input: ImageFileInput,
    crop: { x: number; y: number; width: number; height: number }
  ) => Promise<string | null>
}

export interface RoomAssetCreationOptions {
  elements: RoomAssetCreationElements
  getState: () => GameState | null
  getSelectedBoard: () => BoardState | null
  getSelectedBoardPieces: () => readonly PieceState[]
  getClientIdentity: () => ClientIdentity
  getBootstrapIdentity: () => BootstrapCommandContext
  getCommandIdentity: () => ClientIdentity
  createRequestId: (scope: string) => string
  postCommand: (command: GameCommand, requestId?: string) => Promise<unknown>
  postBoardCommand: (command: GameCommand) => Promise<unknown>
  dispatchCommandsSequential: (
    commands: readonly GameCommand[]
  ) => Promise<unknown>
  selectPiece: (pieceId: PieceId) => void
  requestRender: () => void
  reportError: (message: string) => void
  dependencies?: RoomAssetCreationDependencies
}

const parsePositiveIntegerInput = (
  input: HTMLInputElement,
  fallback: number
): number => parsePositiveIntegerValue(input.value, fallback)

const parsePositiveNumberInput = (
  input: HTMLInputElement,
  fallback: number
): number => parsePositiveNumberValue(input.value, fallback)

const parseNonNegativeIntegerInput = (
  input: HTMLInputElement,
  fallback: number
): number => parseNonNegativeIntegerValue(input.value, fallback)

const applyPieceDimensions = (
  dimensions: ImageDimensions,
  elements: Pick<
    RoomAssetCreationElements,
    'pieceWidthInput' | 'pieceHeightInput'
  >
): void => {
  const shortAxis = Math.min(dimensions.width, dimensions.height)
  const longAxis = Math.max(dimensions.width, dimensions.height)
  if (shortAxis > 301 || longAxis / shortAxis > 2.2) return

  const aspectRatio = dimensions.width / dimensions.height
  if (aspectRatio > 1.45) {
    elements.pieceWidthInput.value = '100'
    elements.pieceHeightInput.value = '50'
    return
  }
  if (aspectRatio < 0.69) {
    elements.pieceWidthInput.value = '50'
    elements.pieceHeightInput.value = '100'
    return
  }
  elements.pieceWidthInput.value = '50'
  elements.pieceHeightInput.value = '50'
}

export const createRoomAssetCreationController = ({
  elements,
  getState,
  getSelectedBoard,
  getSelectedBoardPieces,
  getClientIdentity,
  getBootstrapIdentity,
  getCommandIdentity,
  createRequestId,
  postCommand,
  postBoardCommand,
  dispatchCommandsSequential,
  selectPiece,
  requestRender,
  reportError,
  dependencies = {}
}: RoomAssetCreationOptions): RoomAssetCreationController => {
  const readImageDimensions =
    dependencies.readImageDimensions ?? readImageDimensionsFromFile
  const readImageDataUrl =
    dependencies.readImageDataUrl ?? readSelectedImageFileAsDataUrl
  const readCroppedImageDataUrl =
    dependencies.readCroppedImageDataUrl ??
    readSelectedCroppedImageFileAsDataUrl
  const listeners: Array<() => void> = []

  const addListener = (
    target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
    type: string,
    listener: EventListener
  ): void => {
    target.addEventListener(type, listener)
    listeners.push(() => target.removeEventListener(type, listener))
  }

  const selectedPieceImageDataUrl = async (): Promise<string | null> => {
    const file = elements.pieceImageFileInput.files?.[0]
    if (!file) return elements.pieceImageInput.value.trim() || null
    if (!elements.pieceCropInput.checked) {
      return await readImageDataUrl(elements.pieceImageFileInput)
    }

    return await readCroppedImageDataUrl(elements.pieceImageFileInput, {
      x: parseNonNegativeIntegerInput(elements.pieceCropXInput, 0),
      y: parseNonNegativeIntegerInput(elements.pieceCropYInput, 0),
      width: parsePositiveIntegerInput(elements.pieceCropWidthInput, 150),
      height: parsePositiveIntegerInput(elements.pieceCropHeightInput, 150)
    })
  }

  const applyBoardFileDimensions = async (): Promise<void> => {
    const file = elements.boardImageFileInput.files?.[0]
    if (!file) return
    const dimensions = await readImageDimensions(file)
    elements.boardWidthInput.value = String(dimensions.width)
    elements.boardHeightInput.value = String(dimensions.height)
  }

  const applyPieceFileDimensions = async (): Promise<void> => {
    const file = elements.pieceImageFileInput.files?.[0]
    if (!file) return
    applyPieceDimensions(await readImageDimensions(file), elements)
  }

  const createCustomBoard = async (): Promise<void> => {
    reportError('')
    if (!getState()) {
      await postCommand(
        createGameCommand(getBootstrapIdentity()),
        createRequestId('create-game-for-board')
      )
    }

    const state = getState()
    const name =
      elements.boardNameInput.value.trim() ||
      `Board ${Object.keys(state?.boards || {}).length + 1}`
    const imageUrl =
      (await readImageDataUrl(elements.boardImageFileInput)) ||
      elements.boardImageInput.value.trim() ||
      null

    await postBoardCommand({
      type: 'CreateBoard',
      ...getCommandIdentity(),
      boardId: uniqueBoardId(state, name),
      name,
      imageAssetId: null,
      url: imageUrl,
      width: parsePositiveIntegerInput(elements.boardWidthInput, 1200),
      height: parsePositiveIntegerInput(elements.boardHeightInput, 800),
      scale: parsePositiveIntegerInput(elements.boardScaleInput, 50)
    })

    elements.boardNameInput.value = ''
    elements.boardImageInput.value = ''
    elements.boardImageFileInput.value = ''
    elements.roomDialog.close()
    requestRender()
  }

  const createCustomPiece = async (): Promise<void> => {
    const state = getState()
    const board = getSelectedBoard()
    if (!state || !board) {
      reportError('Bootstrap a board before creating a piece')
      return
    }

    const name = elements.pieceNameInput.value.trim()
    if (!name) {
      reportError('Piece name is required')
      elements.pieceNameInput.focus()
      return
    }

    const plan = planCreatePieceCommands({
      identity: getClientIdentity(),
      state,
      board,
      name,
      imageAssetId: await selectedPieceImageDataUrl(),
      width: parsePositiveIntegerInput(elements.pieceWidthInput, 50),
      height: parsePositiveIntegerInput(elements.pieceHeightInput, 50),
      scale: parsePositiveNumberInput(elements.pieceScaleInput, 1),
      existingPieceCount: getSelectedBoardPieces().length,
      withCharacterSheet: elements.pieceSheetInput.checked
    })
    if (!plan.ok) {
      reportError(plan.error)
      if (plan.focus === 'name') elements.pieceNameInput.focus()
      return
    }

    await dispatchCommandsSequential(plan.commands)
    selectPiece(plan.pieceId)
    elements.pieceNameInput.value = ''
    elements.pieceImageInput.value = ''
    elements.pieceImageFileInput.value = ''
    elements.pieceCropInput.checked = false
    elements.pieceCropXInput.value = '0'
    elements.pieceCropYInput.value = '0'
    elements.pieceCropWidthInput.value = '150'
    elements.pieceCropHeightInput.value = '150'
    elements.pieceWidthInput.value = '50'
    elements.pieceHeightInput.value = '50'
    elements.pieceScaleInput.value = '1'
    elements.roomDialog.close()
    requestRender()
  }

  addListener(elements.createPiece, 'click', () => {
    createCustomPiece().catch((error) => reportError(error.message))
  })
  addListener(elements.pieceImageFileInput, 'change', () => {
    applyPieceFileDimensions().catch((error) => reportError(error.message))
  })
  addListener(elements.createBoard, 'click', () => {
    createCustomBoard().catch((error) => reportError(error.message))
  })
  addListener(elements.boardImageFileInput, 'change', () => {
    applyBoardFileDimensions().catch((error) => reportError(error.message))
  })

  return {
    dispose: () => {
      for (const remove of listeners.splice(0)) remove()
    }
  }
}
