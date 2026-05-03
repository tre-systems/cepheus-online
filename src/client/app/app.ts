// @ts-nocheck

import {
  DEFAULT_BOARD_CAMERA,
  deriveBoardTransform,
  deriveCameraZoom,
  findHitPiece,
  screenToBoard as screenPointToBoard,
  clampPiecePosition as clampPiecePositionToBoard
} from './board-geometry.js'
import {
  boardList,
  boardOptionLabel,
  boardSelectTitle,
  boardStatusLabel,
  selectedBoard as selectSelectedBoard,
  selectedBoardId as selectSelectedBoardId,
  selectedBoardPieces,
  pieceImageUrl,
  boardImageUrl
} from './board-view.js'
import {
  cssUrl,
  loadBrowserImage,
  readImageDimensions,
  readSelectedCroppedImageFileAsDataUrl,
  readSelectedImageFileAsDataUrl
} from './image-assets.js'
import {
  createGameCommand,
  nextBootstrapCommand,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
  parsePositiveNumberValue,
  uniqueBoardId,
  uniqueCharacterId,
  uniquePieceId
} from './bootstrap-flow.js'
import {
  buildRoomPath,
  buildViewerQuery,
  fetchRoomState,
  postRoomCommand
} from './room-api.js'
import { animateRoll as animateDiceRoll } from './dice-overlay.js'

const DEFAULT_GAME_ID = 'demo-room'
const DEFAULT_ACTOR_ID = 'local-user'
const INSTALL_DISMISSED_KEY = 'cepheus-online-pwa-install-dismissed'
const INSTALL_ACCEPTED_KEY = 'cepheus-online-pwa-install-accepted'
const DRAG_START_SLOP_PX = 6

const qs = new URLSearchParams(location.search)
if ('serviceWorker' in navigator) {
  let hadServiceWorkerController = navigator.serviceWorker.controller !== null
  let isReloadingForServiceWorker = false
  navigator.serviceWorker.register('/sw.js').catch(() => {})
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController) {
      hadServiceWorkerController = true
      return
    }

    if (isReloadingForServiceWorker) return
    isReloadingForServiceWorker = true
    location.reload()
  })
}

const els = {
  status: document.getElementById('connectionStatus'),
  roomForm: document.getElementById('roomForm'),
  roomInput: document.getElementById('roomInput'),
  userInput: document.getElementById('userInput'),
  bootstrap: document.getElementById('bootstrapButton'),
  refresh: document.getElementById('refreshButton'),
  createPiece: document.getElementById('createPieceButton'),
  createBoard: document.getElementById('createBoardButton'),
  pieceNameInput: document.getElementById('pieceNameInput'),
  pieceImageInput: document.getElementById('pieceImageInput'),
  pieceImageFileInput: document.getElementById('pieceImageFileInput'),
  pieceCropInput: document.getElementById('pieceCropInput'),
  pieceCropXInput: document.getElementById('pieceCropXInput'),
  pieceCropYInput: document.getElementById('pieceCropYInput'),
  pieceCropWidthInput: document.getElementById('pieceCropWidthInput'),
  pieceCropHeightInput: document.getElementById('pieceCropHeightInput'),
  pieceWidthInput: document.getElementById('pieceWidthInput'),
  pieceHeightInput: document.getElementById('pieceHeightInput'),
  pieceScaleInput: document.getElementById('pieceScaleInput'),
  pieceSheetInput: document.getElementById('pieceSheetInput'),
  boardNameInput: document.getElementById('boardNameInput'),
  boardImageInput: document.getElementById('boardImageInput'),
  boardImageFileInput: document.getElementById('boardImageFileInput'),
  boardWidthInput: document.getElementById('boardWidthInput'),
  boardHeightInput: document.getElementById('boardHeightInput'),
  boardScaleInput: document.getElementById('boardScaleInput'),
  roll: document.getElementById('rollButton'),
  diceExpression: document.getElementById('diceExpression'),
  error: document.getElementById('errorText'),
  boardStatus: document.getElementById('boardStatus'),
  boardSelect: document.getElementById('boardSelect'),
  zoomOut: document.getElementById('zoomOutButton'),
  zoomReset: document.getElementById('zoomResetButton'),
  zoomIn: document.getElementById('zoomInButton'),
  canvas: document.getElementById('boardCanvas'),
  diceStage: document.getElementById('diceStage'),
  diceOverlay: document.getElementById('diceOverlay'),
  pwaInstallPrompt: document.getElementById('pwaInstallPrompt'),
  pwaInstallButton: document.getElementById('pwaInstallButton'),
  pwaInstallDismissButton: document.getElementById('pwaInstallDismissButton'),
  initiativeRail: document.getElementById('initiativeRail'),
  sheet: document.getElementById('characterSheet'),
  sheetButton: document.getElementById('sheetButton'),
  sheetClose: document.getElementById('sheetCloseButton'),
  sheetName: document.getElementById('sheetName'),
  sheetBody: document.getElementById('sheetBody'),
  sheetTabs: Array.from(document.querySelectorAll('[data-sheet-tab]')),
  menu: document.getElementById('menuButton'),
  roomDialog: document.getElementById('roomDialog'),
  roomCancel: document.getElementById('roomCancelButton')
}

const ctx = els.canvas.getContext('2d')
let roomId = qs.get('game') || DEFAULT_GAME_ID
let actorId = qs.get('user') || DEFAULT_ACTOR_ID
let state = null
let socket = null
let firstStateApplied = false
let latestDiceId = null
const viewerRole = qs.get('viewer') || 'referee'
const canSelectBoards = viewerRole.toLowerCase() === 'referee'
let selectedPieceId = null
let sheetOpen = false
let activeSheetTab = 'details'
let drag = null
let boardCamera = { ...DEFAULT_BOARD_CAMERA }
let cameraBoardId = null
let requestCounter = 0
let diceHideTimer = null
const boardImageCache = new Map()
const pieceImageCache = new Map()
let deferredInstallPrompt = null

els.roomInput.value = roomId
els.userInput.value = actorId

const setStatus = (text) => {
  els.status.textContent = text
}

const setError = (text) => {
  els.error.textContent = text || ''
}

const isStandaloneDisplay = () =>
  matchMedia('(display-mode: standalone)').matches ||
  navigator.standalone === true

const hideInstallPrompt = () => {
  if (els.pwaInstallPrompt) els.pwaInstallPrompt.hidden = true
}

const refreshInstallPrompt = () => {
  if (
    !els.pwaInstallPrompt ||
    !els.pwaInstallButton ||
    !deferredInstallPrompt ||
    isStandaloneDisplay() ||
    localStorage.getItem(INSTALL_DISMISSED_KEY) === '1' ||
    localStorage.getItem(INSTALL_ACCEPTED_KEY) === '1'
  ) {
    hideInstallPrompt()
    return
  }

  els.pwaInstallPrompt.hidden = false
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event
  refreshInstallPrompt()
})

window.addEventListener('appinstalled', () => {
  localStorage.setItem(INSTALL_ACCEPTED_KEY, '1')
  deferredInstallPrompt = null
  hideInstallPrompt()
})

els.pwaInstallButton?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return
  const promptEvent = deferredInstallPrompt
  deferredInstallPrompt = null
  hideInstallPrompt()
  await promptEvent.prompt()
  const choice = await promptEvent.userChoice
  if (choice.outcome === 'accepted') {
    localStorage.setItem(INSTALL_ACCEPTED_KEY, '1')
  }
})

els.pwaInstallDismissButton?.addEventListener('click', () => {
  localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
  hideInstallPrompt()
})

const requestId = (prefix) =>
  prefix + '-' + Date.now().toString(36) + '-' + (++requestCounter).toString(36)

const sequenceCommand = (command) => {
  if (
    !state ||
    command.expectedSeq !== undefined ||
    command.type === 'CreateGame'
  ) {
    return command
  }

  return {
    ...command,
    expectedSeq: state.eventSeq
  }
}

const applyServerMessage = (message) => {
  switch (message.type) {
    case 'roomState':
    case 'commandAccepted':
      return {
        nextState: message.state,
        shouldApplyState: true,
        error: '',
        shouldReload: false
      }
    case 'commandRejected':
      return {
        nextState: state,
        shouldApplyState: false,
        error: message.error.message,
        shouldReload: message.error.code === 'stale_command'
      }
    case 'error':
      return {
        nextState: state,
        shouldApplyState: false,
        error: message.error.message,
        shouldReload: false
      }
    case 'pong':
      return {
        nextState: state,
        shouldApplyState: false,
        error: '',
        shouldReload: false
      }
    default:
      return {
        nextState: state,
        shouldApplyState: false,
        error: 'Unhandled server message ' + message.type,
        shouldReload: false
      }
  }
}

const handleServerMessage = (message) => {
  const application = applyServerMessage(message)
  setError(application.error)
  if (application.shouldApplyState) {
    applyState(application.nextState)
  }
  if (application.shouldReload) {
    fetchState().catch((err) => setError(err.message))
  }
}

const postCommand = async (command, id = requestId(command.type)) => {
  const sequencedCommand = sequenceCommand(command)
  const response = await postRoomCommand({
    roomId,
    requestId: id,
    command: sequencedCommand
  })
  handleServerMessage(response.message)
  if (!response.ok) {
    throw new Error(response.message.error?.message || 'Command failed')
  }
  return response.message
}

const dispatchCommand = async (command) => {
  const id = requestId(command.type)
  await postCommand(command, id)
}

const sendCommand = dispatchCommand

const fetchState = async () => {
  const message = await fetchRoomState({ roomId, viewerRole, actorId })
  handleServerMessage(message)
}

const parsePositiveIntegerInput = (input, fallback) => {
  return parsePositiveIntegerValue(input.value, fallback)
}

const parsePositiveNumberInput = (input, fallback) => {
  return parsePositiveNumberValue(input.value, fallback)
}

const parseNonNegativeIntegerInput = (input, fallback) => {
  return parseNonNegativeIntegerValue(input.value, fallback)
}

const applyBoardFileDimensions = async () => {
  const file = els.boardImageFileInput.files?.[0]
  if (!file) return
  const dimensions = await readImageDimensions(file)
  els.boardWidthInput.value = String(dimensions.width)
  els.boardHeightInput.value = String(dimensions.height)
}

const applyPieceFileDimensions = async () => {
  const file = els.pieceImageFileInput.files?.[0]
  if (!file) return
  const dimensions = await readImageDimensions(file)
  const shortAxis = Math.min(dimensions.width, dimensions.height)
  const longAxis = Math.max(dimensions.width, dimensions.height)
  if (shortAxis > 301 || longAxis / shortAxis > 2.2) return

  const aspectRatio = dimensions.width / dimensions.height
  if (aspectRatio > 1.45) {
    els.pieceWidthInput.value = '100'
    els.pieceHeightInput.value = '50'
    return
  }
  if (aspectRatio < 0.69) {
    els.pieceWidthInput.value = '50'
    els.pieceHeightInput.value = '100'
    return
  }
  els.pieceWidthInput.value = '50'
  els.pieceHeightInput.value = '50'
}

const selectedPieceImageDataUrl = async () => {
  const file = els.pieceImageFileInput.files?.[0]
  if (!file) return els.pieceImageInput.value.trim() || null
  if (!els.pieceCropInput.checked)
    return await readSelectedImageFileAsDataUrl(els.pieceImageFileInput)

  return await readSelectedCroppedImageFileAsDataUrl(els.pieceImageFileInput, {
    x: parseNonNegativeIntegerInput(els.pieceCropXInput, 0),
    y: parseNonNegativeIntegerInput(els.pieceCropYInput, 0),
    width: parsePositiveIntegerInput(els.pieceCropWidthInput, 150),
    height: parsePositiveIntegerInput(els.pieceCropHeightInput, 150)
  })
}

const createManualCharacterCommand = (characterId, name) => ({
  type: 'CreateCharacter',
  gameId: roomId,
  actorId,
  characterId,
  characterType: 'PLAYER',
  name
})

const updateManualCharacterSheetCommand = (characterId) => ({
  type: 'UpdateCharacterSheet',
  gameId: roomId,
  actorId,
  characterId,
  age: 30,
  characteristics: {
    str: 7,
    dex: 7,
    end: 7,
    int: 7,
    edu: 7,
    soc: 7
  },
  skills: ['Athletics-0', 'Gun Combat-0'],
  equipment: [],
  credits: 0
})

const currentBoardList = () => boardList(state)

const currentSelectedBoardId = () => selectSelectedBoardId(state)

const createCustomBoard = async () => {
  setError('')
  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-board')
    )
  }

  const name =
    els.boardNameInput.value.trim() ||
    'Board ' + (Object.keys(state?.boards || {}).length + 1)
  const width = parsePositiveIntegerInput(els.boardWidthInput, 1200)
  const height = parsePositiveIntegerInput(els.boardHeightInput, 800)
  const scale = parsePositiveIntegerInput(els.boardScaleInput, 50)
  const boardId = uniqueBoardId(state, name)
  const imageUrl =
    (await readSelectedImageFileAsDataUrl(els.boardImageFileInput)) ||
    els.boardImageInput.value.trim() ||
    null
  await sendCommand({
    type: 'CreateBoard',
    gameId: roomId,
    actorId,
    boardId,
    name,
    imageAssetId: null,
    url: imageUrl,
    width,
    height,
    scale
  })
  els.boardNameInput.value = ''
  els.boardImageInput.value = ''
  els.boardImageFileInput.value = ''
  els.roomDialog.close()
  render()
}

const createCustomPiece = async () => {
  const board = selectedBoard()
  if (!state || !board) {
    setError('Bootstrap a board before creating a piece')
    return
  }

  const name = els.pieceNameInput.value.trim()
  if (!name) {
    setError('Piece name is required')
    els.pieceNameInput.focus()
    return
  }

  const width = parsePositiveIntegerInput(els.pieceWidthInput, 50)
  const height = parsePositiveIntegerInput(els.pieceHeightInput, 50)
  const scale = parsePositiveNumberInput(els.pieceScaleInput, 1)
  const pieceIndex = boardPieces().length
  const x = Math.max(
    0,
    Math.min(board.width - width * scale, 160 + (pieceIndex % 8) * 58)
  )
  const y = Math.max(
    0,
    Math.min(
      board.height - height * scale,
      140 + Math.floor(pieceIndex / 8) * 58
    )
  )
  const pieceId = uniquePieceId(state, name)
  const characterId = els.pieceSheetInput.checked
    ? uniqueCharacterId(state, name)
    : null
  const imageAssetId = await selectedPieceImageDataUrl()
  if (characterId) {
    await sendCommand(createManualCharacterCommand(characterId, name))
    await sendCommand(updateManualCharacterSheetCommand(characterId))
  }
  await sendCommand({
    type: 'CreatePiece',
    gameId: roomId,
    actorId,
    pieceId,
    boardId: board.id,
    name,
    characterId,
    imageAssetId,
    x,
    y,
    width,
    height,
    scale
  })
  selectedPieceId = pieceId
  els.pieceNameInput.value = ''
  els.pieceImageInput.value = ''
  els.pieceImageFileInput.value = ''
  els.pieceCropInput.checked = false
  els.pieceCropXInput.value = '0'
  els.pieceCropYInput.value = '0'
  els.pieceCropWidthInput.value = '150'
  els.pieceCropHeightInput.value = '150'
  els.pieceWidthInput.value = '50'
  els.pieceHeightInput.value = '50'
  els.pieceScaleInput.value = '1'
  els.roomDialog.close()
  render()
}

const bootstrapScene = async () => {
  setError('')
  for (let i = 0; i < 6; i++) {
    const command = nextBootstrapCommand({ roomId, actorId, state })
    if (!command) break
    await postCommand(command, 'bootstrap-' + i)
  }
  await fetchState()
}

const connectSocket = () => {
  if (socket) socket.close()
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(
    protocol +
      '//' +
      location.host +
      buildRoomPath(roomId) +
      '/ws' +
      buildViewerQuery(viewerRole, actorId)
  )
  setStatus('Connecting')

  socket.addEventListener('open', () => {
    setStatus('Live')
  })

  socket.addEventListener('close', () => {
    setStatus('HTTP fallback')
  })

  socket.addEventListener('error', () => {
    setStatus('HTTP fallback')
  })

  socket.addEventListener('message', (event) => {
    try {
      handleServerMessage(JSON.parse(event.data))
    } catch {
      setError('Received an invalid server message')
    }
  })
}

const applyState = (nextState) => {
  const previousDiceId = latestDiceId
  state = nextState
  const latestRoll = state?.diceLog?.[state.diceLog.length - 1] || null
  latestDiceId = latestRoll?.id || null
  render()
  if (latestRoll && firstStateApplied && latestRoll.id !== previousDiceId) {
    animateRoll(latestRoll)
  }
  firstStateApplied = true
}

const selectedBoard = () => {
  return selectSelectedBoard(state)
}

const boardPieces = () => {
  return selectedBoardPieces(state)
}

const loadImage = (url, cache) => {
  return loadBrowserImage(url, cache, render)
}

const loadBoardImage = (board) =>
  loadImage(boardImageUrl(board), boardImageCache)

const loadPieceImage = (piece) =>
  loadImage(pieceImageUrl(piece), pieceImageCache)

const resetBoardCamera = () => {
  boardCamera = { ...DEFAULT_BOARD_CAMERA }
}

const ensureBoardCamera = (board) => {
  if (!board || cameraBoardId === board.id) return
  cameraBoardId = board.id
  resetBoardCamera()
}

const canvasCssSize = () => {
  const rect = els.canvas.getBoundingClientRect()
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  }
}

const boardTransform = (board, cssWidth, cssHeight) => {
  return deriveBoardTransform(board, boardCamera, cssWidth, cssHeight)
}

const screenPoint = (event) => {
  const rect = els.canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

const screenToBoard = (screen, _board, transform) =>
  screenPointToBoard(screen, transform)

const canvasPoint = (event) => {
  const board = selectedBoard()
  if (!board) return { x: 0, y: 0 }
  const size = canvasCssSize()
  return screenToBoard(
    screenPoint(event),
    board,
    boardTransform(board, size.width, size.height)
  )
}

const clampPiecePosition = (piece, x, y) => {
  const board = selectedBoard()
  if (!board) return { x, y }
  return clampPiecePositionToBoard(board, piece, x, y)
}

const setCameraZoom = (nextZoom, anchorScreen = null) => {
  const board = selectedBoard()
  if (!board) return
  const size = canvasCssSize()
  boardCamera = deriveCameraZoom({
    board,
    camera: boardCamera,
    cssWidth: size.width,
    cssHeight: size.height,
    nextZoom,
    anchorScreen
  })
  render()
}

const releaseCanvasPointer = (pointerId) => {
  if (els.canvas.hasPointerCapture(pointerId)) {
    els.canvas.releasePointerCapture(pointerId)
  }
}

const hitPiece = (point, transform = null, pointerType = 'mouse') => {
  return findHitPiece(point, boardPieces(), transform, pointerType)
}

const selectedPiece = () => {
  const pieces = boardPieces()
  return (
    pieces.find((piece) => piece.id === selectedPieceId) || pieces[0] || null
  )
}

const selectedCharacter = (piece) => {
  if (!piece?.characterId) return null
  return state?.characters?.[piece.characterId] || null
}

const setSheetOpen = (open) => {
  sheetOpen = open
  els.sheet.classList.toggle('open', sheetOpen)
}

const sheetRow = (label, value) => {
  const row = document.createElement('div')
  row.className = 'sheet-row'
  const labelEl = document.createElement('span')
  labelEl.className = 'sheet-label'
  labelEl.textContent = label
  const valueEl = document.createElement('span')
  valueEl.className = 'sheet-value'
  valueEl.textContent = value
  row.append(labelEl, valueEl)
  return row
}

const emptySheetText = (text) => {
  const empty = document.createElement('p')
  empty.className = 'sheet-empty'
  empty.textContent = text
  return empty
}

const sheetSectionTitle = (text) => {
  const title = document.createElement('h3')
  title.className = 'sheet-section-title'
  title.textContent = text
  return title
}

const sheetNotePreview = (text) => {
  const preview = document.createElement('p')
  preview.className = 'sheet-note-preview'
  preview.textContent = text || 'No notes'
  return preview
}

const characterSheetPatchTargetId = (target) =>
  typeof target === 'string'
    ? target
    : target?.characterId || target?.id || null

const sendCharacterSheetPatch = (target, patch) => {
  const characterId = characterSheetPatchTargetId(target)
  if (!characterId || !patch || Object.keys(patch).length === 0)
    return Promise.resolve()
  return sendCommand({
    type: 'UpdateCharacterSheet',
    gameId: roomId,
    actorId,
    characterId,
    ...patch
  })
}

const statStrip = (character) => {
  const values = character?.characteristics || {}
  const fallback = { str: 7, dex: 8, end: 8, int: 7, edu: 9, soc: 6 }
  const stats = document.createElement('div')
  stats.className = 'stat-strip'
  for (const [label, key] of [
    ['Str', 'str'],
    ['Dex', 'dex'],
    ['End', 'end'],
    ['Int', 'int'],
    ['Edu', 'edu'],
    ['Soc', 'soc']
  ]) {
    const stat = document.createElement('div')
    stat.className = 'stat'
    const name = document.createElement('b')
    name.textContent = label
    const number = document.createElement('span')
    number.textContent = String(
      values[key] ?? values[key.toUpperCase()] ?? fallback[key]
    )
    stat.append(name, number)
    stats.append(stat)
  }
  return stats
}

const nullableNumberFromInput = (input) => {
  const value = input.value.trim()
  if (!value) return null
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? number : null
}

const editableDetailsForm = (piece, character) => {
  if (!piece?.characterId || !character) return statStrip(character)

  const form = document.createElement('div')
  form.className = 'sheet-edit-form'
  const line = document.createElement('div')
  line.className = 'sheet-edit-line'
  const ageLabel = document.createElement('label')
  ageLabel.textContent = 'Age'
  const ageInput = document.createElement('input')
  ageInput.name = 'age'
  ageInput.inputMode = 'numeric'
  ageInput.autocomplete = 'off'
  ageInput.value = character.age == null ? '' : String(character.age)
  ageLabel.append(ageInput)
  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = 'Save'
  line.append(ageLabel, save)

  const statFields = document.createElement('div')
  statFields.className = 'sheet-stat-edit'
  const inputs = {}
  const values = character.characteristics || {}
  for (const [label, key] of [
    ['Str', 'str'],
    ['Dex', 'dex'],
    ['End', 'end'],
    ['Int', 'int'],
    ['Edu', 'edu'],
    ['Soc', 'soc']
  ]) {
    const field = document.createElement('label')
    field.textContent = label
    const input = document.createElement('input')
    input.name = key
    input.inputMode = 'numeric'
    input.autocomplete = 'off'
    input.value = values[key] == null ? '' : String(values[key])
    inputs[key] = input
    field.append(input)
    statFields.append(field)
  }

  save.addEventListener('click', () => {
    sendCharacterSheetPatch(
      { characterId: piece.characterId },
      {
        age: nullableNumberFromInput(ageInput),
        characteristics: {
          str: nullableNumberFromInput(inputs.str),
          dex: nullableNumberFromInput(inputs.dex),
          end: nullableNumberFromInput(inputs.end),
          int: nullableNumberFromInput(inputs.int),
          edu: nullableNumberFromInput(inputs.edu),
          soc: nullableNumberFromInput(inputs.soc)
        }
      }
    ).catch((error) => setError(error.message))
  })

  form.append(line, statFields)
  return form
}

const characterSkills = (character) => {
  if (character && Array.isArray(character.skills)) {
    return character.skills
      .filter((skill) => typeof skill === 'string' && skill.trim())
      .map((skill) => skill.trim())
  }
  if (character) return []
  return ['Vacc Suit-0', 'Gun Combat-0', 'Mechanic-0', 'Recon-0']
}

const skillListFromText = (value) =>
  value
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean)

const skillChips = (skills) => {
  const chips = document.createElement('div')
  chips.className = 'chip-list'
  for (const label of skills) {
    const chip = document.createElement('span')
    chip.textContent = label
    chips.append(chip)
  }
  return chips
}

const visibilityActions = (piece) => {
  const actions = document.createElement('div')
  actions.className = 'sheet-actions'
  for (const visibility of ['HIDDEN', 'PREVIEW', 'VISIBLE']) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent =
      visibility === 'HIDDEN' ? 'Hide' : visibility.toLowerCase()
    button.className = piece.visibility === visibility ? 'active' : ''
    button.addEventListener('click', () => {
      sendCommand({
        type: 'SetPieceVisibility',
        gameId: roomId,
        actorId,
        pieceId: piece.id,
        visibility
      }).catch((error) => setError(error.message))
    })
    actions.append(button)
  }
  return actions
}

const freedomActions = (piece) => {
  const actions = document.createElement('div')
  actions.className = 'sheet-actions'
  for (const freedom of ['LOCKED', 'UNLOCKED', 'SHARE']) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = freedom === 'LOCKED' ? 'Lock' : freedom.toLowerCase()
    button.className = piece.freedom === freedom ? 'active' : ''
    button.addEventListener('click', () => {
      sendCommand({
        type: 'SetPieceFreedom',
        gameId: roomId,
        actorId,
        pieceId: piece.id,
        freedom
      }).catch((error) => setError(error.message))
    })
    actions.append(button)
  }
  return actions
}

const skillEditor = (piece, character, skills) => {
  if (!piece?.characterId || !character) return null

  const form = document.createElement('div')
  form.className = 'sheet-skill-editor'
  const label = document.createElement('label')
  label.textContent = 'Skills'
  const textarea = document.createElement('textarea')
  textarea.value = skills.join('\n')
  textarea.placeholder = 'Vacc Suit-0\\nGun Combat-0'
  textarea.spellcheck = false
  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = 'Save skills'
  save.addEventListener('click', () => {
    sendCharacterSheetPatch(
      { characterId: piece.characterId },
      {
        skills: skillListFromText(textarea.value)
      }
    ).catch((error) => setError(error.message))
  })
  label.append(textarea)
  form.append(label, save)
  return form
}

const renderDetailsTab = (body, piece, character) => {
  if (!character) {
    body.append(
      sheetSectionTitle('Token'),
      sheetRow('Name', piece.name),
      sheetRow('Position', Math.round(piece.x) + ', ' + Math.round(piece.y)),
      sheetRow('Visibility', piece.visibility),
      visibilityActions(piece),
      sheetRow('Move', piece.freedom),
      freedomActions(piece),
      emptySheetText('No linked character sheet')
    )
    return
  }

  body.append(
    sheetSectionTitle('Profile'),
    sheetRow('Type', character?.type || 'PLAYER'),
    sheetRow('Age', character?.age == null ? '-' : String(character.age)),
    statStrip(character),
    sheetSectionTitle('Token'),
    sheetRow('Position', Math.round(piece.x) + ', ' + Math.round(piece.y)),
    sheetRow('Visibility', piece.visibility),
    visibilityActions(piece),
    sheetRow('Move', piece.freedom),
    freedomActions(piece),
    sheetSectionTitle('Edit'),
    editableDetailsForm(piece, character),
    sheetSectionTitle('Skills'),
    skillChips(characterSkills(character))
  )
}

const renderActionTab = (body, piece, character) => {
  const skills = characterSkills(character)
  if (skills.length === 0) {
    body.append(emptySheetText('No trained skills'))
    return
  }

  const actions = document.createElement('div')
  actions.className = 'sheet-skill-actions'
  const name = character?.name || piece.name
  body.append(sheetSectionTitle('Roll'))
  for (const skill of skills) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = skill
    button.addEventListener('click', () => {
      sendCommand({
        type: 'RollDice',
        gameId: roomId,
        actorId,
        expression: '2d6',
        reason: name + ': ' + skill
      }).catch((error) => setError(error.message))
    })
    actions.append(button)
  }
  const editor = skillEditor(piece, character, skills)
  if (editor) body.append(actions, sheetSectionTitle('Edit Skills'), editor)
  else body.append(actions)
}

const itemName = (item) => item?.Name || item?.name || 'Item'

const itemQuantity = (item) => item?.Quantity ?? item?.quantity ?? 1

const itemCarried = (item) => item?.Carried ?? item?.carried

const itemNotes = (item) => item?.notes || item?.Notes || ''

const equipmentText = (equipment) =>
  equipment
    .map((item) =>
      [itemName(item), itemQuantity(item), itemNotes(item)].join(' | ')
    )
    .join('\n')

const equipmentFromText = (value) =>
  value
    .split('\n')
    .map((line) => {
      const [name = '', quantity = '1', ...notes] = line
        .split('|')
        .map((part) => part.trim())
      if (!name) return null
      const parsedQuantity = Number.parseInt(quantity, 10)
      return {
        name,
        quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 1,
        notes: notes.join(' | ')
      }
    })
    .filter(Boolean)

const itemsEditor = (character, equipment) => {
  if (!character) return null

  const form = document.createElement('div')
  form.className = 'sheet-items-editor'
  const creditsLabel = document.createElement('label')
  creditsLabel.textContent = 'Credits'
  const creditsInput = document.createElement('input')
  creditsInput.name = 'credits'
  creditsInput.inputMode = 'numeric'
  creditsInput.autocomplete = 'off'
  creditsInput.value =
    character.credits == null ? '0' : String(character.credits)
  creditsLabel.append(creditsInput)

  const equipmentLabel = document.createElement('label')
  equipmentLabel.textContent = 'Equipment'
  const textarea = document.createElement('textarea')
  textarea.value = equipmentText(equipment)
  textarea.placeholder = 'Laser Pistol | 1 | 3D6\nMesh | 1 | AR 5'
  textarea.spellcheck = false
  equipmentLabel.append(textarea)

  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = 'Save items'
  save.addEventListener('click', () => {
    sendCharacterSheetPatch(
      { characterId: character.id },
      {
        credits: nullableNumberFromInput(creditsInput) ?? 0,
        equipment: equipmentFromText(textarea.value)
      }
    ).catch((error) => setError(error.message))
  })

  form.append(creditsLabel, equipmentLabel, save)
  return form
}

const renderItemsTab = (body, character) => {
  body.append(
    sheetSectionTitle('Resources'),
    sheetRow(
      'Credits',
      character?.credits == null ? '-' : String(character.credits)
    )
  )
  const equipment = Array.isArray(character?.equipment)
    ? character.equipment
    : []
  if (equipment.length === 0) {
    body.append(emptySheetText('No equipment listed'))
    const editor = itemsEditor(character, equipment)
    if (editor) body.append(sheetSectionTitle('Edit Items'), editor)
    return
  }

  const list = document.createElement('div')
  list.className = 'item-list'
  body.append(sheetSectionTitle('Equipment'))
  for (const item of equipment) {
    const row = document.createElement('div')
    row.className = 'item-row'
    const name = document.createElement('span')
    name.className = 'item-name'
    name.textContent = itemName(item)
    const meta = document.createElement('span')
    meta.className = 'item-meta'
    const carried = itemCarried(item)
    const notes = itemNotes(item)
    meta.textContent =
      'x' +
      itemQuantity(item) +
      (carried === undefined ? '' : carried ? ' carried' : ' stowed')
    row.append(name, meta)
    if (notes) {
      const note = document.createElement('span')
      note.className = 'item-note'
      note.textContent = notes
      row.append(note)
    }
    list.append(row)
  }
  const editor = itemsEditor(character, equipment)
  if (editor) body.append(list, sheetSectionTitle('Edit Items'), editor)
  else body.append(list)
}

const renderNotesTab = (body, piece, character) => {
  if (!piece?.characterId || !character) {
    body.append(
      sheetSectionTitle('Notes'),
      emptySheetText(character?.notes || 'No notes')
    )
    return
  }

  const form = document.createElement('div')
  form.className = 'sheet-notes-form'
  const textarea = document.createElement('textarea')
  textarea.value = character.notes || ''
  textarea.placeholder = 'No notes'
  textarea.spellcheck = true
  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = 'Save'
  save.addEventListener('click', () => {
    sendCharacterSheetPatch(
      { characterId: piece.characterId },
      {
        notes: textarea.value
      }
    ).catch((error) => setError(error.message))
  })
  form.append(textarea, save)
  body.append(
    sheetSectionTitle('Current Notes'),
    sheetNotePreview(character.notes),
    sheetSectionTitle('Edit Notes'),
    form
  )
}

const renderSheet = () => {
  const piece = selectedPiece()
  const character = selectedCharacter(piece)
  els.sheetName.textContent = character?.name || piece?.name || 'No piece'
  for (const tab of els.sheetTabs) {
    tab.classList.toggle('active', tab.dataset.sheetTab === activeSheetTab)
  }

  const body = document.createElement('div')
  body.className = 'sheet-grid'
  if (!piece) {
    body.append(sheetRow('Status', 'No active token'))
    body.append(sheetRow('Board', selectedBoard()?.name || 'None'))
    els.sheetBody.replaceChildren(body)
    return
  }

  if (activeSheetTab === 'action') renderActionTab(body, piece, character)
  else if (activeSheetTab === 'items') renderItemsTab(body, character)
  else if (activeSheetTab === 'notes') renderNotesTab(body, piece, character)
  else renderDetailsTab(body, piece, character)
  els.sheetBody.replaceChildren(body)
}

const renderRail = () => {
  const pieces = boardPieces()
  if (pieces.length === 0) {
    const empty = document.createElement('button')
    empty.className = 'rail-piece'
    empty.type = 'button'
    empty.disabled = true
    const score = document.createElement('span')
    score.className = 'rail-score'
    score.textContent = '-'
    const avatar = document.createElement('span')
    avatar.className = 'rail-avatar'
    avatar.textContent = '+'
    empty.append(score, avatar)
    els.initiativeRail.replaceChildren(empty)
    renderSheet()
    return
  }

  els.initiativeRail.replaceChildren(
    ...pieces.map((piece, index) => {
      const button = document.createElement('button')
      button.className =
        'rail-piece' + (piece.id === selectedPieceId ? ' selected' : '')
      button.type = 'button'
      button.title = piece.name
      const score = document.createElement('span')
      score.className = 'rail-score'
      score.textContent = String(Math.max(1, 7 - index))
      const avatar = document.createElement('span')
      avatar.className = 'rail-avatar'
      const imageUrl = pieceImageUrl(piece)
      if (imageUrl) {
        avatar.style.backgroundImage = cssUrl(imageUrl)
        avatar.style.backgroundSize = 'cover'
        avatar.style.backgroundPosition = 'center'
      } else {
        avatar.textContent = (piece.name || '?').slice(0, 1).toUpperCase()
      }
      button.append(score, avatar)
      button.addEventListener('click', () => {
        selectedPieceId = piece.id
        setSheetOpen(true)
        render()
      })
      return button
    })
  )
  renderSheet()
}

const renderBoardControls = () => {
  const boards = currentBoardList()
  const board = selectedBoard()
  els.boardStatus.textContent = boardStatusLabel(boards, board)

  const options = boards.map((candidate, index) => {
    const option = document.createElement('option')
    option.value = candidate.id
    option.textContent = boardOptionLabel(candidate, index)
    return option
  })
  els.boardSelect.replaceChildren(...options)
  els.boardSelect.value = board?.id || ''
  els.boardSelect.disabled = boards.length === 0 || !canSelectBoards
  els.boardSelect.title = boardSelectTitle(board, canSelectBoards)
  els.zoomOut.disabled = !board
  els.zoomReset.disabled = !board
  els.zoomIn.disabled = !board
  els.zoomReset.textContent = Math.round(boardCamera.zoom * 100) + '%'
}

const drawGrid = (board) => {
  const grid = Math.max(25, board.scale || 50)
  ctx.strokeStyle = 'rgba(238, 244, 241, 0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x <= board.width; x += grid) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, board.height)
    ctx.stroke()
  }
  for (let y = 0; y <= board.height; y += grid) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(board.width, y)
    ctx.stroke()
  }
}

const render = () => {
  const board = selectedBoard()
  if (board) ensureBoardCamera(board)
  renderBoardControls()
  const size = canvasCssSize()
  const dpr = window.devicePixelRatio || 1
  const cssWidth = size.width
  const cssHeight = size.height
  if (
    els.canvas.width !== cssWidth * dpr ||
    els.canvas.height !== cssHeight * dpr
  ) {
    els.canvas.width = cssWidth * dpr
    els.canvas.height = cssHeight * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  if (!board) {
    ctx.fillStyle = '#253130'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    ctx.fillStyle = '#a6b4af'
    ctx.font = '16px system-ui'
    ctx.fillText('Open or bootstrap a room from the menu', 24, 34)
    renderRail()
    return
  }

  const transform = boardTransform(board, cssWidth, cssHeight)
  ctx.fillStyle = '#253130'
  ctx.fillRect(0, 0, cssWidth, cssHeight)
  ctx.save()
  ctx.translate(transform.x, transform.y)
  ctx.scale(transform.scale, transform.scale)
  ctx.fillStyle = '#06100d'
  ctx.fillRect(0, 0, board.width, board.height)
  const boardImage = loadBoardImage(board)
  if (boardImage) {
    ctx.drawImage(boardImage, 0, 0, board.width, board.height)
  }
  drawGrid(board)

  for (const piece of boardPieces()) {
    const isSelected = piece.id === selectedPieceId
    const drawX =
      drag && drag.kind === 'piece' && drag.pieceId === piece.id
        ? drag.x
        : piece.x
    const drawY =
      drag && drag.kind === 'piece' && drag.pieceId === piece.id
        ? drag.y
        : piece.y
    const drawW = piece.width * piece.scale
    const drawH = piece.height * piece.scale
    const radius = Math.min(10, drawW / 3, drawH / 3)
    const image = loadPieceImage(piece)
    if (isSelected) {
      ctx.save()
      ctx.shadowColor = 'rgba(72, 255, 173, 0.88)'
      ctx.shadowBlur = 18 / transform.scale
      ctx.strokeStyle = 'rgba(72, 255, 173, 0.95)'
      ctx.lineWidth = 8 / transform.scale
      ctx.beginPath()
      ctx.roundRect(drawX - 4, drawY - 4, drawW + 8, drawH + 8, radius + 4)
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = piece.visibility === 'PREVIEW' ? '#f2b84b' : '#5fd0a2'
    ctx.strokeStyle = isSelected ? '#f7fff9' : '#0b1211'
    ctx.lineWidth = (isSelected ? 3 : 2) / transform.scale
    ctx.beginPath()
    ctx.roundRect(drawX, drawY, drawW, drawH, radius)
    ctx.fill()
    if (image) {
      ctx.save()
      ctx.clip()
      ctx.drawImage(image, drawX, drawY, drawW, drawH)
      ctx.restore()
    }
    ctx.stroke()
    if (isSelected) {
      const corner = Math.min(drawW, drawH, 12)
      ctx.strokeStyle = '#48ffad'
      ctx.lineWidth = 2 / transform.scale
      ctx.beginPath()
      ctx.moveTo(drawX, drawY + corner)
      ctx.lineTo(drawX, drawY)
      ctx.lineTo(drawX + corner, drawY)
      ctx.moveTo(drawX + drawW - corner, drawY)
      ctx.lineTo(drawX + drawW, drawY)
      ctx.lineTo(drawX + drawW, drawY + corner)
      ctx.moveTo(drawX + drawW, drawY + drawH - corner)
      ctx.lineTo(drawX + drawW, drawY + drawH)
      ctx.lineTo(drawX + drawW - corner, drawY + drawH)
      ctx.moveTo(drawX + corner, drawY + drawH)
      ctx.lineTo(drawX, drawY + drawH)
      ctx.lineTo(drawX, drawY + drawH - corner)
      ctx.stroke()
    }
    if (!image) {
      ctx.fillStyle = '#07100d'
      ctx.font = '700 13px system-ui'
      ctx.fillText(piece.name, drawX + 8, drawY + 22)
    }
  }
  ctx.restore()

  renderRail()
}

const animateRoll = (roll) => {
  diceHideTimer = animateDiceRoll({
    roll,
    overlay: els.diceOverlay,
    stage: els.diceStage,
    hideTimer: diceHideTimer
  })
}

els.canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  event.preventDefault()
  const screen = screenPoint(event)
  const board = selectedBoard()
  const size = canvasCssSize()
  const transform = board
    ? boardTransform(board, size.width, size.height)
    : null
  const point = board ? screenToBoard(screen, board, transform) : { x: 0, y: 0 }
  const piece = hitPiece(point, transform, event.pointerType)
  selectedPieceId = piece?.id || null
  if (piece) {
    drag = {
      kind: 'piece',
      pieceId: piece.id,
      offsetX: point.x - piece.x,
      offsetY: point.y - piece.y,
      startPointerX: screen.x,
      startPointerY: screen.y,
      moved: false,
      x: piece.x,
      y: piece.y,
      startX: piece.x,
      startY: piece.y
    }
  } else {
    drag = {
      kind: 'pan',
      pointerX: screen.x,
      pointerY: screen.y,
      startPointerX: screen.x,
      startPointerY: screen.y,
      moved: false,
      panX: boardCamera.panX,
      panY: boardCamera.panY
    }
  }
  els.canvas.setPointerCapture(event.pointerId)
  render()
})

els.canvas.addEventListener('pointermove', (event) => {
  if (!drag) return
  event.preventDefault()
  const screen = screenPoint(event)
  if (!drag.moved) {
    drag.moved =
      Math.hypot(
        screen.x - drag.startPointerX,
        screen.y - drag.startPointerY
      ) >= DRAG_START_SLOP_PX
  }
  if (drag.kind === 'pan') {
    boardCamera.panX = drag.panX + screen.x - drag.pointerX
    boardCamera.panY = drag.panY + screen.y - drag.pointerY
    render()
    return
  }
  const point = canvasPoint(event)
  const next = clampPiecePosition(
    state?.pieces?.[drag.pieceId] || { width: 0, height: 0, scale: 1 },
    point.x - drag.offsetX,
    point.y - drag.offsetY
  )
  drag.x = next.x
  drag.y = next.y
  render()
})

els.canvas.addEventListener('pointerup', async (event) => {
  if (!drag) return
  event.preventDefault()
  const completed = drag
  drag = null
  releaseCanvasPointer(event.pointerId)
  if (completed.kind !== 'piece' || !state || !completed.moved) {
    render()
    return
  }
  const x = Math.round(completed.x)
  const y = Math.round(completed.y)
  if (
    x === Math.round(completed.startX) &&
    y === Math.round(completed.startY)
  ) {
    render()
    return
  }
  try {
    await sendCommand({
      type: 'MovePiece',
      gameId: roomId,
      actorId,
      pieceId: completed.pieceId,
      x,
      y,
      expectedSeq: state.eventSeq
    })
  } catch (error) {
    setError(error.message)
  } finally {
    render()
  }
})

els.canvas.addEventListener('pointercancel', (event) => {
  drag = null
  releaseCanvasPointer(event.pointerId)
  render()
})

els.canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12
    setCameraZoom(boardCamera.zoom * zoomFactor, screenPoint(event))
  },
  { passive: false }
)

els.roomForm.addEventListener('submit', (event) => {
  event.preventDefault()
  roomId = els.roomInput.value.trim() || DEFAULT_GAME_ID
  actorId = els.userInput.value.trim() || DEFAULT_ACTOR_ID
  const nextUrl = new URL(location.href)
  nextUrl.searchParams.set('game', roomId)
  nextUrl.searchParams.set('user', actorId)
  history.replaceState(null, '', nextUrl)
  firstStateApplied = false
  latestDiceId = null
  selectedPieceId = null
  setSheetOpen(false)
  els.roomDialog.close()
  connectSocket()
  fetchState().catch((error) => setError(error.message))
})

els.menu.addEventListener('click', () => {
  els.roomDialog.showModal()
})

els.roomCancel.addEventListener('click', () => {
  els.roomDialog.close()
})

els.sheetButton.addEventListener('click', () => {
  if (!selectedPieceId && selectedPiece()) selectedPieceId = selectedPiece().id
  setSheetOpen(!sheetOpen)
  render()
})

els.sheetClose.addEventListener('click', () => {
  setSheetOpen(false)
})

for (const tab of els.sheetTabs) {
  tab.addEventListener('click', () => {
    activeSheetTab = tab.dataset.sheetTab || 'details'
    renderSheet()
  })
}

els.bootstrap.addEventListener('click', () => {
  bootstrapScene().catch((error) => setError(error.message))
})

els.refresh.addEventListener('click', () => {
  fetchState().catch((error) => setError(error.message))
})

els.createPiece.addEventListener('click', () => {
  createCustomPiece().catch((error) => setError(error.message))
})

els.pieceImageFileInput.addEventListener('change', () => {
  applyPieceFileDimensions().catch((error) => setError(error.message))
})

els.createBoard.addEventListener('click', () => {
  createCustomBoard().catch((error) => setError(error.message))
})

els.boardImageFileInput.addEventListener('change', () => {
  applyBoardFileDimensions().catch((error) => setError(error.message))
})

els.boardSelect.addEventListener('change', () => {
  const boardId = els.boardSelect.value
  if (!boardId || boardId === currentSelectedBoardId() || !canSelectBoards)
    return
  selectedPieceId = null
  drag = null
  sendCommand({
    type: 'SelectBoard',
    gameId: roomId,
    actorId,
    boardId
  }).catch((error) => {
    setError(error.message)
    render()
  })
})

els.zoomOut.addEventListener('click', () => {
  setCameraZoom(boardCamera.zoom / 1.25)
})

els.zoomReset.addEventListener('click', () => {
  resetBoardCamera()
  render()
})

els.zoomIn.addEventListener('click', () => {
  setCameraZoom(boardCamera.zoom * 1.25)
})

els.roll.addEventListener('click', () => {
  sendCommand({
    type: 'RollDice',
    gameId: roomId,
    actorId,
    expression: els.diceExpression.value.trim() || '2d6',
    reason: 'Table roll'
  }).catch((error) => setError(error.message))
})

window.addEventListener('resize', render)

connectSocket()
fetchState().catch((error) => setError(error.message))
