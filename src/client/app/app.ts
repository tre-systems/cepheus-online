import { asGameId, asUserId, type PieceId } from '../../shared/ids'
import type { LiveDiceRollRevealTarget } from '../../shared/live-activity'
import type { ServerMessage } from '../../shared/protocol'
import type {
  BoardState,
  CharacterState,
  DiceRollState,
  GameState,
  PieceState
} from '../../shared/state'
import { isActorRefereeOrOwner } from '../../shared/viewer.js'
import {
  selectedBoard as selectSelectedBoard,
  selectedBoardId as selectSelectedBoardId,
  selectedBoardPieces,
  pieceImageUrl
} from './board-view.js'
import { getAppElements, requireAppElements } from './app-elements.js'
import { createAppBootstrap } from './app-bootstrap.js'
import {
  createBoardController,
  type BoardController
} from './board-controller.js'
import { createCharacterCreationPanel } from './character-creation-panel.js'
import {
  createCharacterCreationCommandController,
  type CharacterCreationCommandController
} from './character-creation-command-controller.js'
import {
  createCharacterCreationController,
  type CharacterCreationController
} from './character-creation-controller.js'
import {
  createCreationActivityFeedController,
  creationActivityRevealDelayMs
} from './creation-activity-feed.js'
import { createCreationPresenceDock } from './creation-presence-dock.js'
import { createCharacterCreationHomeworldPublisher } from './character-creation-homeworld-publisher.js'
import { createCharacterCreationLifecycleController } from './character-creation-lifecycle-controller.js'
import { createCharacterCreationPublicationController } from './character-creation-publication-controller.js'
import {
  createCharacterCreationFinalizationController,
  type CharacterCreationFinalizationController
} from './character-creation-finalization-controller.js'
import {
  createCharacterCreationWizardController,
  type CharacterCreationWizardController
} from './character-creation-wizard-controller.js'
import { createCharacterCreationDomController } from './character-creation-dom-controller.js'
import type { CharacterCreationDraft } from './character-creation-flow.js'
import {
  createCharacterCreationRenderController,
  type CharacterCreationRenderController
} from './character-creation-render-controller.js'
import { cssUrl } from './image-assets.js'
import { createGameCommand, nextBootstrapCommand } from './bootstrap-flow.js'
import { fetchRoomState, postRoomCommand } from './room-api.js'
import {
  applyServerMessage as applyClientServerMessage,
  type ClientDiceRollActivity,
  type ClientIdentity,
  buildSetDoorOpenCommand
} from '../game-commands.js'
import { createAppSession } from './app-session.js'
import { resolveActorSessionSecret } from './actor-session.js'
import { createCharacterSheetWiring } from './character-sheet-wiring.js'
import { deriveDoorToggleViewModels } from './door-los-view.js'
import { createDiceOverlayWiring } from './dice-overlay-wiring.js'
import { createDiceRevealCoordinator } from './dice-reveal-coordinator.js'
import {
  DEFAULT_APP_LOCATION,
  isRefereeViewer,
  resolveAppLocationIdentity
} from './app-location.js'
import { createRoomConnectionController } from './room-connection-controller.js'
import { prepareLiveActivityApplication } from './live-activity-client.js'
import { createRequestIdFactory } from './request-id.js'
import { createRoomCommandDispatch } from './room-command-dispatch.js'
import { createRoomAssetCreationWiring } from './room-asset-creation-wiring.js'
import { createRoomMenuWiring } from './room-menu-wiring.js'
import { createAppShell, registerAppShellServiceWorker } from './app-shell.js'
import { createBoardControlsWiring } from './board-controls-wiring.js'
import { createAppRefreshWiring } from './app-refresh-wiring.js'
import { createDiceCommandWiring } from './dice-command-wiring.js'

registerAppShellServiceWorker()

const els = requireAppElements(getAppElements(document))

const initialIdentity = resolveAppLocationIdentity(location.search)
let roomId = initialIdentity.roomId
let actorId = initialIdentity.actorId
let actorSessionSecret = resolveActorSessionSecret({ roomId, actorId })
let state: GameState | null = null
const viewerRole = initialIdentity.viewerRole
const canSelectBoards = isRefereeViewer(viewerRole)
const appSession = createAppSession({ roomId, actorId, viewerRole })
let boardController: BoardController | null = null
let boardControlsWiring: ReturnType<typeof createBoardControlsWiring> | null =
  null
const diceRevealCoordinator = createDiceRevealCoordinator()
const animatedDiceRollActivityIds = new Set<string>()
let characterCreationController: CharacterCreationController
let characterCreationLifecycleController: ReturnType<
  typeof createCharacterCreationLifecycleController
>
let characterCreationFinalizationController: CharacterCreationFinalizationController
let characterCreationWizardController: CharacterCreationWizardController
let characterCreationRenderController: CharacterCreationRenderController
const setStatus = (text: string): void => {
  els.status.textContent = text
}

const setError = (text: string): void => {
  els.error.textContent = text || ''
}

createAppShell({ elements: els })

const requestId = createRequestIdFactory()

const clientIdentity = (): ClientIdentity => ({
  gameId: asGameId(roomId),
  actorId: asUserId(actorId)
})

const commandIdentity = () => ({
  gameId: asGameId(roomId),
  actorId: asUserId(actorId)
})

const bootstrapIdentity = () => ({
  roomId: asGameId(roomId),
  actorId: asUserId(actorId)
})

const currentSelectedPieceId = (): PieceId | null =>
  appSession.snapshot().selectedPieceId

const selectPiece = (pieceId: PieceId | null): void => {
  characterCreationController?.setSelectedCharacterId(null)
  appSession.selectPiece(pieceId)
}

const selectedCharacter = (): CharacterState | null => {
  const characterId = characterCreationController?.selectedCharacterId()
  return characterId ? (state?.characters[characterId] ?? null) : null
}

const handleServerMessage = (message: ServerMessage): void => {
  const application = applyClientServerMessage(state, message)
  const liveActivityApplication = prepareLiveActivityApplication(application, {
    animatedDiceRollActivityIds,
    revealedDiceIds: diceRevealCoordinator.revealedDiceIds
  })
  const deferredStateRolls = application.shouldApplyState
    ? diceRevealCoordinator.diceRollsForStateDeferral({
        nextState: application.state,
        diceRollActivities: liveActivityApplication.diceRollActivities
      })
    : []
  const sessionState = appSession.applyServerMessage(application)
  setError(sessionState.requestError || '')
  if (application.shouldApplyState) {
    if (deferredStateRolls.length > 0) {
      applyStateAfterDiceReveal(application.state, deferredStateRolls)
    } else {
      applyState(application.state, {
        animateLatestDiceLog: liveActivityApplication.animateLatestDiceLog,
        deferDiceRevealIds: liveActivityApplication.deferDiceRevealIds,
        deferFollowedCreationRolls: liveActivityApplication.diceRollActivities
      })
    }
  }
  creationActivityFeedController.show(
    application,
    creationActivityRevealDelayMs(liveActivityApplication.diceRollActivities)
  )
  for (const activity of liveActivityApplication.diceRollActivities) {
    animatedDiceRollActivityIds.add(activity.id)
    animateRoll(activity)
  }
  if (
    liveActivityApplication.diceRollActivities.length === 0 &&
    deferredStateRolls.length > 0
  ) {
    for (const roll of deferredStateRolls) {
      animateRoll(roll)
    }
  }
  if (sessionState.recovery.shouldReload) {
    fetchState()
      .catch((err) => {
        const nextSessionState = appSession.setRequestError(err.message)
        setError(nextSessionState.requestError || '')
      })
      .finally(() => {
        appSession.setRecoveryFlags({
          shouldReload: false,
          isRecovering: false
        })
      })
  }
}

const resolveDiceReveal = (rollId: string): void => {
  diceRevealCoordinator.markRevealed(rollId)
}

const waitForDiceReveal = (
  roll: LiveDiceRollRevealTarget | DiceRollState
): Promise<void> => {
  return diceRevealCoordinator.waitForReveal(roll)
}

const waitForDiceRevealOrDelay = (
  roll: LiveDiceRollRevealTarget | DiceRollState
): Promise<void> => {
  return diceRevealCoordinator.waitForRevealOrDelay(roll)
}

const applyStateAfterDiceReveal = (
  nextState: GameState | null,
  diceRollActivities: readonly (ClientDiceRollActivity | DiceRollState)[]
): void => {
  Promise.all(diceRollActivities.map((roll) => waitForDiceRevealOrDelay(roll)))
    .then(() => {
      const currentSeq = state?.eventSeq ?? -1
      const nextSeq = nextState?.eventSeq ?? -1
      if (nextSeq < currentSeq) return
      applyState(nextState, {
        animateLatestDiceLog: false
      })
    })
    .catch((error) => setError(error.message))
}

const commandDispatch = createRoomCommandDispatch({
  getEventSeq: () => state?.eventSeq ?? null,
  getRoomId: () => roomId,
  getActorSessionSecret: () => actorSessionSecret,
  createRequestId: requestId,
  handleServerMessage,
  postRoomCommand
})

const {
  router: commandRouter,
  postCommand,
  postBoardCommand,
  postDiceCommand,
  postDoorCommand,
  postSheetCommand,
  postCharacterCreationCommand,
  postCharacterCreationCommands
} = commandDispatch

const characterCreationPublicationController =
  createCharacterCreationPublicationController({
    getFlow: () => characterCreationController.flow(),
    getState: () => state,
    isReadOnly: () => characterCreationController.readOnly(),
    identity: clientIdentity,
    createGame: () =>
      postCommand(
        createGameCommand(bootstrapIdentity()),
        requestId('create-game-for-character-creation')
      ),
    postCharacterCreationCommands,
    reportError: setError
  })

const ensureCharacterCreationPublished = () =>
  characterCreationPublicationController.ensurePublished()

const characterCreationHomeworldPublisher =
  createCharacterCreationHomeworldPublisher({
    getState: () => state,
    isReadOnly: () => characterCreationController.readOnly(),
    commandIdentity,
    ensurePublished: ensureCharacterCreationPublished,
    postCharacterCreationCommand,
    requestId,
    setError
  })

let characterCreationCommandController: CharacterCreationCommandController

const fetchState = async (): Promise<void> => {
  const message = await fetchRoomState({ roomId, viewerRole, actorId })
  handleServerMessage(message)
}

const characterCreationSeed = (): Pick<
  CharacterCreationDraft,
  'name' | 'equipment' | 'credits' | 'notes'
> => ({
  name: '',
  equipment: [],
  credits: 0,
  notes: ''
})

const characterCreationPanel = createCharacterCreationPanel({
  elements: {
    panel: els.characterCreator,
    body: els.creatorBody,
    roomDialog: els.roomDialog,
    fallbackOverlayHost: document.querySelector('.app-shell'),
    title: els.characterCreatorTitle,
    startSection: els.creatorStartSection,
    quickSection: els.creatorQuickSection,
    startWizardButton: els.startCharacterWizard,
    wizard: els.characterCreationWizard,
    steps: els.characterCreationSteps,
    status: els.characterCreationStatus,
    fields: els.characterCreationFields,
    backWizardButton: els.backCharacterWizard,
    nextWizardButton: els.nextCharacterWizard,
    actions: els.creatorActions
  },
  closeCharacterSheet: () => characterSheetController.setOpen(false),
  requestRender: () => render()
})

const diceOverlayWiring = createDiceOverlayWiring({
  elements: {
    overlay: els.diceOverlay,
    stage: els.diceStage
  },
  panel: characterCreationPanel,
  resolveDiceReveal
})

const animateRoll = diceOverlayWiring.animateRoll

characterCreationController = createCharacterCreationController({
  getState: () => state,
  isPanelOpen: () => characterCreationPanel.isOpen(),
  closePanel: () => characterCreationPanel.close()
})

characterCreationLifecycleController =
  createCharacterCreationLifecycleController({
    controller: characterCreationController,
    panel: characterCreationPanel,
    closeCharacterSheet: () => characterSheetController.setOpen(false),
    renderWizard: () => renderCharacterCreationWizard(),
    waitForDiceReveal,
    reportError: setError
  })

characterCreationFinalizationController =
  createCharacterCreationFinalizationController({
    getFlow: () => characterCreationController.flow(),
    setFlow: (flow) => {
      characterCreationController.setFlow(flow)
    },
    getState: () => state,
    getSelectedBoard: () => selectedBoard(),
    getSelectedBoardPieces: () => boardPieces(),
    identity: clientIdentity,
    bootstrapIdentity,
    requestId,
    syncFields: () => syncCharacterCreationWizardFields(),
    reportError: setError,
    renderWizard: () => renderCharacterCreationWizard(),
    closePanel: () => characterCreationPanel.close(),
    openCharacterSheet: () => characterSheetController.setOpen(true),
    renderApp: () => render(),
    selectPiece,
    createGame: postCommand,
    createBoard: postBoardCommand,
    postCharacterCreationCommands,
    postBoardCommand
  })

const creationActivityFeedController = createCreationActivityFeedController({
  elements: { feed: els.creationActivityFeed },
  getViewerActorId: () => actorId,
  shouldSuppressCards: () =>
    characterCreationPanel.isOpen() && !characterCreationController.readOnly(),
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window)
})

const creationPresenceDock = createCreationPresenceDock({
  elements: {
    dock: els.creationPresenceDock,
    characterCreator: els.characterCreator,
    sheet: els.sheet
  },
  getRoomId: () => roomId,
  getActorId: () => actorId,
  openCharacterCreationFollow: characterCreationLifecycleController.openFollow,
  localStorage: window.localStorage
})

creationPresenceDock.hydrate()

characterCreationWizardController = createCharacterCreationWizardController({
  controller: characterCreationController,
  fieldsRoot: els.characterCreationFields,
  panel: characterCreationPanel,
  getState: () => state,
  getSeed: characterCreationSeed,
  currentProjection: () => characterCreationController.currentProjection(),
  homeworldPublisher: characterCreationHomeworldPublisher,
  selectPiece,
  closeCharacterSheet: () => characterSheetController.setOpen(false),
  ensurePublished: ensureCharacterCreationPublished,
  finish: () => characterCreationFinalizationController.finish(),
  renderWizard: () => renderCharacterCreationWizard(),
  setError
})

const startNewCharacterCreationWizard = () =>
  characterCreationWizardController.startNew()

const autoAdvanceCharacterCreationSetup = () =>
  characterCreationWizardController.autoAdvanceSetup()

const syncCharacterCreationWizardFields = () =>
  characterCreationWizardController.syncFields()

const renderCharacterCreationWizardControls = () =>
  characterCreationRenderController.renderWizardControls()

const renderCharacterCreationWizard = () =>
  characterCreationRenderController.renderWizard()

characterCreationRenderController = createCharacterCreationRenderController({
  document,
  elements: {
    backCharacterWizard: els.backCharacterWizard,
    nextCharacterWizard: els.nextCharacterWizard,
    creatorActions: els.creatorActions,
    characterCreationStatus: els.characterCreationStatus,
    characterCreationSteps: els.characterCreationSteps,
    characterCreationFields: els.characterCreationFields,
    characterCreationWizard: els.characterCreationWizard
  },
  controller: characterCreationController,
  panel: characterCreationPanel,
  wizard: characterCreationWizardController,
  homeworldPublisher: characterCreationHomeworldPublisher,
  getCommandController: () => characterCreationCommandController,
  ensurePublished: ensureCharacterCreationPublished,
  postCharacterCreationCommand,
  commandIdentity,
  reportError: setError
})

characterCreationCommandController = createCharacterCreationCommandController({
  getFlow: () => characterCreationController.flow(),
  setFlow: (flow) => {
    characterCreationController.setFlow(flow)
  },
  setError,
  isReadOnly: () => characterCreationController.readOnly(),
  syncFields: syncCharacterCreationWizardFields,
  getState: () => state,
  flushHomeworldProgress: () => characterCreationHomeworldPublisher.flush(),
  ensurePublished: ensureCharacterCreationPublished,
  postCharacterCreationCommand,
  commandIdentity,
  requestId,
  waitForDiceRevealOrDelay,
  syncFlowFromRoomState: characterCreationController.syncFlowFromRoomState,
  autoAdvanceSetup: autoAdvanceCharacterCreationSetup,
  renderWizard: renderCharacterCreationWizard,
  scrollToTop: () => characterCreationPanel.scrollToTop()
})

createCharacterCreationDomController({
  elements: {
    createCharacterRail: els.createCharacterRail,
    characterCreatorClose: els.characterCreatorClose,
    startCharacterWizard: els.startCharacterWizard,
    backCharacterWizard: els.backCharacterWizard,
    nextCharacterWizard: els.nextCharacterWizard,
    characterCreationFields: els.characterCreationFields
  },
  controller: characterCreationController,
  wizard: characterCreationWizardController,
  panel: characterCreationPanel,
  homeworldPublisher: characterCreationHomeworldPublisher,
  renderWizardControls: renderCharacterCreationWizardControls,
  renderWizard: renderCharacterCreationWizard,
  renderApp: () => render(),
  reportError: setError
})

const bootstrapScene = async () => {
  setError('')
  for (let i = 0; i < 10; i++) {
    const command = nextBootstrapCommand({ ...bootstrapIdentity(), state })
    if (!command) break
    await postCommand(command, 'bootstrap-' + i)
  }
  await fetchState()
}

const roomConnectionController = createRoomConnectionController({
  webSocketConstructor: WebSocket,
  getUrlInput: () => ({
    protocol: location.protocol,
    host: location.host,
    roomId,
    viewerRole,
    actorId,
    actorSessionSecret
  }),
  fetchState,
  onStatus: setStatus,
  onError: setError,
  onMessage: handleServerMessage
})

const connectSocket = () => {
  roomConnectionController.connect()
}

const applyState = (
  nextState: GameState | null,
  {
    animateLatestDiceLog = true,
    deferDiceRevealIds = new Set(),
    deferFollowedCreationRolls = []
  }: {
    animateLatestDiceLog?: boolean
    deferDiceRevealIds?: ReadonlySet<string>
    deferFollowedCreationRolls?: readonly ClientDiceRollActivity[]
  } = {}
): void => {
  const diceRevealApplication =
    diceRevealCoordinator.recordStateApplied(nextState)
  state = appSession.setAuthoritativeState(nextState).authoritativeState
  const creationRefreshPlan =
    characterCreationLifecycleController.planStateRefresh({
      deferFollowedCreationRolls
    })
  const latestRoll = state?.diceLog?.[state.diceLog.length - 1] || null
  render()
  creationRefreshPlan.renderAfterAppRender()
  if (
    latestRoll &&
    animateLatestDiceLog &&
    diceRevealApplication.wasFirstStateApplied &&
    latestRoll.id !== diceRevealApplication.previousDiceId
  ) {
    animateRoll(latestRoll)
  } else if (
    latestRoll &&
    latestRoll.id !== diceRevealApplication.previousDiceId &&
    !deferDiceRevealIds.has(latestRoll.id)
  ) {
    resolveDiceReveal(latestRoll.id)
  }
}

const selectedBoard = (): BoardState | null => {
  return selectSelectedBoard(state)
}

const boardPieces = (): PieceState[] => {
  return selectedBoardPieces(state)
}

const selectedPiece = (): PieceState | null => {
  return boardController?.selectedPiece() || null
}

const boardDoorActions = (board: BoardState | null): HTMLElement | null => {
  if (!board) return null
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
      postDoorCommand(
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

const characterSheetController = createCharacterSheetWiring({
  document,
  elements: els,
  getSelectedPiece: selectedPiece,
  getSelectedCharacter: selectedCharacter,
  getSelectedBoard: selectedBoard,
  getCharacterState: () => state,
  canEditSheetFields: () => isActorRefereeOrOwner(state, asUserId(actorId)),
  getBoardDoorActions: () => ({ actions: boardDoorActions(selectedBoard()) }),
  getClientIdentity: clientIdentity,
  getCommandIdentity: commandIdentity,
  postSheetCommand,
  postCharacterCreationCommand,
  reportError: setError
})

const renderSheet = () => characterSheetController.render()

const renderRail = () => {
  const pieces = boardPieces()
  if (pieces.length === 0) {
    const empty = document.createElement('button')
    empty.className = 'rail-piece rail-create-piece'
    empty.type = 'button'
    empty.title = 'Create traveller'
    empty.setAttribute('aria-label', 'Create traveller')
    const score = document.createElement('span')
    score.className = 'rail-score'
    score.textContent = '+'
    const avatar = document.createElement('span')
    avatar.className = 'rail-avatar'
    avatar.textContent = '+'
    empty.append(score, avatar)
    empty.addEventListener('click', () => {
      startNewCharacterCreationWizard().catch((error) =>
        setError(error.message)
      )
    })
    els.initiativeRail.replaceChildren(empty)
    renderSheet()
    return
  }

  els.initiativeRail.replaceChildren(
    ...pieces.map((piece, index) => {
      const selectedPieceId = currentSelectedPieceId()
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
        selectPiece(piece.id)
        characterSheetController.setOpen(true)
        render()
      })
      return button
    })
  )
  renderSheet()
}

const render = () => {
  boardControlsWiring?.render()
  boardController?.render()
  renderRail()
  creationPresenceDock.render(state)
}

const canvasContext = els.canvas.getContext('2d')
if (!canvasContext) throw new Error('2D canvas context unavailable')

boardController = createBoardController({
  canvas: els.canvas,
  context: canvasContext,
  getState: () => state,
  getIdentity: clientIdentity,
  getSelectedPieceId: currentSelectedPieceId,
  setSelectedPieceId: (pieceId) => {
    selectPiece(pieceId)
  },
  sendCommand: postBoardCommand,
  setError,
  requestRender: render
})

boardControlsWiring = createBoardControlsWiring({
  elements: els,
  getState: () => state,
  canSelectBoards,
  getSelectedBoardId: () => selectSelectedBoardId(state),
  getCurrentZoom: () => boardController?.currentZoom() || 1,
  setCameraZoom: (nextZoom) => {
    boardController?.setCameraZoom(nextZoom)
  },
  resetCamera: () => {
    boardController?.resetCamera()
  },
  clearBoardDrag: () => {
    boardController?.clearDrag()
  },
  selectPiece,
  getCommandIdentity: commandIdentity,
  postBoardCommand,
  requestRender: render,
  reportError: setError
})

createRoomMenuWiring({
  elements: els,
  initialRoomId: roomId,
  initialActorId: actorId,
  defaultRoomId: DEFAULT_APP_LOCATION.roomId,
  defaultActorId: DEFAULT_APP_LOCATION.actorId,
  onOpenRoomIdentity: (identity) => {
    roomId = identity.roomId
    actorId = identity.actorId
    actorSessionSecret = resolveActorSessionSecret({ roomId, actorId })
  },
  setAppSessionRoomIdentity: appSession.setRoomIdentity,
  resetDiceRevealTracking: () => diceRevealCoordinator.resetStateTracking(),
  clearSelectedCharacter: () =>
    characterCreationController.setSelectedCharacterId(null),
  clearCreationActivityFeed: () => creationActivityFeedController.clear(),
  hydrateCreationPresenceDock: () => creationPresenceDock.hydrate(),
  selectPiece,
  clearBoardDrag: () => boardController?.clearDrag(),
  closeCharacterSheet: () => characterSheetController.setOpen(false),
  connectSocket,
  fetchState,
  reportError: setError
})

createRoomAssetCreationWiring({
  elements: els,
  getState: () => state,
  getSelectedBoard: selectedBoard,
  getSelectedBoardPieces: boardPieces,
  getClientIdentity: clientIdentity,
  getBootstrapIdentity: bootstrapIdentity,
  createRequestId: requestId,
  postCommand,
  postBoardCommand,
  dispatchCommandsSequential: commandRouter.dispatchSequential,
  selectPiece,
  requestRender: render,
  reportError: setError
})

els.sheetButton.addEventListener('click', () => {
  const piece = selectedPiece()
  if (!currentSelectedPieceId() && piece) {
    selectPiece(piece.id)
  }
  if (!currentSelectedPieceId()) {
    characterCreationPanel.open()
    return
  }
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

createAppRefreshWiring({
  refreshButton: els.refresh,
  fetchState,
  reportError: setError
})

createDiceCommandWiring({
  rollButton: els.roll,
  diceExpression: els.diceExpression,
  getClientIdentity: clientIdentity,
  postDiceCommand,
  reportError: setError
})

window.addEventListener('resize', render)

createAppBootstrap({
  connectivityStatus: roomConnectionController.connectivitySnapshot().status,
  connect: connectSocket,
  fetchState,
  setStatus,
  setError
})
