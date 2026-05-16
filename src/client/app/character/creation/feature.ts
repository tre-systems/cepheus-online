import type { CharacterId } from '../../../../shared/ids.js'
import type {
  BoardState,
  GameState,
  PieceState
} from '../../../../shared/state.js'
import type {
  ClientDiceRollActivity,
  ClientIdentity
} from '../../../game-commands.js'
import type { RequiredAppElements } from '../../core/elements.js'
import type {
  BoardCommand,
  CharacterCreationCommand
} from '../../core/command-router.js'
import type { BootstrapCommandContext } from '../../room/bootstrap-flow.js'
import { createGameCommand } from '../../room/bootstrap-flow.js'
import {
  createCharacterCreationCommandController,
  type CharacterCreationCommandController
} from './command-controller.js'
import { createCharacterCreationController } from './controller.js'
import { createCharacterCreationDomController } from './dom.js'
import type { CharacterCreationDraft } from './flow.js'
import { createCharacterCreationFinalizationController } from './finalization.js'
import { createCharacterCreationHomeworldPublisher } from './homeworld-publisher.js'
import { createCharacterCreationLifecycleController } from './lifecycle.js'
import { createCharacterCreationPanel } from './panel.js'
import { createCharacterCreationPublicationController } from './publication.js'
import {
  createCharacterCreationRenderController,
  type CharacterCreationRenderController
} from './render-controller.js'
import { createCharacterCreationWizardController } from './wizard.js'
import {
  createCreationActivityFeedController,
  creationActivityRevealDelayMs,
  type CreationActivityFeedController
} from '../../activity/feed.js'
import { createCreationPresenceDock } from '../../activity/presence-dock.js'
import {
  createDiceOverlayWiring,
  type DiceOverlayWiring
} from '../../dice/overlay-wiring.js'
import type { RequestIdFactory } from '../../core/request-id.js'
import type { CommandAcceptedMessage } from '../../room/command-dispatch.js'

export interface CharacterCreationFeature {
  animateRoll: DiceOverlayWiring['animateRoll']
  startNew: () => Promise<void>
  selectedCharacterId: () => CharacterId | null
  clearSelectedCharacter: () => void
  openPanel: () => void
  planStateRefresh: ReturnType<
    typeof createCharacterCreationLifecycleController
  >['planStateRefresh']
  showActivity: (
    application: Parameters<CreationActivityFeedController['show']>[0],
    diceRollActivities: readonly ClientDiceRollActivity[]
  ) => void
  renderPresence: (state: GameState | null) => void
  hydratePresence: () => void
  clearActivityFeed: () => void
  dispose: () => void
}

type CharacterCreationCommandRevealRoll = Parameters<
  typeof createCharacterCreationCommandController
>[0]['waitForDiceRevealOrDelay'] extends (roll: infer Roll) => unknown
  ? Roll
  : never

export interface CreateCharacterCreationFeatureOptions {
  document: Document
  elements: RequiredAppElements
  getState: () => GameState | null
  getActorId: () => string
  getRoomId: () => string
  identity: () => ClientIdentity
  commandIdentity: () => ClientIdentity
  bootstrapIdentity: () => BootstrapCommandContext
  requestId: RequestIdFactory
  getSelectedBoard: () => BoardState | null
  getSelectedBoardPieces: () => PieceState[]
  selectPiece: (pieceId: PieceState['id'] | null) => void
  closeCharacterSheet: () => void
  openCharacterSheet: () => void
  renderApp: () => void
  createGame: (
    command: ReturnType<typeof createGameCommand>,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postBoardCommand: (
    command: BoardCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postCharacterCreationCommand: (
    command: CharacterCreationCommand,
    requestId?: string
  ) => Promise<CommandAcceptedMessage>
  postCharacterCreationCommands: (
    commands: readonly CharacterCreationCommand[]
  ) => Promise<readonly CommandAcceptedMessage[]>
  waitForDiceReveal: Parameters<
    typeof createCharacterCreationLifecycleController
  >[0]['waitForDiceReveal']
  waitForDiceRevealOrDelay: (
    roll: ClientDiceRollActivity | CharacterCreationCommandRevealRoll
  ) => Promise<void>
  refreshStateAfterDiceReveal?: () => Promise<void>
  resolveDiceReveal: Parameters<
    typeof createDiceOverlayWiring
  >[0]['resolveDiceReveal']
  reportError: (message: string) => void
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

export const createCharacterCreationFeature = ({
  document,
  elements,
  getState,
  getActorId,
  getRoomId,
  identity,
  commandIdentity,
  bootstrapIdentity,
  requestId,
  getSelectedBoard,
  getSelectedBoardPieces,
  selectPiece,
  closeCharacterSheet,
  openCharacterSheet,
  renderApp,
  createGame,
  postBoardCommand,
  postCharacterCreationCommand,
  postCharacterCreationCommands,
  waitForDiceRevealOrDelay,
  refreshStateAfterDiceReveal,
  resolveDiceReveal,
  reportError
}: CreateCharacterCreationFeatureOptions): CharacterCreationFeature => {
  let commandController: CharacterCreationCommandController
  let renderController: CharacterCreationRenderController

  const panel = createCharacterCreationPanel({
    elements: {
      panel: elements.characterCreator,
      body: elements.creatorBody,
      roomDialog: elements.roomDialog,
      fallbackOverlayHost: document.querySelector('.app-shell'),
      title: elements.characterCreatorTitle,
      startSection: elements.creatorStartSection,
      quickSection: elements.creatorQuickSection,
      startWizardButton: elements.startCharacterWizard,
      wizard: elements.characterCreationWizard,
      steps: elements.characterCreationSteps,
      status: elements.characterCreationStatus,
      fields: elements.characterCreationFields,
      backWizardButton: elements.backCharacterWizard,
      nextWizardButton: elements.nextCharacterWizard,
      actions: elements.creatorActions
    },
    closeCharacterSheet,
    requestRender: renderApp
  })

  const diceOverlayWiring = createDiceOverlayWiring({
    elements: {
      overlay: elements.diceOverlay,
      stage: elements.diceStage
    },
    panel,
    resolveDiceReveal
  })

  const controller = createCharacterCreationController({
    getState,
    isPanelOpen: () => panel.isOpen(),
    closePanel: () => panel.close()
  })

  const lifecycleController = createCharacterCreationLifecycleController({
    controller,
    panel,
    closeCharacterSheet,
    renderWizard: () => renderWizard(),
    waitForDiceReveal: waitForDiceRevealOrDelay,
    reportError
  })

  const publicationController = createCharacterCreationPublicationController({
    getFlow: () => controller.flow(),
    getState,
    isReadOnly: () => controller.readOnly(),
    identity,
    createGame: () =>
      createGame(
        createGameCommand(bootstrapIdentity()),
        requestId('create-game-for-character-creation')
      ),
    postCharacterCreationCommands,
    reportError
  })

  const ensurePublished = () => publicationController.ensurePublished()

  const homeworldPublisher = createCharacterCreationHomeworldPublisher({
    getState,
    isReadOnly: () => controller.readOnly(),
    commandIdentity,
    ensurePublished,
    postCharacterCreationCommand,
    requestId,
    setError: reportError
  })

  const finalizationController = createCharacterCreationFinalizationController({
    getFlow: () => controller.flow(),
    setFlow: (flow) => {
      controller.setFlow(flow)
    },
    getState,
    getSelectedBoard,
    getSelectedBoardPieces,
    identity,
    bootstrapIdentity,
    requestId,
    syncFields: () => syncFields(),
    reportError,
    renderWizard: () => renderWizard(),
    closePanel: () => panel.close(),
    openCharacterSheet,
    renderApp,
    selectPiece,
    createGame,
    createBoard: postBoardCommand,
    postCharacterCreationCommands,
    postBoardCommand
  })

  const activityFeedController = createCreationActivityFeedController({
    elements: { feed: elements.creationActivityFeed },
    getViewerActorId: getActorId,
    shouldSuppressCards: () => panel.isOpen() && !controller.readOnly(),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window)
  })

  const openCharacterCreationFollow = (
    characterId: Parameters<typeof lifecycleController.openFollow>[0],
    options: Parameters<typeof lifecycleController.openFollow>[1],
    _fallbackState: ReturnType<typeof getState>
  ): boolean => {
    if (lifecycleController.openFollow(characterId, options)) return true
    return false
  }

  const presenceDock = createCreationPresenceDock({
    elements: {
      dock: elements.creationPresenceDock,
      characterCreator: elements.characterCreator,
      sheet: elements.sheet
    },
    getRoomId,
    getActorId,
    openCharacterCreationFollow,
    localStorage: window.localStorage,
    isCharacterCreatorActive: () =>
      Boolean(controller.flow()) || Boolean(controller.selectedCharacterId()),
    isCharacterCreatorReadOnly: () => controller.readOnly()
  })

  presenceDock.hydrate()

  const wizardController = createCharacterCreationWizardController({
    controller,
    fieldsRoot: elements.characterCreationFields,
    panel,
    getState,
    getSeed: characterCreationSeed,
    currentProjection: () => controller.currentProjection(),
    homeworldPublisher,
    selectPiece,
    closeCharacterSheet,
    ensurePublished,
    finish: () => finalizationController.finish(),
    renderWizard: () => renderWizard(),
    setError: reportError
  })

  const startNew = () => wizardController.startNew()

  const autoAdvanceSetup = () => wizardController.autoAdvanceSetup()

  const syncFields = () => wizardController.syncFields()

  const renderWizardControls = () => renderController.renderWizardControls()

  const renderWizard = () => renderController.renderWizard()

  renderController = createCharacterCreationRenderController({
    document,
    elements: {
      backCharacterWizard: elements.backCharacterWizard,
      nextCharacterWizard: elements.nextCharacterWizard,
      creatorActions: elements.creatorActions,
      characterCreationStatus: elements.characterCreationStatus,
      characterCreationSteps: elements.characterCreationSteps,
      characterCreationFields: elements.characterCreationFields,
      characterCreationWizard: elements.characterCreationWizard
    },
    controller,
    panel,
    wizard: wizardController,
    homeworldPublisher,
    getCommandController: () => commandController,
    ensurePublished,
    postCharacterCreationCommand,
    commandIdentity,
    reportError
  })

  commandController = createCharacterCreationCommandController({
    getFlow: () => controller.flow(),
    setFlow: (flow) => {
      controller.setFlow(flow)
    },
    setError: reportError,
    isReadOnly: () => controller.readOnly(),
    syncFields,
    getState,
    flushHomeworldProgress: () => homeworldPublisher.flush(),
    ensurePublished,
    postCharacterCreationCommand,
    commandIdentity,
    requestId,
    waitForDiceRevealOrDelay,
    refreshStateAfterDiceReveal,
    syncFlowFromRoomState: controller.syncFlowFromRoomState,
    autoAdvanceSetup,
    renderWizard,
    scrollToTop: () => panel.scrollToTop()
  })

  const domController = createCharacterCreationDomController({
    elements: {
      createCharacterRail: elements.createCharacterRail,
      characterCreatorClose: elements.characterCreatorClose,
      startCharacterWizard: elements.startCharacterWizard,
      backCharacterWizard: elements.backCharacterWizard,
      nextCharacterWizard: elements.nextCharacterWizard,
      characterCreationFields: elements.characterCreationFields
    },
    controller,
    wizard: wizardController,
    panel,
    homeworldPublisher,
    renderWizardControls,
    renderWizard,
    renderApp,
    reportError
  })

  const clearActivityFeed = () => activityFeedController.clear()

  return {
    animateRoll: diceOverlayWiring.animateRoll,
    startNew,
    selectedCharacterId: controller.selectedCharacterId,
    clearSelectedCharacter: () => {
      controller.setSelectedCharacterId(null)
    },
    openPanel: panel.open,
    planStateRefresh: lifecycleController.planStateRefresh,
    showActivity(application, diceRollActivities) {
      activityFeedController.show(
        application,
        creationActivityRevealDelayMs(diceRollActivities)
      )
    },
    renderPresence: presenceDock.render,
    hydratePresence: presenceDock.hydrate,
    clearActivityFeed,
    dispose() {
      domController.dispose()
      activityFeedController.dispose()
      controller.dispose()
    }
  }
}
