import type { GameCommand } from '../../../../shared/commands'
import type { CharacterId, PieceId } from '../../../../shared/ids'
import {
  validateMapLosSidecar,
  type MapLosSidecar
} from '../../../../shared/mapAssets'
import type {
  BoardState,
  GameState,
  PieceState
} from '../../../../shared/state'
import type { ClientIdentity } from '../../../game-commands.js'
import {
  createGameCommand,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
  parsePositiveNumberValue,
  type BootstrapCommandContext,
  uniqueBoardId
} from '../bootstrap-flow.js'
import {
  browserImageUrl,
  readImageDimensions as readImageDimensionsFromFile,
  readSelectedCroppedImageFileAsDataUrl,
  readSelectedImageFileAsDataUrl,
  type ImageDimensions,
  type ImageFileInput
} from '../../assets/images.js'
import {
  deriveMapAssetPickerViewModel,
  type MapAssetPickerItemViewModel,
  type MapAssetPickerViewModel
} from '../../assets/map-picker-view.js'
import { planCreatePieceCommands } from '../../piece/command-plan.js'
import {
  parseLocalAssetLosSidecarCandidates,
  parseLocalAssetMetadataCandidates
} from './local-metadata.js'

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
  pieceCharacterSelect: HTMLSelectElement
  localAssetMetadataInput: HTMLTextAreaElement
  loadLocalAssets: HTMLButtonElement
  boardAssetSelect: HTMLSelectElement
  boardLosSidecarInput: HTMLTextAreaElement
  useBoardAsset: HTMLButtonElement
  counterAssetSelect: HTMLSelectElement
  useCounterAsset: HTMLButtonElement
  localAssetStatus: HTMLElement
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
  getCanPickLocalAssets?: () => boolean
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

const createSelectOption = (
  select: HTMLSelectElement,
  value: string,
  label: string
): HTMLOptionElement => {
  const option = select.ownerDocument.createElement('option')
  option.value = value
  option.textContent = label
  return option
}

const renderAssetOptions = (
  select: HTMLSelectElement,
  items: readonly MapAssetPickerItemViewModel[],
  emptyLabel: string
): void => {
  const options =
    items.length === 0
      ? [createSelectOption(select, '', emptyLabel)]
      : [
          createSelectOption(select, '', 'Select asset'),
          ...items.map((item) => {
            return createSelectOption(
              select,
              item.assetRef,
              `${item.label} (${[
                item.dimensions.label,
                item.losSummary?.label
              ]
                .filter(Boolean)
                .join(', ')})`
            )
          })
        ]
  select.replaceChildren(...options)
  select.disabled = items.length === 0
}

const characterOptionLabel = ({
  name,
  type
}: Pick<GameState['characters'][CharacterId], 'name' | 'type'>): string =>
  `${name} (${type.toLowerCase()})`

const selectedAssetItem = (
  viewModel: MapAssetPickerViewModel | null,
  assetRef: string
): MapAssetPickerItemViewModel | null => {
  if (!assetRef) return null
  return (
    viewModel?.sections
      .flatMap((section) => section.items)
      .find((item) => item.assetRef === assetRef) ?? null
  )
}

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
  getCanPickLocalAssets = () => true,
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
  let assetPickerViewModel: MapAssetPickerViewModel | null = null
  let selectedBoardAssetId: string | null = null

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

  const applySelectedImageFileDataUrl = async (
    fileInput: ImageFileInput,
    imageInput: HTMLInputElement
  ): Promise<void> => {
    const dataUrl = await readImageDataUrl(fileInput)
    if (dataUrl) imageInput.value = dataUrl
  }

  const renderCharacterLinkOptions = (): void => {
    const selectedCharacterId = elements.pieceCharacterSelect.value
    const characters = Object.values(getState()?.characters ?? {})
      .filter((character) => character.active)
      .sort((left, right) => left.name.localeCompare(right.name))
    const options = [
      createSelectOption(
        elements.pieceCharacterSelect,
        '',
        characters.length === 0 ? 'No existing characters' : 'No character link'
      ),
      ...characters.map((character) =>
        createSelectOption(
          elements.pieceCharacterSelect,
          character.id,
          characterOptionLabel(character)
        )
      )
    ]

    elements.pieceCharacterSelect.replaceChildren(...options)
    elements.pieceCharacterSelect.value = characters.some(
      (character) => character.id === selectedCharacterId
    )
      ? selectedCharacterId
      : ''
  }

  const selectedPieceCharacterId = (): CharacterId | null => {
    const characterId = elements.pieceCharacterSelect.value.trim()
    return characterId ? (characterId as CharacterId) : null
  }

  const applySelectedPieceCharacter = (): void => {
    const characterId = selectedPieceCharacterId()
    const character = characterId ? getState()?.characters[characterId] : null
    if (!character) return
    if (!elements.pieceNameInput.value.trim()) {
      elements.pieceNameInput.value = character.name
    }
    elements.pieceSheetInput.checked = false
    reportError('')
  }

  const renderLocalAssetPicker = (
    viewModel: MapAssetPickerViewModel | null
  ): void => {
    const canPick = getCanPickLocalAssets()
    const boardItems =
      viewModel?.sections.flatMap((section) =>
        section.items.filter((item) => item.boardDefaults)
      ) ?? []
    const counterItems =
      viewModel?.sections.flatMap((section) =>
        section.items.filter((item) => item.pieceDefaults)
      ) ?? []

    renderAssetOptions(
      elements.boardAssetSelect,
      canPick ? boardItems : [],
      canPick ? 'No board assets' : 'Referee only'
    )
    renderAssetOptions(
      elements.counterAssetSelect,
      canPick ? counterItems : [],
      canPick ? 'No counter assets' : 'Referee only'
    )

    elements.loadLocalAssets.disabled = !canPick
    elements.localAssetMetadataInput.disabled = !canPick
    elements.boardLosSidecarInput.disabled = !canPick
    elements.useBoardAsset.disabled = !canPick || boardItems.length === 0
    elements.useCounterAsset.disabled = !canPick || counterItems.length === 0

    if (!canPick) {
      elements.localAssetStatus.textContent = 'Referee only'
      return
    }
    if (!viewModel) {
      elements.localAssetStatus.textContent = ''
      return
    }

    const validation = viewModel.validationSummary
    if (validation.hasErrors) {
      elements.localAssetStatus.textContent = [
        validation.title,
        ...validation.messages
      ]
        .filter(Boolean)
        .join(' ')
      return
    }

    if (viewModel.emptyState) {
      elements.localAssetStatus.textContent = viewModel.emptyState.message
      return
    }

    elements.localAssetStatus.textContent = `${boardItems.length} board asset(s), ${counterItems.length} counter asset(s)`
  }

  const loadLocalAssetMetadata = (): void => {
    reportError('')
    selectedBoardAssetId = null
    elements.boardLosSidecarInput.value = ''
    assetPickerViewModel = deriveMapAssetPickerViewModel(
      parseLocalAssetMetadataCandidates(elements.localAssetMetadataInput.value),
      parseLocalAssetLosSidecarCandidates(
        elements.localAssetMetadataInput.value
      )
    )
    renderLocalAssetPicker(assetPickerViewModel)
  }

  const applySelectedBoardAsset = (): void => {
    const item = selectedAssetItem(
      assetPickerViewModel,
      elements.boardAssetSelect.value
    )
    const defaults = item?.boardDefaults
    if (!defaults) {
      reportError('Select a board asset')
      return
    }

    elements.boardNameInput.value = defaults.name
    elements.boardImageInput.value = defaults.imageAssetId
    selectedBoardAssetId = defaults.imageAssetId
    elements.boardWidthInput.value = String(defaults.width)
    elements.boardHeightInput.value = String(defaults.height)
    elements.boardScaleInput.value = String(defaults.scale)
    elements.boardLosSidecarInput.value = item.losSidecar
      ? JSON.stringify(item.losSidecar, null, 2)
      : ''
    elements.localAssetStatus.textContent = item.losSummary
      ? `${defaults.name}: ${item.losSummary.label}`
      : `${defaults.name}: no LOS sidecar`
    reportError('')
  }

  const selectedBoardLosSidecar = (imageAssetId: string | null) =>
    imageAssetId
      ? (selectedAssetItem(assetPickerViewModel, imageAssetId)?.losSidecar ??
        null)
      : null

  const reviewedBoardLosSidecar = (
    imageAssetId: string | null
  ):
    | { ok: true; value: MapLosSidecar | null }
    | { ok: false; error: string } => {
    const rawSidecar = elements.boardLosSidecarInput.value.trim()
    if (!rawSidecar) {
      return { ok: true, value: selectedBoardLosSidecar(imageAssetId) }
    }
    if (!imageAssetId) {
      return {
        ok: false,
        error: 'Select a board asset before using a LOS sidecar'
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawSidecar)
    } catch {
      return { ok: false, error: 'LOS sidecar JSON is invalid' }
    }

    const result = validateMapLosSidecar(parsed)
    if (!result.ok) {
      return {
        ok: false,
        error: `LOS sidecar is invalid: ${result.error.join(', ')}`
      }
    }
    if (result.value.assetRef !== imageAssetId) {
      return {
        ok: false,
        error: 'LOS sidecar assetRef must match the selected board asset'
      }
    }

    return { ok: true, value: result.value }
  }

  const applySelectedCounterAsset = (): void => {
    const item = selectedAssetItem(
      assetPickerViewModel,
      elements.counterAssetSelect.value
    )
    const defaults = item?.pieceDefaults
    if (!defaults) {
      reportError('Select a counter asset')
      return
    }

    elements.pieceNameInput.value = defaults.name
    elements.pieceImageInput.value = defaults.imageAssetId
    elements.pieceWidthInput.value = String(defaults.width)
    elements.pieceHeightInput.value = String(defaults.height)
    elements.pieceScaleInput.value = String(defaults.scale)
    reportError('')
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
    const imageRef =
      (await readImageDataUrl(elements.boardImageFileInput)) ||
      elements.boardImageInput.value.trim() ||
      null
    const imageUrl = browserImageUrl(imageRef) ? imageRef : null
    const hasBoardFile = Boolean(elements.boardImageFileInput.files?.[0])
    const imageAssetId =
      imageRef && !imageUrl
        ? imageRef
        : hasBoardFile
          ? selectedBoardAssetId
          : null
    const losSidecar = reviewedBoardLosSidecar(imageAssetId)
    if (!losSidecar.ok) {
      reportError(losSidecar.error)
      elements.boardLosSidecarInput.focus()
      return
    }

    await postBoardCommand({
      type: 'CreateBoard',
      ...getCommandIdentity(),
      boardId: uniqueBoardId(state, name),
      name,
      imageAssetId,
      url: imageUrl,
      losSidecar: losSidecar.value,
      width: parsePositiveIntegerInput(elements.boardWidthInput, 1200),
      height: parsePositiveIntegerInput(elements.boardHeightInput, 800),
      scale: parsePositiveIntegerInput(elements.boardScaleInput, 50)
    })

    elements.boardNameInput.value = ''
    elements.boardImageInput.value = ''
    elements.boardImageFileInput.value = ''
    elements.boardLosSidecarInput.value = ''
    selectedBoardAssetId = null
    elements.roomDialog.close()
    requestRender()
  }

  const createCustomPiece = async (): Promise<void> => {
    renderCharacterLinkOptions()
    const state = getState()
    const board = getSelectedBoard()
    if (!state || !board) {
      reportError('Bootstrap a board before creating a piece')
      return
    }

    const linkedCharacterId = selectedPieceCharacterId()
    const linkedCharacter = linkedCharacterId
      ? state.characters[linkedCharacterId]
      : null
    const name =
      elements.pieceNameInput.value.trim() || linkedCharacter?.name || ''
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
      linkedCharacterId,
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
    elements.pieceCharacterSelect.value = ''
    elements.roomDialog.close()
    requestRender()
  }

  addListener(elements.createPiece, 'click', () => {
    createCustomPiece().catch((error) => reportError(error.message))
  })
  addListener(elements.loadLocalAssets, 'click', () => {
    try {
      loadLocalAssetMetadata()
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error))
    }
  })
  addListener(elements.useBoardAsset, 'click', () => {
    applySelectedBoardAsset()
  })
  addListener(elements.useCounterAsset, 'click', () => {
    applySelectedCounterAsset()
  })
  addListener(elements.pieceCharacterSelect, 'focus', () => {
    renderCharacterLinkOptions()
  })
  addListener(elements.pieceCharacterSelect, 'click', () => {
    renderCharacterLinkOptions()
  })
  addListener(elements.pieceCharacterSelect, 'change', () => {
    applySelectedPieceCharacter()
  })
  addListener(elements.pieceImageFileInput, 'change', () => {
    Promise.all([
      applySelectedImageFileDataUrl(
        elements.pieceImageFileInput,
        elements.pieceImageInput
      ),
      applyPieceFileDimensions()
    ]).catch((error: Error) => reportError(error.message))
  })
  addListener(elements.createBoard, 'click', () => {
    createCustomBoard().catch((error) => reportError(error.message))
  })
  addListener(elements.boardImageFileInput, 'change', () => {
    Promise.all([
      applySelectedImageFileDataUrl(
        elements.boardImageFileInput,
        elements.boardImageInput
      ),
      applyBoardFileDimensions()
    ]).catch((error: Error) => reportError(error.message))
  })

  renderLocalAssetPicker(null)
  renderCharacterLinkOptions()

  return {
    dispose: () => {
      for (const remove of listeners.splice(0)) remove()
    }
  }
}
