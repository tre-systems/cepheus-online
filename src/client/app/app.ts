// @ts-nocheck

import {
  boardList,
  boardOptionLabel,
  boardSelectTitle,
  boardStatusLabel,
  selectedBoard as selectSelectedBoard,
  selectedBoardId as selectSelectedBoardId,
  selectedBoardPieces,
  pieceImageUrl
} from './board-view.js'
import { createBoardController } from './board-controller.js'
import {
  cssUrl,
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
  uniqueBoardId
} from './bootstrap-flow.js'
import {
  buildRoomPath,
  buildViewerQuery,
  fetchRoomState,
  postRoomCommand
} from './room-api.js'
import {
  applyServerMessage as applyClientServerMessage,
  buildRollDiceCommand,
  buildSequencedCommand,
  buildSetDoorOpenCommand
} from '../game-commands.js'
import { createCharacterSheetController } from './character-sheet-controller.js'
import { deriveDoorToggleViewModels } from './door-los-view.js'
import { animateRoll as animateDiceRoll } from './dice-overlay.js'
import { planCreatePieceCommands } from './piece-command-plan.js'
import { createPwaInstallController } from './pwa-install.js'
import { createRoomMenuController } from './room-menu-controller.js'
import { registerClientServiceWorker } from './service-worker.js'

const DEFAULT_GAME_ID = 'demo-room'
const DEFAULT_ACTOR_ID = 'local-user'

const qs = new URLSearchParams(location.search)
registerClientServiceWorker()

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

let roomId = qs.get('game') || DEFAULT_GAME_ID
let actorId = qs.get('user') || DEFAULT_ACTOR_ID
let state = null
let socket = null
let firstStateApplied = false
let latestDiceId = null
const viewerRole = qs.get('viewer') || 'referee'
const canSelectBoards = viewerRole.toLowerCase() === 'referee'
let selectedPieceId = null
let boardController = null
let requestCounter = 0
let diceHideTimer = null

const setStatus = (text) => {
  els.status.textContent = text
}

const setError = (text) => {
  els.error.textContent = text || ''
}

createPwaInstallController({
  elements: {
    prompt: els.pwaInstallPrompt,
    installButton: els.pwaInstallButton,
    dismissButton: els.pwaInstallDismissButton
  }
})

const requestId = (prefix) =>
  prefix + '-' + Date.now().toString(36) + '-' + (++requestCounter).toString(36)

const clientIdentity = () => ({
  gameId: roomId,
  actorId
})

const handleServerMessage = (message) => {
  const application = applyClientServerMessage(state, message)
  setError(application.error || '')
  if (application.shouldApplyState) {
    applyState(application.state)
  }
  if (application.shouldReload) {
    fetchState().catch((err) => setError(err.message))
  }
}

const postCommand = async (command, id = requestId(command.type)) => {
  const sequencedCommand = buildSequencedCommand(command, state)
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
  const imageAssetId = await selectedPieceImageDataUrl()
  const plan = planCreatePieceCommands({
    identity: clientIdentity(),
    state,
    board,
    name,
    imageAssetId,
    width,
    height,
    scale,
    existingPieceCount: boardPieces().length,
    withCharacterSheet: els.pieceSheetInput.checked
  })
  if (!plan.ok) {
    setError(plan.error)
    if (plan.focus === 'name') els.pieceNameInput.focus()
    return
  }
  for (const command of plan.commands) {
    await postCommand(command)
  }
  selectedPieceId = plan.pieceId
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
  for (let i = 0; i < 10; i++) {
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

const selectedPiece = () => {
  return boardController?.selectedPiece() || null
}

const boardDoorActions = (board) => {
  const doors = deriveDoorToggleViewModels(board)
  if (doors.length === 0) return null

  const actions = document.createElement('div')
  actions.className = 'sheet-actions'
  for (const door of doors) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = door.toggleLabel
    button.className = door.open ? 'active' : ''
    button.title = `${door.label}: ${door.stateLabel}`
    button.addEventListener('click', () => {
      if (!state) return
      sendCommand(
        buildSetDoorOpenCommand({
          identity: clientIdentity(),
          state,
          boardId: board.id,
          doorId: door.id,
          open: door.nextOpen
        })
      ).catch((error) => setError(error.message))
    })
    actions.append(button)
  }
  return actions
}

const characterSheetController = createCharacterSheetController({
  elements: {
    sheet: els.sheet,
    sheetName: els.sheetName,
    sheetBody: els.sheetBody,
    sheetTabs: els.sheetTabs
  },
  getSelectedPiece: selectedPiece,
  getSelectedBoard: selectedBoard,
  getCharacterState: () => state,
  getBoardDoorActions: () => ({ actions: boardDoorActions(selectedBoard()) }),
  sendPatch: (characterId, patch) =>
    sendCommand({
      type: 'UpdateCharacterSheet',
      gameId: roomId,
      actorId,
      characterId,
      ...patch
    }),
  setVisibility: (piece, visibility) =>
    sendCommand({
      type: 'SetPieceVisibility',
      gameId: roomId,
      actorId,
      pieceId: piece.id,
      visibility
    }),
  setFreedom: (piece, freedom) =>
    sendCommand({
      type: 'SetPieceFreedom',
      gameId: roomId,
      actorId,
      pieceId: piece.id,
      freedom
    }),
  rollSkill: (_piece, _character, _skill, reason) =>
    sendCommand(
      buildRollDiceCommand({
        identity: clientIdentity(),
        expression: '2d6',
        reason
      })
    ),
  reportError: (message) => setError(message)
})

const renderSheet = () => characterSheetController.render()

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
        characterSheetController.setOpen(true)
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
  els.zoomReset.textContent =
    Math.round((boardController?.currentZoom() || 1) * 100) + '%'
}

const render = () => {
  renderBoardControls()
  boardController?.render()
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

boardController = createBoardController({
  canvas: els.canvas,
  context: els.canvas.getContext('2d'),
  getState: () => state,
  getIdentity: clientIdentity,
  getSelectedPieceId: () => selectedPieceId,
  setSelectedPieceId: (pieceId) => {
    selectedPieceId = pieceId
  },
  sendCommand,
  setError,
  requestRender: render
})

createRoomMenuController({
  elements: {
    roomForm: els.roomForm,
    roomInput: els.roomInput,
    userInput: els.userInput,
    menuButton: els.menu,
    roomDialog: els.roomDialog,
    roomCancelButton: els.roomCancel
  },
  initialRoomId: roomId,
  initialActorId: actorId,
  defaultRoomId: DEFAULT_GAME_ID,
  defaultActorId: DEFAULT_ACTOR_ID,
  onOpenRoom: (identity) => {
    roomId = identity.roomId
    actorId = identity.actorId
    firstStateApplied = false
    latestDiceId = null
    selectedPieceId = null
    boardController?.clearDrag()
    characterSheetController.setOpen(false)
    connectSocket()
    fetchState().catch((error) => setError(error.message))
  }
})

els.sheetButton.addEventListener('click', () => {
  if (!selectedPieceId && selectedPiece()) selectedPieceId = selectedPiece().id
  characterSheetController.toggleOpen()
  render()
})

els.sheetClose.addEventListener('click', () => {
  characterSheetController.setOpen(false)
})

for (const tab of els.sheetTabs) {
  tab.addEventListener('click', () => {
    characterSheetController.selectTab(tab.dataset.sheetTab)
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
  boardController?.clearDrag()
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
  boardController?.setCameraZoom(boardController.currentZoom() / 1.25)
})

els.zoomReset.addEventListener('click', () => {
  boardController?.resetCamera()
  render()
})

els.zoomIn.addEventListener('click', () => {
  boardController?.setCameraZoom(boardController.currentZoom() * 1.25)
})

els.roll.addEventListener('click', () => {
  sendCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: els.diceExpression.value.trim() || '2d6',
      reason: 'Table roll'
    })
  ).catch((error) => setError(error.message))
})

window.addEventListener('resize', render)

connectSocket()
fetchState().catch((error) => setError(error.message))
