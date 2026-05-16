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
  selectedBoardPieces
} from './board/view.js'
import { getAppElements, requireAppElements } from './core/elements.js'
import {
  createBoardController,
  type BoardController
} from './board/controller.js'
import {
  createCharacterCreationFeature,
  type CharacterCreationFeature
} from './character/creation/feature.js'
import { createCharacterRailController } from './character/rail/controller.js'
import { fetchRoomState, postRoomCommand } from './room/api.js'
import {
  applyServerMessage as applyClientServerMessage,
  type ClientDiceRollActivity,
  type ClientIdentity
} from '../game-commands.js'
import { createAppSession } from './core/session.js'
import { resolveActorSessionSecret } from './core/actor-session.js'
import { createCharacterSheetWiring } from './character/sheet/wiring.js'
import { createDiceRevealCoordinator } from './dice/reveal-coordinator.js'
import {
  DEFAULT_APP_LOCATION,
  isRefereeViewer,
  resolveAppLocationIdentity
} from './core/location.js'
import { createRoomConnectionController } from './room/connection.js'
import { prepareLiveActivityApplication } from './activity/client.js'
import { createRequestIdFactory } from './core/request-id.js'
import { createRoomCommandDispatch } from './room/command-dispatch.js'
import { createRoomAssetCreationWiring } from './room/assets/wiring.js'
import { createRoomMenuWiring } from './room/menu/wiring.js'
import { createAppShell, registerAppShellServiceWorker } from './core/shell.js'
import { createBoardControlsWiring } from './board/controls-wiring.js'
import { createAppRefreshWiring } from './core/refresh.js'
import { createDiceCommandWiring } from './dice/commands.js'
import { createAppLifecycleWiring } from './core/lifecycle.js'
import { createCharacterSheetControlsWiring } from './character/sheet/controls-wiring.js'
import { createRoomBootstrapScene } from './room/bootstrap-scene.js'
import { createBoardDoorActions } from './board/doors.js'

const els = requireAppElements(getAppElements(document))
const appShell = createAppShell({ elements: els })
const serviceWorkerController = registerAppShellServiceWorker({
  onUpdateStateChange: (updateState) => {
    appShell.pwaUpdate.render(updateState)
  }
})
appShell.pwaUpdate.setServiceWorker(serviceWorkerController)

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
let diceRevealRefetchTimer: number | null = null
let characterCreationFeature: CharacterCreationFeature
const setStatus = (text: string): void => {
  els.status.textContent = text
}

const setError = (text: string): void => {
  els.error.textContent = text || ''
}

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
  characterCreationFeature?.clearSelectedCharacter()
  appSession.selectPiece(pieceId)
}

const selectedCharacter = (): CharacterState | null => {
  const characterId = characterCreationFeature?.selectedCharacterId()
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
  characterCreationFeature.showActivity(
    application,
    liveActivityApplication.diceRollActivities
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
  refetchStateSoon()
}

const waitForDiceReveal = (
  roll: ClientDiceRollActivity | LiveDiceRollRevealTarget | DiceRollState
): Promise<void> => {
  return diceRevealCoordinator.waitForReveal(roll)
}

const waitForDiceRevealOrDelay = (
  roll: ClientDiceRollActivity | LiveDiceRollRevealTarget | DiceRollState
): Promise<void> => {
  return diceRevealCoordinator.waitForRevealOrDelay(roll)
}

const stateHasRedactedDiceResults = (nextState: GameState | null): boolean =>
  Boolean(
    nextState?.diceLog.some((roll) => {
      const projectedRoll = roll as unknown as Record<string, unknown>
      return (
        !Array.isArray(projectedRoll.rolls) || projectedRoll.total === undefined
      )
    })
  )

const activityHasRedactedDiceResults = (
  activity: ClientDiceRollActivity | DiceRollState
): boolean => {
  const projectedActivity = activity as unknown as Record<string, unknown>

  return (
    !Array.isArray(projectedActivity.rolls) ||
    projectedActivity.total === undefined
  )
}

const refetchStateSoon = (): void => {
  if (diceRevealRefetchTimer !== null) {
    window.clearTimeout(diceRevealRefetchTimer)
  }
  diceRevealRefetchTimer = window.setTimeout(() => {
    diceRevealRefetchTimer = null
    void fetchState()
  }, 120)
}

const shouldRefetchStateAfterDiceReveal = (
  nextState: GameState | null,
  diceRollActivities: readonly (ClientDiceRollActivity | DiceRollState)[]
): boolean => {
  if (!nextState || diceRollActivities.length === 0) return false

  return (
    stateHasRedactedDiceResults(nextState) ||
    diceRollActivities.some(activityHasRedactedDiceResults)
  )
}

const applyStateAfterDiceReveal = (
  nextState: GameState | null,
  diceRollActivities: readonly (ClientDiceRollActivity | DiceRollState)[]
): void => {
  Promise.all(diceRollActivities.map((roll) => waitForDiceRevealOrDelay(roll)))
    .then(() => {
      if (shouldRefetchStateAfterDiceReveal(nextState, diceRollActivities)) {
        void fetchState()
        return
      }
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

const fetchState = async (): Promise<void> => {
  const message = await fetchRoomState({ roomId, viewerRole, actorId })
  handleServerMessage(message)
  if (message.type === 'roomState') {
    characterCreationFeature.renderPresence(message.state)
  }
}

const roomBootstrapScene = createRoomBootstrapScene({
  getIdentity: bootstrapIdentity,
  getState: () => state,
  postCommand,
  fetchState,
  clearError: () => setError('')
})

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
  const creationRefreshPlan = characterCreationFeature.planStateRefresh({
    deferFollowedCreationRolls
  })
  const latestRoll = state?.diceLog?.[state.diceLog.length - 1] || null
  render()
  creationRefreshPlan.renderAfterAppRender()
  if (
    latestRoll &&
    animateLatestDiceLog &&
    diceRevealApplication.wasFirstStateApplied &&
    latestRoll.id !== diceRevealApplication.previousDiceId &&
    !diceRevealCoordinator.revealedDiceIds.has(latestRoll.id)
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

const boardDoorActions = createBoardDoorActions({
  document,
  identity: clientIdentity,
  getState: () => state,
  dispatch: postDoorCommand,
  reportError: setError
})

const characterSheetController = createCharacterSheetWiring({
  document,
  elements: els,
  getSelectedPiece: selectedPiece,
  getSelectedCharacter: selectedCharacter,
  getSelectedBoard: selectedBoard,
  getCharacterState: () => state,
  canEditSheetFields: () => isActorRefereeOrOwner(state, asUserId(actorId)),
  getBoardDoorActions: () => ({
    actions: boardDoorActions.render(selectedBoard())
  }),
  getClientIdentity: clientIdentity,
  getCommandIdentity: commandIdentity,
  postSheetCommand,
  postCharacterCreationCommand,
  reportError: setError
})

characterCreationFeature = createCharacterCreationFeature({
  document,
  elements: els,
  getState: () => state,
  getActorId: () => actorId,
  getRoomId: () => roomId,
  identity: clientIdentity,
  commandIdentity,
  bootstrapIdentity,
  requestId,
  getSelectedBoard: selectedBoard,
  getSelectedBoardPieces: boardPieces,
  selectPiece,
  closeCharacterSheet: () => characterSheetController.setOpen(false),
  openCharacterSheet: () => characterSheetController.setOpen(true),
  renderApp: () => render(),
  createGame: postCommand,
  postBoardCommand,
  postCharacterCreationCommand,
  postCharacterCreationCommands,
  waitForDiceReveal,
  waitForDiceRevealOrDelay,
  refreshStateAfterDiceReveal: fetchState,
  resolveDiceReveal,
  reportError: setError
})

const animateRoll = characterCreationFeature.animateRoll

const renderSheet = () => characterSheetController.render()

const characterRailController = createCharacterRailController({
  document,
  rail: els.initiativeRail,
  getPieces: boardPieces,
  getSelectedPieceId: currentSelectedPieceId,
  selectPiece,
  openCharacterSheet: () => characterSheetController.setOpen(true),
  startCharacterCreation: characterCreationFeature.startNew,
  renderSheet,
  requestRender: () => render(),
  reportError: setError
})

const render = () => {
  boardControlsWiring?.render()
  boardController?.render()
  characterRailController.render()
  characterCreationFeature.renderPresence(state)
}

const canvasContext = els.canvas.getContext('2d')
if (!canvasContext) throw new Error('2D canvas context unavailable')

boardController = createBoardController({
  canvas: els.canvas,
  context: canvasContext,
  getState: () => state,
  getIdentity: clientIdentity,
  getSelectedPieceId: currentSelectedPieceId,
  getCanSeeAllPieces: () => isActorRefereeOrOwner(state, asUserId(actorId)),
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
  clearSelectedCharacter: characterCreationFeature.clearSelectedCharacter,
  clearCreationActivityFeed: characterCreationFeature.clearActivityFeed,
  hydrateCreationPresenceDock: characterCreationFeature.hydratePresence,
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
  reportError: setError,
  getCanPickLocalAssets: () =>
    !state || isActorRefereeOrOwner(state, asUserId(actorId))
})

createCharacterSheetControlsWiring({
  elements: els,
  controller: characterSheetController,
  getCurrentSelectedPieceId: currentSelectedPieceId,
  getSelectedPiece: selectedPiece,
  selectPiece,
  openCharacterCreationPanel: characterCreationFeature.openPanel,
  requestRender: render
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

createAppLifecycleWiring({
  windowTarget: window,
  bootstrapButton: els.bootstrap,
  render,
  bootstrapScene: roomBootstrapScene.run,
  reportError: setError,
  appBootstrap: {
    connectivityStatus: roomConnectionController.connectivitySnapshot().status,
    connect: connectSocket,
    fetchState,
    setStatus,
    setError
  }
})
