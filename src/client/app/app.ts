import {
  asBoardId,
  asCharacterId,
  asGameId,
  asUserId,
  type PieceId
} from '../../shared/ids'
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
  boardList,
  boardOptionLabel,
  boardSelectTitle,
  boardStatusLabel,
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
import { renderCharacterCreationCharacteristicGrid as renderCharacterCreationCharacteristicGridView } from './character-creation-characteristics-view.js'
import {
  renderCharacterCreationAgingChoices as renderCharacterCreationAgingChoicesView,
  renderCharacterCreationAgingRollButton as renderCharacterCreationAgingRollButtonView,
  renderCharacterCreationAnagathicsDecision as renderCharacterCreationAnagathicsDecisionView,
  renderCharacterCreationReenlistmentRollButton as renderCharacterCreationReenlistmentRollButtonView,
  renderCharacterCreationTermSkillTables as renderCharacterCreationTermSkillTablesView
} from './character-creation-career-support-view.js'
import {
  renderCharacterCreationCareerPicker as renderCharacterCreationCareerPickerView,
  renderCharacterCreationCareerRollButton as renderCharacterCreationCareerRollButtonView
} from './character-creation-career-selection-view.js'
import {
  renderCharacterCreationHomeworld as renderCharacterCreationHomeworldView,
  renderCharacterCreationTermCascadeChoices as renderCharacterCreationTermCascadeChoicesView
} from './character-creation-homeworld-view.js'
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
import { renderCharacterCreationMusteringOut as renderCharacterCreationMusteringOutView } from './character-creation-mustering-view.js'
import { createCharacterCreationLifecycleController } from './character-creation-lifecycle-controller.js'
import { createCharacterCreationPublicationController } from './character-creation-publication-controller.js'
import {
  createCharacterCreationFinalizationController,
  type CharacterCreationFinalizationController
} from './character-creation-finalization-controller.js'
import { renderCharacterCreationTermResolution as renderCharacterCreationTermResolutionView } from './character-creation-term-resolution-view.js'
import {
  createCharacterCreationWizardController,
  type CharacterCreationWizardController
} from './character-creation-wizard-controller.js'
import { createCharacterCreationDomController } from './character-creation-dom-controller.js'
import { deriveCharacterCreationActionPlan } from './character-creation-actions.js'
import {
  applyCharacterCreationBackgroundSkillSelection,
  applyParsedCharacterCreationDraftPatch,
  completeCharacterCreationCareerTerm,
  removeCharacterCreationBackgroundSkillSelection,
  resolveCharacterCreationCascadeSkill,
  resolveCharacterCreationTermCascadeSkill,
  type CharacterCreationDraft,
  type CharacterCreationFlow
} from './character-creation-flow.js'
import {
  renderCharacterCreationBasicTrainingButton as renderCharacterCreationBasicTrainingButtonView,
  renderCharacterCreationCharacteristicRollButton as renderCharacterCreationCharacteristicRollButtonView,
  renderCharacterCreationDeath as renderCharacterCreationDeathView,
  renderCharacterCreationDraftFields as renderCharacterCreationDraftFieldsView,
  renderCharacterCreationNextStep as renderCharacterCreationNextStepView
} from './character-creation-renderer.js'
import {
  renderCharacterCreationReview as renderCharacterCreationReviewView,
  renderCharacterCreationTermHistory as renderCharacterCreationTermHistoryView
} from './character-creation-review-view.js'
import { cssUrl } from './image-assets.js'
import { createGameCommand, nextBootstrapCommand } from './bootstrap-flow.js'
import { fetchRoomState, postRoomCommand } from './room-api.js'
import {
  applyServerMessage as applyClientServerMessage,
  buildRollDiceCommand,
  type ClientDiceRollActivity,
  type ClientIdentity,
  buildSetDoorOpenCommand
} from '../game-commands.js'
import type {
  BoardCommand,
  CharacterCreationCommand,
  DiceCommand
} from './app-command-router.js'
import { createAppSession } from './app-session.js'
import { resolveActorSessionSecret } from './actor-session.js'
import { createCharacterSheetController } from './character-sheet-controller.js'
import {
  createConnectivityController,
  type ConnectivityController
} from './connectivity-controller.js'
import { deriveDoorToggleViewModels } from './door-los-view.js'
import { animateRoll as animateDiceRoll } from './dice-overlay.js'
import { createDiceRevealCoordinator } from './dice-reveal-coordinator.js'
import { createRoomSocketController } from './room-socket-controller.js'
import {
  DEFAULT_APP_LOCATION,
  buildRoomWebSocketUrl,
  isRefereeViewer,
  resolveAppLocationIdentity
} from './app-location.js'
import { prepareLiveActivityApplication } from './live-activity-client.js'
import { createPwaInstallController } from './pwa-install.js'
import { createRequestIdFactory } from './request-id.js'
import { createRoomMenuController } from './room-menu-controller.js'
import { createRoomCommandDispatch } from './room-command-dispatch.js'
import { createRoomAssetCreationController } from './room-asset-creation-controller.js'
import { registerClientServiceWorker } from './service-worker.js'

registerClientServiceWorker()

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
let diceHideTimer: number | null = null
let connectivityController: ConnectivityController | null = null
const diceRevealCoordinator = createDiceRevealCoordinator()
const animatedDiceRollActivityIds = new Set<string>()
let characterCreationController: CharacterCreationController
let characterCreationLifecycleController: ReturnType<
  typeof createCharacterCreationLifecycleController
>
let characterCreationFinalizationController: CharacterCreationFinalizationController
let characterCreationWizardController: CharacterCreationWizardController
const setStatus = (text: string): void => {
  els.status.textContent = text
}

const setError = (text: string): void => {
  els.error.textContent = text || ''
}

createPwaInstallController({
  elements: {
    prompt: els.pwaInstallPrompt,
    installButton: els.pwaInstallButton,
    dismissButton: els.pwaInstallDismissButton
  }
})

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

const renderCharacterCreationWizardControls = () => {
  els.backCharacterWizard.disabled = true
  els.nextCharacterWizard.disabled = true
  els.backCharacterWizard.hidden = true
  els.nextCharacterWizard.hidden = true
  if (els.creatorActions) els.creatorActions.hidden = true

  els.characterCreationStatus.replaceChildren()
}

const renderCharacterCreationWizard = () => {
  characterCreationController.reconcileEditableWithProjection(
    characterCreationController.currentProjection()
  )
  while (autoAdvanceCharacterCreationSetup()) {
    // Keep setup steps linear even when reopening a flow that is already valid.
  }

  const flow = characterCreationController.flow()
  if (!characterCreationPanel.render(flow) || !flow) return
  els.characterCreationSteps.replaceChildren()
  els.characterCreationFields.replaceChildren(
    renderCharacterCreationNextStep(flow),
    flow.step === 'review'
      ? renderCharacterCreationReview(flow)
      : renderCharacterCreationFields(flow)
  )
  els.characterCreationWizard.hidden = false
  els.characterCreationWizard.classList.toggle(
    'read-only',
    characterCreationController.readOnly()
  )
  if (characterCreationController.readOnly()) {
    for (const control of Array.from(
      els.characterCreationFields.querySelectorAll<
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
      >('button, input, select, textarea')
    )) {
      control.disabled = true
    }
  }
  renderCharacterCreationWizardControls()
}

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

const renderCharacterCreationNextStep = (
  flow: CharacterCreationFlow
): HTMLElement => {
  return renderCharacterCreationNextStepView(document, flow, {
    advanceStep: advanceCharacterCreationWizard,
    reportError: setError,
    resolveBackgroundCascadeSkill: ({ scope, cascadeSkill, selection }) => {
      resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
    }
  })
}

const renderCharacterCreationFields = (
  flow: CharacterCreationFlow
): DocumentFragment => {
  const fragment = document.createDocumentFragment()
  if (flow.step === 'characteristics') {
    fragment.append(renderCharacterCreationCharacteristicGrid(flow))
    return fragment
  }
  if (flow.step === 'career') {
    const death = renderCharacterCreationDeath(flow)
    if (death) {
      fragment.append(death)
      return fragment
    }
    const careerRollButton = renderCharacterCreationCareerRollButton(flow)
    if (careerRollButton) fragment.append(careerRollButton)
    fragment.append(renderCharacterCreationAnagathicsDecision(flow))
    const agingRollButton = renderCharacterCreationAgingRollButton(flow)
    if (agingRollButton) fragment.append(agingRollButton)
    fragment.append(renderCharacterCreationAgingChoices(flow))
    const reenlistmentRollButton =
      renderCharacterCreationReenlistmentRollButton(flow)
    if (reenlistmentRollButton) fragment.append(reenlistmentRollButton)
    fragment.append(renderCharacterCreationTermSkillTables(flow))
    fragment.append(renderCharacterCreationTermCascadeChoices(flow))
    fragment.append(renderCharacterCreationCareerPicker(flow))
    fragment.append(renderCharacterCreationTermResolution(flow))
    fragment.append(renderCharacterCreationTermHistory(flow))
    return fragment
  }
  if (flow.step === 'homeworld') {
    fragment.append(renderCharacterCreationHomeworld(flow))
    return fragment
  }
  fragment.append(
    renderCharacterCreationDraftFieldsView(document, flow, {
      renderCharacteristicRollButton:
        renderCharacterCreationCharacteristicRollButton,
      renderCareerRollButton: renderCharacterCreationCareerRollButton,
      renderBasicTrainingButton: renderCharacterCreationBasicTrainingButton,
      renderMusteringOut: renderCharacterCreationMusteringOut
    })
  )
  return fragment
}

const renderCharacterCreationDeath = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  return renderCharacterCreationDeathView(document, flow, {
    readOnly: () => characterCreationController.readOnly(),
    startNewCharacter: startNewCharacterCreationWizard,
    reportError: setError
  })
}

const renderCharacterCreationHomeworld = (
  flow: CharacterCreationFlow
): HTMLElement => {
  return renderCharacterCreationHomeworldView(document, flow, {
    toggleBackgroundSkill: ({ label, selected, cascade }) => {
      const flow = characterCreationController.flow()
      if (!flow) return
      syncCharacterCreationWizardFields()
      const syncedFlow = characterCreationController.flow()
      if (!syncedFlow) return
      const nextFlow = {
        ...syncedFlow,
        draft: selected
          ? removeCharacterCreationBackgroundSkillSelection(
              syncedFlow.draft,
              label
            )
          : applyCharacterCreationBackgroundSkillSelection(
              syncedFlow.draft,
              label
            )
      }
      characterCreationController.setFlow(nextFlow)
      setError('')
      renderCharacterCreationWizard()
      if (!selected) {
        if (cascade) {
          characterCreationHomeworldPublisher.publishBackgroundCascadeSelection(
            nextFlow,
            label
          )
        } else {
          characterCreationHomeworldPublisher.publishProgress(nextFlow)
        }
      }
    },
    resolveCascadeSkill: ({ scope, cascadeSkill, selection }) => {
      resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
    }
  })
}

const renderCharacterCreationTermSkillTables = (
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  return renderCharacterCreationTermSkillTablesView(document, flow, {
    rollTermSkill: (table) =>
      characterCreationCommandController.rollTermSkill(table),
    reportError: setError
  })
}

const renderCharacterCreationReenlistmentRollButton = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  return renderCharacterCreationReenlistmentRollButtonView(document, flow, {
    rollReenlistment: () =>
      characterCreationCommandController.rollReenlistment(),
    reportError: setError
  })
}

const renderCharacterCreationAgingRollButton = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  return renderCharacterCreationAgingRollButtonView(document, flow, {
    rollAging: () => characterCreationCommandController.rollAging(),
    reportError: setError
  })
}

const renderCharacterCreationAgingChoices = (
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  return renderCharacterCreationAgingChoicesView(document, flow, {
    applyAgingChange: (index, characteristic) =>
      characterCreationCommandController.resolveAgingLoss(index, characteristic)
  })
}

const renderCharacterCreationAnagathicsDecision = (
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  return renderCharacterCreationAnagathicsDecisionView(document, flow, {
    decideAnagathics: (useAnagathics) =>
      characterCreationCommandController.decideAnagathics(useAnagathics),
    reportError: setError
  })
}

const renderCharacterCreationTermCascadeChoices = (
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  return renderCharacterCreationTermCascadeChoicesView(document, flow, {
    resolveCascadeSkill: ({ scope, cascadeSkill, selection }) => {
      resolveCharacterCreationCascadeChoice(scope, cascadeSkill, selection)
    }
  })
}

const resolveCharacterCreationCascadeChoice = (
  scope: 'background' | 'term',
  cascadeSkill: string,
  selection: string
) => {
  const flow = characterCreationController.flow()
  if (!flow) return
  syncCharacterCreationWizardFields()
  const syncedFlow = characterCreationController.flow()
  if (!syncedFlow) return
  const nextFlow =
    scope === 'term'
      ? resolveCharacterCreationTermCascadeSkill({
          flow: syncedFlow,
          cascadeSkill,
          selection
        }).flow
      : {
          ...syncedFlow,
          draft: resolveCharacterCreationCascadeSkill({
            draft: syncedFlow.draft,
            cascadeSkill,
            selection
          })
        }
  characterCreationController.setFlow(nextFlow)
  setError('')
  renderCharacterCreationWizard()
  if (scope === 'term') {
    characterCreationCommandController
      .publishTermCascadeResolution(nextFlow, cascadeSkill, selection, nextFlow)
      .catch((error) => setError(error.message))
  } else {
    characterCreationHomeworldPublisher.publishCascadeResolution(
      nextFlow,
      cascadeSkill,
      selection
    )
  }
}

const renderCharacterCreationCharacteristicGrid = (
  flow: CharacterCreationFlow
): HTMLElement => {
  return renderCharacterCreationCharacteristicGridView(document, flow, {
    rollCharacteristic: (characteristicKey) =>
      characterCreationCommandController.rollCharacteristic(characteristicKey),
    reportError: setError
  })
}

const renderCharacterCreationCareerPicker = (
  flow: CharacterCreationFlow
): HTMLElement => {
  return renderCharacterCreationCareerPickerView(document, flow, {
    resolveCareerQualification: (career) =>
      characterCreationCommandController.resolveCareerQualification(career),
    selectFailedQualificationCareer,
    reportError: setError
  })
}

const renderCharacterCreationTermResolution = (
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  return renderCharacterCreationTermResolutionView(document, flow, {
    completeTerm: async (continueCareer) => {
      const flow = characterCreationController.flow()
      if (!flow) return
      const result = completeCharacterCreationCareerTerm({
        flow,
        continueCareer
      })
      if (!result.moved) return

      await ensureCharacterCreationPublished()
      await postCharacterCreationCommand({
        type: continueCareer
          ? 'ReenlistCharacterCreationCareer'
          : 'LeaveCharacterCreationCareer',
        ...commandIdentity(),
        characterId: flow.draft.characterId
      })
      characterCreationController.setFlow(result.flow)
      setError('')
      renderCharacterCreationWizard()
      characterCreationPanel.scrollToTop()
    }
  })
}

const renderCharacterCreationTermHistory = (
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  return renderCharacterCreationTermHistoryView(document, flow)
}

const selectFailedQualificationCareer = (
  career: string,
  drafted: boolean
): void => {
  const flow = characterCreationController.flow()
  if (!flow) return
  characterCreationController.setFlow(
    applyParsedCharacterCreationDraftPatch(flow, {
      careerPlan: {
        career,
        qualificationRoll: null,
        qualificationPassed: true,
        survivalRoll: null,
        survivalPassed: null,
        commissionRoll: null,
        commissionPassed: null,
        advancementRoll: null,
        advancementPassed: null,
        canCommission: null,
        canAdvance: null,
        drafted
      }
    }).flow
  )
  setError('')
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const renderCharacterCreationCharacteristicRollButton = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  return renderCharacterCreationCharacteristicRollButtonView(document, flow, {
    rollCharacteristic: () =>
      characterCreationCommandController.rollCharacteristic(),
    reportError: setError
  })
}

const renderCharacterCreationCareerRollButton = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  return renderCharacterCreationCareerRollButtonView(document, flow, {
    rollCareerCheck: () => characterCreationCommandController.rollCareerCheck(),
    reportError: setError
  })
}

const renderCharacterCreationBasicTrainingButton = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  return renderCharacterCreationBasicTrainingButtonView(document, flow, {
    hasFlow: () => Boolean(characterCreationController.flow()),
    syncFields: syncCharacterCreationWizardFields,
    completeBasicTraining: () =>
      characterCreationCommandController.completeBasicTraining(),
    reportError: setError
  })
}

const renderCharacterCreationMusteringOut = (
  flow: CharacterCreationFlow
): HTMLElement => {
  return renderCharacterCreationMusteringOutView(document, flow, {
    rollMusteringBenefit: (kind) =>
      characterCreationCommandController.rollMusteringBenefit(kind),
    reportError: setError
  })
}

const renderCharacterCreationReview = (
  flow: CharacterCreationFlow
): HTMLElement => {
  return renderCharacterCreationReviewView(document, flow)
}

const currentBoardList = () => boardList(state)

const currentSelectedBoardId = () => selectSelectedBoardId(state)

const advanceCharacterCreationWizard = async () => {
  await characterCreationWizardController.advance()
}

const bootstrapScene = async () => {
  setError('')
  for (let i = 0; i < 10; i++) {
    const command = nextBootstrapCommand({ ...bootstrapIdentity(), state })
    if (!command) break
    await postCommand(command, 'bootstrap-' + i)
  }
  await fetchState()
}

const roomSocketController = createRoomSocketController({
  webSocketConstructor: WebSocket,
  buildUrl: buildRoomWebSocketUrl,
  getUrlInput: () => ({
    protocol: location.protocol,
    host: location.host,
    roomId,
    viewerRole,
    actorId,
    actorSessionSecret
  }),
  isOffline: () => connectivityController?.snapshot().status === 'offline',
  onStatus: setStatus,
  onError: setError,
  onMessage: (message) => handleServerMessage(message as ServerMessage)
})

const connectSocket = () => {
  roomSocketController.connect()
}

connectivityController = createConnectivityController({
  onChange: (connectivity) => {
    if (connectivity.status === 'offline') {
      setStatus('Offline')
      return
    }

    connectSocket()
    fetchState().catch((error) => setError(error.message))
  }
})

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

const characterCreationActions = (
  character: CharacterState | null
): {
  title: string
  status: string
  summary: string
  actions: HTMLElement | null
} | null => {
  if (!character) return null
  const plan = deriveCharacterCreationActionPlan(clientIdentity(), character)
  if (!plan) return null
  const actions = document.createElement('div')
  actions.className = 'sheet-actions creation-actions'
  for (const viewModel of plan.actions) {
    if (!viewModel.command) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = viewModel.label
    button.className = viewModel.variant === 'primary' ? 'active' : ''
    button.addEventListener('click', () => {
      postCharacterCreationCommand(
        viewModel.command as CharacterCreationCommand
      ).catch((error) => setError(error.message))
    })
    actions.append(button)
  }
  return {
    title: plan.title,
    status: plan.status,
    summary: plan.summary,
    actions: actions.childElementCount > 0 ? actions : null
  }
}

const characterSheetController = createCharacterSheetController({
  elements: {
    sheet: els.sheet,
    sheetName: els.sheetName,
    sheetBody: els.sheetBody,
    sheetTabs: els.sheetTabs
  },
  getSelectedPiece: selectedPiece,
  getSelectedCharacter: selectedCharacter,
  getSelectedBoard: selectedBoard,
  getCharacterState: () => state,
  canEditSheetFields: () => isActorRefereeOrOwner(state, asUserId(actorId)),
  getBoardDoorActions: () => ({ actions: boardDoorActions(selectedBoard()) }),
  sendPatch: (characterId, patch) =>
    postSheetCommand({
      type: 'UpdateCharacterSheet',
      ...commandIdentity(),
      characterId: asCharacterId(
        typeof characterId === 'string'
          ? characterId
          : (characterId.characterId ?? characterId.id ?? '')
      ),
      ...patch
    }),
  setVisibility: (piece, visibility) =>
    postSheetCommand({
      type: 'SetPieceVisibility',
      ...commandIdentity(),
      pieceId: piece.id,
      visibility
    }),
  setFreedom: (piece, freedom) =>
    postSheetCommand({
      type: 'SetPieceFreedom',
      ...commandIdentity(),
      pieceId: piece.id,
      freedom
    }),
  rollSkill: (_piece, _character, _skill, reason) =>
    postSheetCommand(
      buildRollDiceCommand({
        identity: clientIdentity(),
        expression: '2d6',
        reason
      }) as DiceCommand
    ),
  getCharacterCreationActions: characterCreationActions,
  reportError: (message) => setError(message)
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
  creationPresenceDock.render(state)
}

const animateRoll = (roll: LiveDiceRollRevealTarget | DiceRollState): void => {
  const overlayHost = characterCreationPanel.overlayHost()
  if (overlayHost && els.diceOverlay.parentElement !== overlayHost) {
    overlayHost.append(els.diceOverlay)
  }
  const overlayContext = characterCreationPanel.overlayContext()
  els.diceOverlay.classList.toggle('in-creator', overlayContext.inCreator)
  els.diceOverlay.classList.toggle('in-dialog', overlayContext.inDialog)
  diceHideTimer = animateDiceRoll({
    roll,
    overlay: els.diceOverlay,
    stage: els.diceStage,
    hideTimer: diceHideTimer,
    onReveal: () => resolveDiceReveal(roll.id)
  })
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
  defaultRoomId: DEFAULT_APP_LOCATION.roomId,
  defaultActorId: DEFAULT_APP_LOCATION.actorId,
  onOpenRoom: (identity) => {
    roomId = identity.roomId
    actorId = identity.actorId
    actorSessionSecret = resolveActorSessionSecret({ roomId, actorId })
    appSession.setRoomIdentity({ roomId, actorId })
    diceRevealCoordinator.resetStateTracking()
    characterCreationController.setSelectedCharacterId(null)
    creationActivityFeedController.clear()
    creationPresenceDock.hydrate()
    selectPiece(null)
    boardController?.clearDrag()
    characterSheetController.setOpen(false)
    connectSocket()
    fetchState().catch((error) => setError(error.message))
  }
})

createRoomAssetCreationController({
  elements: {
    createPiece: els.createPiece,
    createBoard: els.createBoard,
    pieceNameInput: els.pieceNameInput,
    pieceImageInput: els.pieceImageInput,
    pieceImageFileInput: els.pieceImageFileInput,
    pieceCropInput: els.pieceCropInput,
    pieceCropXInput: els.pieceCropXInput,
    pieceCropYInput: els.pieceCropYInput,
    pieceCropWidthInput: els.pieceCropWidthInput,
    pieceCropHeightInput: els.pieceCropHeightInput,
    pieceWidthInput: els.pieceWidthInput,
    pieceHeightInput: els.pieceHeightInput,
    pieceScaleInput: els.pieceScaleInput,
    pieceSheetInput: els.pieceSheetInput,
    boardNameInput: els.boardNameInput,
    boardImageInput: els.boardImageInput,
    boardImageFileInput: els.boardImageFileInput,
    boardWidthInput: els.boardWidthInput,
    boardHeightInput: els.boardHeightInput,
    boardScaleInput: els.boardScaleInput,
    roomDialog: els.roomDialog
  },
  getState: () => state,
  getSelectedBoard: selectedBoard,
  getSelectedBoardPieces: boardPieces,
  getClientIdentity: clientIdentity,
  getBootstrapIdentity: bootstrapIdentity,
  getCommandIdentity: clientIdentity,
  createRequestId: requestId,
  postCommand,
  postBoardCommand: (command) => postBoardCommand(command as BoardCommand),
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

els.refresh.addEventListener('click', () => {
  fetchState().catch((error) => setError(error.message))
})

els.boardSelect.addEventListener('change', () => {
  const boardId = els.boardSelect.value
  if (!boardId || boardId === currentSelectedBoardId() || !canSelectBoards)
    return
  selectPiece(null)
  boardController?.clearDrag()
  postBoardCommand({
    type: 'SelectBoard',
    ...commandIdentity(),
    boardId: asBoardId(boardId)
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
  postDiceCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: els.diceExpression.value.trim() || '2d6',
      reason: 'Table roll'
    }) as DiceCommand
  ).catch((error) => setError(error.message))
})

window.addEventListener('resize', render)

createAppBootstrap({
  connectivityStatus: connectivityController.snapshot().status,
  connect: connectSocket,
  fetchState,
  setStatus,
  setError
})
