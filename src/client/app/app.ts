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
import { bindAsyncActionButton } from './async-action-button.js'
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
  renderCharacterCreationCascadeChoice as renderCharacterCreationCascadeChoiceView,
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
import { deriveCharacterCreationActionPlan } from './character-creation-actions.js'
import {
  applyCharacterCreationBackgroundSkillSelection,
  applyCharacterCreationAgingChange,
  applyParsedCharacterCreationDraftPatch,
  characterCreationCareerNames,
  completeCharacterCreationCareerTerm,
  removeCharacterCreationBackgroundSkillSelection,
  resolveCharacterCreationCascadeSkill,
  resolveCharacterCreationTermCascadeSkill,
  type CharacterCreationDraft,
  type CharacterCreationFlow
} from './character-creation-flow.js'
import {
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationCharacteristicRollButton,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationNextStepViewModel
} from './character-creation-view.js'
import {
  renderCharacterCreationReview as renderCharacterCreationReviewView,
  renderCharacterCreationTermHistory as renderCharacterCreationTermHistoryView
} from './character-creation-review-view.js'
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
import { fetchRoomState, postRoomCommand } from './room-api.js'
import {
  applyServerMessage as applyClientServerMessage,
  buildRollDiceCommand,
  type ClientDiceRollActivity,
  type ClientIdentity,
  buildSetDoorOpenCommand
} from '../game-commands.js'
import type {
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
import { planCreatePieceCommands } from './piece-command-plan.js'
import { createPwaInstallController } from './pwa-install.js'
import { createRequestIdFactory } from './request-id.js'
import { createRoomMenuController } from './room-menu-controller.js'
import { createRoomCommandDispatch } from './room-command-dispatch.js'
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

const parsePositiveIntegerInput = (
  input: HTMLInputElement,
  fallback: number
): number => {
  return parsePositiveIntegerValue(input.value, fallback)
}

const parsePositiveNumberInput = (
  input: HTMLInputElement,
  fallback: number
): number => {
  return parsePositiveNumberValue(input.value, fallback)
}

const parseNonNegativeIntegerInput = (
  input: HTMLInputElement,
  fallback: number
): number => {
  return parseNonNegativeIntegerValue(input.value, fallback)
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

const renderCharacterCreationNextStep = (
  flow: CharacterCreationFlow
): HTMLElement => {
  const viewModel = deriveCharacterCreationNextStepViewModel(flow)
  const panel = document.createElement('section')
  panel.className = 'creation-next-step'

  const heading = document.createElement('strong')
  heading.textContent = viewModel.phase
  const prompt = document.createElement('p')
  prompt.textContent = viewModel.prompt
  const stats = document.createElement('div')
  stats.className = 'creation-stat-strip'
  const actions = document.createElement('div')
  actions.className = 'creation-next-step-actions'

  for (const stat of viewModel.stats) {
    const item = document.createElement('span')
    if (stat.missing) item.classList.add('missing')
    const label = document.createElement('b')
    label.textContent = stat.label
    const value = document.createElement('span')
    value.textContent = stat.value
    const modifier = document.createElement('small')
    modifier.textContent = stat.modifier
    item.append(label, value, modifier)
    stats.append(item)
  }

  if (!viewModel.primaryAction.disabled && flow.step === 'review') {
    const primary = document.createElement('button')
    primary.type = 'button'
    primary.textContent = viewModel.primaryAction.label
    primary.addEventListener('click', () => {
      advanceCharacterCreationWizard().catch((error) => setError(error.message))
    })
    actions.append(primary)
  }

  panel.append(heading, prompt)
  if (viewModel.blockingChoice) {
    panel.append(
      renderCharacterCreationCascadeChoiceView(
        document,
        viewModel.blockingChoice,
        'background',
        {
          resolveCascadeSkill: ({ scope, cascadeSkill, selection }) => {
            resolveCharacterCreationCascadeChoice(
              scope,
              cascadeSkill,
              selection
            )
          }
        }
      )
    )
  }
  if (!['characteristics', 'homeworld'].includes(flow.step)) {
    panel.append(stats)
  }
  if (actions.childElementCount > 0) panel.append(actions)
  return panel
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
  for (const field of deriveCharacterCreationFieldViewModels(flow)) {
    if (field.key === 'skills') {
      const panel = document.createElement('section')
      panel.className = 'character-creation-field skill-review'
      const title = document.createElement('span')
      title.textContent = field.required ? `${field.label} *` : field.label
      const skills = document.createElement('div')
      skills.className = 'creation-skill-review-list'
      const skillValues = flow.draft.skills.length > 0 ? flow.draft.skills : []
      for (const skill of skillValues) {
        const chip = document.createElement('span')
        chip.textContent = skill
        skills.append(chip)
      }
      if (skillValues.length === 0) {
        const empty = document.createElement('small')
        empty.textContent = 'No skills recorded yet.'
        skills.append(empty)
      }
      const control = document.createElement('input')
      control.type = 'hidden'
      control.dataset.characterCreationField = field.key
      control.value = field.value
      panel.append(title, skills, control)
      if (field.errors.length > 0) {
        const error = document.createElement('small')
        error.textContent = field.errors.join(', ')
        panel.append(error)
      }
      fragment.append(panel)
      continue
    }

    const label = document.createElement('label')
    label.className = `character-creation-field ${field.kind}`
    const name = document.createElement('span')
    name.textContent = field.required ? `${field.label} *` : field.label

    let control = null
    if (field.kind === 'textarea') {
      control = document.createElement('textarea')
      control.rows = field.key === 'skills' ? 4 : 3
    } else if (field.kind === 'select') {
      control = document.createElement('select')
      const values =
        field.key === 'career'
          ? ['', ...characterCreationCareerNames()]
          : ['PLAYER', 'NPC', 'ANIMAL', 'ROBOT']
      for (const value of values) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = value || 'Select career'
        control.append(option)
      }
    } else {
      control = document.createElement('input')
      control.type = 'text'
      if (field.kind === 'number') control.inputMode = 'numeric'
    }
    control.dataset.characterCreationField = field.key
    control.value = field.value
    control.autocomplete = 'off'

    label.append(name, control)
    if (field.errors.length > 0) {
      const error = document.createElement('small')
      error.textContent = field.errors.join(', ')
      label.append(error)
    }
    fragment.append(label)
  }
  const careerRollButton = renderCharacterCreationCareerRollButton(flow)
  const characteristicRollButton =
    renderCharacterCreationCharacteristicRollButton(flow)
  const basicTrainingButton = renderCharacterCreationBasicTrainingButton(flow)
  if (characteristicRollButton) fragment.append(characteristicRollButton)
  if (careerRollButton) fragment.append(careerRollButton)
  if (basicTrainingButton) fragment.append(basicTrainingButton)
  if (flow.step === 'equipment') {
    fragment.prepend(renderCharacterCreationMusteringOut(flow))
  }
  return fragment
}

const renderCharacterCreationDeath = (
  flow: CharacterCreationFlow
): HTMLElement | null => {
  const viewModel = deriveCharacterCreationDeathViewModel(flow)
  if (!viewModel) return null

  const panel = document.createElement('section')
  panel.className = 'creation-death-card'
  const eyebrow = document.createElement('span')
  eyebrow.textContent = viewModel.career
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const detail = document.createElement('p')
  detail.textContent = viewModel.detail
  const roll = document.createElement('div')
  roll.className = 'creation-death-roll'
  const rollLabel = document.createElement('span')
  rollLabel.textContent = 'Survival roll'
  const rollValue = document.createElement('b')
  rollValue.textContent = viewModel.roll
  roll.append(rollLabel, rollValue)
  panel.append(eyebrow, title, detail, roll)
  if (!characterCreationController.readOnly()) {
    const actions = document.createElement('div')
    actions.className = 'creation-death-actions'
    const next = document.createElement('button')
    next.type = 'button'
    next.textContent = 'Start a new character'
    next.addEventListener('click', () => {
      startNewCharacterCreationWizard().catch((error) =>
        setError(error.message)
      )
    })
    actions.append(next)
    panel.append(actions)
  }
  return panel
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
    applyAgingChange: (index, characteristic) => {
      const latestFlow = characterCreationController.flow()
      if (!latestFlow) return
      characterCreationController.setFlow(
        applyCharacterCreationAgingChange({
          flow: latestFlow,
          index,
          characteristic
        }).flow
      )
      setError('')
      renderCharacterCreationWizard()
    }
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
    completeTerm: (continueCareer) => {
      const flow = characterCreationController.flow()
      if (!flow) return
      characterCreationController.setFlow(
        completeCharacterCreationCareerTerm({
          flow,
          continueCareer
        }).flow
      )
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
  const viewModel = deriveCharacterCreationCharacteristicRollButton(flow)
  if (!viewModel) return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindAsyncActionButton(button, () =>
    characterCreationCommandController
      .rollCharacteristic()
      .catch((error) => setError(error.message))
  )
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  wrapper.append(button, hint)
  return wrapper
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
  const viewModel = deriveCharacterCreationBasicTrainingButton(flow)
  if (!viewModel) return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindAsyncActionButton(button, () => {
    if (!characterCreationController.flow()) return
    syncCharacterCreationWizardFields()
    setError('')
    return characterCreationCommandController
      .completeBasicTraining()
      .catch((error) => setError(error.message))
  })
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  const skills = document.createElement('div')
  skills.className = 'creation-training-skills'
  for (const skill of viewModel.skills) {
    const chip = document.createElement('span')
    chip.textContent = skill
    skills.append(chip)
  }
  wrapper.append(button, hint, skills)
  return wrapper
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
      createGameCommand(bootstrapIdentity()),
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
  await postBoardCommand({
    type: 'CreateBoard',
    ...commandIdentity(),
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

const advanceCharacterCreationWizard = async () => {
  await characterCreationWizardController.advance()
}

const backCharacterCreationWizard = () => {
  characterCreationWizardController.back()
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
  await commandRouter.dispatchSequential(plan.commands)
  selectPiece(plan.pieceId)
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

els.createCharacterRail.addEventListener('click', () => {
  startNewCharacterCreationWizard().catch((error) => setError(error.message))
})

els.characterCreatorClose.addEventListener('click', () => {
  characterCreationPanel.close()
  characterCreationController.clearReadOnlyFollow()
  render()
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

els.startCharacterWizard.addEventListener('click', () => {
  startNewCharacterCreationWizard().catch((error) => setError(error.message))
})

els.backCharacterWizard.addEventListener('click', () => {
  backCharacterCreationWizard()
})

els.characterCreationFields.addEventListener('input', () => {
  syncCharacterCreationWizardFields()
  renderCharacterCreationWizardControls()
})

els.characterCreationFields.addEventListener('change', () => {
  syncCharacterCreationWizardFields()
  const nextFlow = characterCreationController.flow()
  if (nextFlow?.step === 'homeworld') {
    characterCreationHomeworldPublisher.publishProgress(nextFlow)
  }
  autoAdvanceCharacterCreationSetup()
  renderCharacterCreationWizard()
})

els.nextCharacterWizard.addEventListener('click', () => {
  advanceCharacterCreationWizard().catch((error) => setError(error.message))
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
