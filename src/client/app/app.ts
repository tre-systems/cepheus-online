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
import { getAppElements } from './app-elements.js'
import { createAppBootstrap } from './app-bootstrap.js'
import { createBoardController } from './board-controller.js'
import { createCharacterCreationPanel } from './character-creation-panel.js'
import { deriveCreationActivityCardsFromApplication } from './creation-activity-view.js'
import { deriveCharacterCreationActionPlan } from './character-creation-actions.js'
import {
  applyCharacterCreationBasicTraining,
  applyCharacterCreationBackgroundSkillSelection,
  applyCharacterCreationAnagathicsDecision,
  applyCharacterCreationAgingChange,
  applyCharacterCreationAgingRoll,
  applyCharacterCreationCharacteristicRoll,
  applyCharacterCreationCareerRoll,
  applyCharacterCreationMusteringBenefit,
  applyCharacterCreationReenlistmentRoll,
  applyCharacterCreationTermSkillRoll,
  applyParsedCharacterCreationDraftPatch,
  backCharacterCreationWizardStep,
  canRollCharacterCreationMusteringBenefit,
  characterCreationMusteringBenefitRollModifier,
  characterCreationCareerNames,
  completeCharacterCreationCareerTerm,
  createInitialCharacterDraft,
  createManualCharacterCreationFlow,
  deriveCreateCharacterCommand,
  deriveCharacterCreationCommands,
  deriveCharacterCreationAgingChangeOptions,
  deriveCharacterCreationAnagathicsDecision,
  deriveStartCharacterCreationCommand,
  deriveCharacterCreationTermSkillTableActions,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationReenlistmentRoll,
  isCharacterCreationCareerTermResolved,
  nextCharacterCreationWizardStep,
  remainingMusteringBenefits,
  removeCharacterCreationBackgroundSkillSelection,
  resolveCharacterCreationCascadeSkill,
  resolveCharacterCreationTermCascadeSkill,
  skipCharacterCreationCareerRoll
} from './character-creation-flow.js'
import {
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationCharacteristicRollButton,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerOptionViewModels,
  deriveCharacterCreationCascadeSkillChoiceViewModels,
  deriveCharacterCreationDeathViewModel,
  deriveCharacterCreationFailedQualificationViewModel,
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationTermSkillTrainingViewModel,
  deriveCharacterCreationValidationSummary,
  parseCharacterCreationDraftPatch
} from './character-creation-view.js'
import {
  cssUrl,
  readImageDimensions,
  readSelectedCroppedImageFileAsDataUrl,
  readSelectedImageFileAsDataUrl
} from './image-assets.js'
import {
  createBoardCommand,
  createGameCommand,
  nextBootstrapCommand,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
  parsePositiveNumberValue,
  uniqueBoardId,
  uniquePieceId
} from './bootstrap-flow.js'
import { fetchRoomState, postRoomCommand } from './room-api.js'
import {
  applyServerMessage as applyClientServerMessage,
  buildRollDiceCommand,
  buildSetDoorOpenCommand
} from '../game-commands.js'
import { createAppCommandRouter } from './app-command-router.js'
import { createAppSession } from './app-session.js'
import { resolveActorSessionSecret } from './actor-session.js'
import { createCharacterSheetController } from './character-sheet-controller.js'
import { createConnectivityController } from './connectivity-controller.js'
import { deriveDoorToggleViewModels } from './door-los-view.js'
import { animateRoll as animateDiceRoll } from './dice-overlay.js'
import { createDiceRevealState } from './dice-reveal-state.js'
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
import { registerClientServiceWorker } from './service-worker.js'

registerClientServiceWorker()

const els = getAppElements(document)

const initialIdentity = resolveAppLocationIdentity(location.search)
let roomId = initialIdentity.roomId
let actorId = initialIdentity.actorId
let actorSessionSecret = resolveActorSessionSecret({ roomId, actorId })
let state = null
let firstStateApplied = false
let latestDiceId = null
let selectedCharacterId = null
const viewerRole = initialIdentity.viewerRole
const canSelectBoards = isRefereeViewer(viewerRole)
const appSession = createAppSession({ roomId, actorId, viewerRole })
let boardController = null
let diceHideTimer = null
let connectivityController = null
const diceRevealState = createDiceRevealState()
const animatedDiceRollActivityIds = new Set()
const creationActivityTimers = new Set()
const dismissedCreationPresenceIds = new Set()
let characterCreationFlow = null
let characterCreationReadOnly = false
let characterCreationPublishPromise = null
let characterCreationHomeworldPublishPromise = Promise.resolve()
const characterCreationCharacteristicKeys = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
]

const setStatus = (text) => {
  els.status.textContent = text
}

const setError = (text) => {
  els.error.textContent = text || ''
}

const clearCreationActivityFeed = () => {
  for (const timer of creationActivityTimers) {
    window.clearTimeout(timer)
  }
  creationActivityTimers.clear()
  els.creationActivityFeed?.replaceChildren()
}

const scheduleCreationActivityTimer = (callback, delayMs) => {
  const timer = window.setTimeout(() => {
    creationActivityTimers.delete(timer)
    callback()
  }, delayMs)
  creationActivityTimers.add(timer)
  return timer
}

const renderCreationActivityCard = (card) => {
  if (!els.creationActivityFeed) return

  const item = document.createElement('article')
  item.className = `creation-activity-card ${card.tone}`
  item.setAttribute('role', 'status')

  const title = document.createElement('strong')
  title.textContent = card.title

  const detail = document.createElement('span')
  detail.textContent = card.detail

  item.append(title, detail)
  els.creationActivityFeed.prepend(item)

  while (els.creationActivityFeed.children.length > 3) {
    els.creationActivityFeed.lastElementChild?.remove()
  }

  scheduleCreationActivityTimer(() => {
    item.classList.add('leaving')
    scheduleCreationActivityTimer(() => item.remove(), 220)
  }, 5200)
}

const showCreationActivityCards = (application, delayMs = 0) => {
  if (characterCreationPanel.isOpen() && !characterCreationReadOnly) return

  const cards = deriveCreationActivityCardsFromApplication(application, {
    viewerActorId: actorId
  })
  if (cards.length === 0 || !els.creationActivityFeed) return

  const renderCards = () => {
    for (const card of cards) renderCreationActivityCard(card)
  }

  if (delayMs > 0) {
    scheduleCreationActivityTimer(renderCards, delayMs)
    return
  }

  renderCards()
}

const creationActivityRevealDelayMs = (diceRollActivities) => {
  if (diceRollActivities.length === 0) return 0

  const revealAtMs = Math.max(
    ...diceRollActivities.map((activity) => Date.parse(activity.revealAt))
  )
  if (!Number.isFinite(revealAtMs)) return 0

  return Math.max(0, revealAtMs - Date.now()) + 160
}

const creationStatusText = (status) =>
  String(status || 'CREATION')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')

const activeCreationSummaries = () => {
  if (!state) return []

  return Object.values(state.characters)
    .filter(
      (character) =>
        character.creation &&
        !character.creation.creationComplete &&
        character.creation.state.status !== 'PLAYABLE' &&
        !dismissedCreationPresenceIds.has(character.id)
    )
    .map((character) => {
      const rolledCharacteristics = Object.values(
        character.characteristics
      ).filter((value) => value !== null).length

      return {
        id: character.id,
        name: character.name || 'Traveller',
        ownerId: character.ownerId,
        status: character.creation.state.status,
        rolledCharacteristics,
        terms: character.creation.terms.length
      }
    })
}

const renderCreationPresenceDock = () => {
  if (!els.creationPresenceDock) return
  if (
    (els.characterCreator && !els.characterCreator.hidden) ||
    els.sheet?.classList.contains('open')
  ) {
    els.creationPresenceDock.hidden = true
    els.creationPresenceDock.replaceChildren()
    return
  }

  const summaries = activeCreationSummaries()
  if (summaries.length === 0) {
    els.creationPresenceDock.hidden = true
    els.creationPresenceDock.replaceChildren()
    return
  }

  const heading = document.createElement('div')
  heading.className = 'creation-presence-heading'
  const title = document.createElement('strong')
  title.textContent = 'Creation live'
  const count = document.createElement('span')
  count.textContent =
    summaries.length === 1 ? '1 traveller' : `${summaries.length} travellers`
  const clearButton = document.createElement('button')
  clearButton.type = 'button'
  clearButton.className = 'creation-presence-clear'
  clearButton.textContent = 'Clear'
  clearButton.title = 'Hide these live creation cards on this screen'
  clearButton.addEventListener('click', () => {
    for (const summary of summaries) dismissedCreationPresenceIds.add(summary.id)
    persistDismissedCreationPresenceIds()
    renderCreationPresenceDock()
  })
  heading.append(title, count, clearButton)

  const list = document.createElement('div')
  list.className = 'creation-presence-list'
  const items = summaries.map((summary) => {
    const item = document.createElement('button')
    item.className = 'creation-presence-card'
    item.type = 'button'
    item.title = `Open ${summary.name}`

    const name = document.createElement('strong')
    name.textContent = summary.name

    const detail = document.createElement('span')
    detail.textContent = `${creationStatusText(summary.status)} · ${summary.rolledCharacteristics}/6 stats · ${summary.terms} terms`

    const owner = document.createElement('small')
    owner.textContent = summary.ownerId ? `by ${summary.ownerId}` : 'unowned'

    item.append(name, detail, owner)
    item.addEventListener('click', () => {
      openCharacterCreationFollow(summary.id, {
        readOnly: summary.ownerId !== actorId
      })
    })
    return item
  })
  list.append(...items)

  els.creationPresenceDock.hidden = false
  els.creationPresenceDock.replaceChildren(heading, list)
}

createPwaInstallController({
  elements: {
    prompt: els.pwaInstallPrompt,
    installButton: els.pwaInstallButton,
    dismissButton: els.pwaInstallDismissButton
  }
})

const requestId = createRequestIdFactory()

const clientIdentity = () => ({
  gameId: roomId,
  actorId
})

const creationPresenceDismissalStorageKey = () =>
  `cepheus-online:${roomId}:${actorId}:dismissed-creation-presence`

const hydrateDismissedCreationPresenceIds = () => {
  try {
    const rawValue = window.localStorage.getItem(
      creationPresenceDismissalStorageKey()
    )
    const ids = rawValue ? JSON.parse(rawValue) : []
    if (!Array.isArray(ids)) return
    dismissedCreationPresenceIds.clear()
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) {
        dismissedCreationPresenceIds.add(id)
      }
    }
  } catch {
    dismissedCreationPresenceIds.clear()
  }
}

const persistDismissedCreationPresenceIds = () => {
  try {
    window.localStorage.setItem(
      creationPresenceDismissalStorageKey(),
      JSON.stringify([...dismissedCreationPresenceIds])
    )
  } catch {
    // Local dismissal is a convenience; ignore storage failures.
  }
}

hydrateDismissedCreationPresenceIds()

const currentSelectedPieceId = () => appSession.snapshot().selectedPieceId

const selectPiece = (pieceId) => {
  selectedCharacterId = null
  appSession.selectPiece(pieceId)
}

const selectedCharacter = () =>
  selectedCharacterId ? (state?.characters[selectedCharacterId] ?? null) : null

const characterCreationStepOrder = [
  'basics',
  'characteristics',
  'homeworld',
  'career',
  'skills',
  'equipment',
  'review'
]

const characterCreationStepIndex = (step) =>
  characterCreationStepOrder.includes(step)
    ? characterCreationStepOrder.indexOf(step)
    : characterCreationStepOrder.length

const currentCharacterCreationProjection = () => {
  if (!characterCreationFlow) return null
  return (
    state?.characters?.[characterCreationFlow.draft.characterId]?.creation ??
    null
  )
}

const reconcileEditableCharacterCreationFlowWithProjection = () => {
  if (characterCreationReadOnly || !characterCreationFlow) return
  const creation = currentCharacterCreationProjection()
  if (!creation) return

  const projectedStep = creationStepFromStatus(creation.state.status)
  const projectedStepIndex = characterCreationStepIndex(projectedStep)
  const localStepIndex = characterCreationStepIndex(characterCreationFlow.step)
  const localCharacteristicsComplete = characterCreationCharacteristicKeys.every(
    (key) => characterCreationFlow.draft.characteristics[key] != null
  )
  const shouldSyncToProjection =
    projectedStepIndex < localStepIndex ||
    (projectedStepIndex > localStepIndex &&
      (characterCreationFlow.step !== 'characteristics' ||
        localCharacteristicsComplete)) ||
    (creation.state.status === 'SKILLS_TRAINING' &&
      JSON.stringify(creation.pendingCascadeSkills ?? []) !==
        JSON.stringify(characterCreationFlow.draft.pendingTermCascadeSkills)) ||
    (creation.state.status === 'BASIC_TRAINING' &&
      characterCreationFlow.step === 'career')

  if (shouldSyncToProjection) {
    syncCharacterCreationFlowFromRoomState(
      state,
      characterCreationFlow.draft.characterId,
      characterCreationFlow
    )
  }
}

const handleServerMessage = (message) => {
  const application = applyClientServerMessage(state, message)
  const liveActivityApplication = prepareLiveActivityApplication(application, {
    animatedDiceRollActivityIds,
    revealedDiceIds: diceRevealState.revealedDiceIds
  })
  const deferredStateRolls = application.shouldApplyState
    ? diceRollsForStateDeferral(
        application.state,
        liveActivityApplication.diceRollActivities
      )
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
  showCreationActivityCards(
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

const resolveDiceReveal = (rollId) => {
  diceRevealState.markRevealed(rollId)
}

const waitForDiceReveal = (roll) => {
  return diceRevealState.waitForReveal(roll)
}

const waitForDiceRevealOrDelay = (roll) => {
  const revealAtMs = Date.parse(roll?.revealAt ?? '')
  if (!Number.isFinite(revealAtMs)) return waitForDiceReveal(roll)
  const delayMs = Math.max(0, revealAtMs - Date.now()) + 220
  return Promise.race([
    waitForDiceReveal(roll),
    new Promise((resolve) => window.setTimeout(resolve, delayMs))
  ])
}

const diceRollsForStateDeferral = (nextState, diceRollActivities) => {
  if (!firstStateApplied) return []
  if (diceRollActivities.length > 0) return diceRollActivities

  const latestRoll = nextState?.diceLog?.[nextState.diceLog.length - 1] ?? null
  if (!latestRoll) return []
  if (latestRoll.id === latestDiceId) return []
  if (diceRevealState.isRevealed(latestRoll.id)) return []
  return [latestRoll]
}

const applyStateAfterDiceReveal = (nextState, diceRollActivities) => {
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

const commandRouter = createAppCommandRouter({
  getEventSeq: () => state?.eventSeq ?? null,
  createRequestId: (command) => requestId(command.type),
  submit: async ({ requestId, command }) => {
    const response = await postRoomCommand({
      roomId,
      requestId,
      command,
      actorSessionSecret
    })
    handleServerMessage(response.message)
    if (!response.ok) {
      throw new Error(response.message.error?.message || 'Command failed')
    }
    return response.message
  }
})

const postCommand = async (command, id = requestId(command.type)) => {
  return commandRouter.dispatch(command, { requestId: id })
}

const postBoardCommand = async (command, id = requestId(command.type)) => {
  return commandRouter.board.dispatch(command, { requestId: id })
}

const postDiceCommand = async (command, id = requestId(command.type)) => {
  return commandRouter.dice.dispatch(command, { requestId: id })
}

const postDoorCommand = async (command, id = requestId(command.type)) => {
  return commandRouter.door.dispatch(command, { requestId: id })
}

const postSheetCommand = async (command, id = requestId(command.type)) => {
  return commandRouter.sheet.dispatch(command, { requestId: id })
}

const postCharacterCreationCommand = async (
  command,
  id = requestId(command.type)
) => {
  return commandRouter.characterCreation.dispatch(command, { requestId: id })
}

const postCharacterCreationCommands = (commands) =>
  commandRouter.characterCreation.dispatchSequential(commands)

const ensureCharacterCreationPublishedNow = async () => {
  if (!characterCreationFlow || characterCreationReadOnly) return

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-character-creation')
    )
  }

  if (!state || !characterCreationFlow) return

  const characterId = characterCreationFlow.draft.characterId
  const character = state.characters[characterId] ?? null
  const commands = []

  if (!character) {
    commands.push(
      deriveCreateCharacterCommand(characterCreationFlow.draft, {
        identity: clientIdentity(),
        state: null
      })
    )
  }

  if (!character?.creation) {
    commands.push(
      deriveStartCharacterCreationCommand(characterCreationFlow.draft, {
        identity: clientIdentity(),
        state: null
      })
    )
  }

  if (commands.length > 0) {
    await postCharacterCreationCommands(commands)
  }
}

const ensureCharacterCreationPublished = () => {
  if (!characterCreationPublishPromise) {
    characterCreationPublishPromise = ensureCharacterCreationPublishedNow()
      .catch((error) => {
        setError(error.message)
        throw error
      })
      .finally(() => {
        characterCreationPublishPromise = null
      })
  }
  return characterCreationPublishPromise
}

const homeworldForCommand = (homeworld) => ({
  name: null,
  lawLevel: homeworld.lawLevel ?? null,
  tradeCodes: Array.isArray(homeworld.tradeCodes)
    ? [...homeworld.tradeCodes]
    : homeworld.tradeCodes
      ? [homeworld.tradeCodes]
      : []
})

const sameHomeworldCommandValue = (left, right) => {
  if (!left || !right) return false
  const leftTradeCodes = Array.isArray(left.tradeCodes)
    ? left.tradeCodes
    : left.tradeCodes
      ? [left.tradeCodes]
      : []
  const rightTradeCodes = Array.isArray(right.tradeCodes)
    ? right.tradeCodes
    : right.tradeCodes
      ? [right.tradeCodes]
      : []
  return (
    (left.name ?? null) === (right.name ?? null) &&
    (left.lawLevel ?? null) === (right.lawLevel ?? null) &&
    leftTradeCodes.length === rightTradeCodes.length &&
    leftTradeCodes.every((code, index) => code === rightTradeCodes[index])
  )
}

const projectedCharacterCreation = (characterId) =>
  state?.characters[characterId]?.creation ?? null

const syncCharacterCreationFlowFromRoomState = (
  roomState,
  characterId,
  fallbackFlow = null
) => {
  const projectedCharacter = roomState?.characters?.[characterId] ?? null
  const projectedFlow = projectedCharacter
    ? flowFromProjectedCharacter(projectedCharacter)
    : null
  characterCreationFlow = projectedFlow ?? fallbackFlow ?? characterCreationFlow
  return characterCreationFlow
}

const backgroundSkillAllowance = (edu) =>
  3 + (edu == null ? 0 : Math.floor(edu / 3) - 2)

const projectedHomeworldIsComplete = (creation, draft) =>
  Boolean(
    creation?.state.status === 'HOMEWORLD' &&
      (creation.pendingCascadeSkills ?? []).length === 0 &&
      (creation.backgroundSkills ?? []).length >=
        backgroundSkillAllowance(draft.characteristics.edu)
  )

const publishCharacterCreationHomeworldProgressNow = async (flow) => {
  if (characterCreationReadOnly || !flow || flow.step !== 'homeworld') return

  const { draft } = flow
  const homeworld = homeworldForCommand(draft.homeworld)
  if (!homeworld.lawLevel || homeworld.tradeCodes.length === 0) return

  await ensureCharacterCreationPublished()

  let creation = projectedCharacterCreation(draft.characterId)
  if (!creation || creation.state.status !== 'HOMEWORLD') return

  const baseCommand = {
    gameId: roomId,
    actorId,
    characterId: draft.characterId
  }

  if (!sameHomeworldCommandValue(creation.homeworld, homeworld)) {
    await postCharacterCreationCommand(
      {
        type: 'SetCharacterCreationHomeworld',
        ...baseCommand,
        homeworld
      },
      requestId('set-character-homeworld')
    )
    creation = projectedCharacterCreation(draft.characterId)
  }

  if (!creation || creation.state.status !== 'HOMEWORLD') return

  if (projectedHomeworldIsComplete(creation, draft)) {
    await postCharacterCreationCommand(
      {
        type: 'CompleteCharacterCreationHomeworld',
        ...baseCommand
      },
      requestId('complete-character-homeworld')
    )
    return
  }

  const projectedBackgroundSkills = new Set(creation.backgroundSkills ?? [])
  const projectedPendingCascadeSkills = new Set(
    creation.pendingCascadeSkills ?? []
  )
  for (const skill of draft.backgroundSkills) {
    if (projectedBackgroundSkills.has(skill)) continue
    if (projectedPendingCascadeSkills.has(skill)) continue
    await postCharacterCreationCommand(
      {
        type: 'SelectCharacterCreationBackgroundSkill',
        ...baseCommand,
        skill
      },
      requestId('select-character-background-skill')
    )
    creation = projectedCharacterCreation(draft.characterId)
    if (!creation || creation.state.status !== 'HOMEWORLD') return
    projectedBackgroundSkills.clear()
    for (const nextSkill of creation.backgroundSkills ?? []) {
      projectedBackgroundSkills.add(nextSkill)
    }
    projectedPendingCascadeSkills.clear()
    for (const nextSkill of creation.pendingCascadeSkills ?? []) {
      projectedPendingCascadeSkills.add(nextSkill)
    }
  }

  const validation = deriveCharacterCreationValidationSummary({
    ...flow,
    step: 'homeworld'
  })
  creation = projectedCharacterCreation(draft.characterId)
  if (
    validation.ok &&
    creation?.state.status === 'HOMEWORLD' &&
    (creation.pendingCascadeSkills ?? []).length === 0
  ) {
    await postCharacterCreationCommand(
      {
        type: 'CompleteCharacterCreationHomeworld',
        ...baseCommand
      },
      requestId('complete-character-homeworld')
    )
  }
}

const publishCharacterCreationHomeworldProgress = (flow) => {
  characterCreationHomeworldPublishPromise =
    characterCreationHomeworldPublishPromise
      .catch(() => {
        // Keep the queue alive after an earlier rejected command.
      })
      .then(() => publishCharacterCreationHomeworldProgressNow(flow))
      .catch((error) => setError(error.message))
  return characterCreationHomeworldPublishPromise
}

const publishCharacterCreationBackgroundCascadeSelection = (
  flow,
  skill
) => {
  characterCreationHomeworldPublishPromise =
    characterCreationHomeworldPublishPromise
      .catch(() => {
        // Keep the queue alive after an earlier rejected command.
      })
      .then(async () => {
        if (characterCreationReadOnly || !flow || flow.step !== 'homeworld') {
          return
        }
        await publishCharacterCreationHomeworldProgressNow(flow)
        const creation = projectedCharacterCreation(flow.draft.characterId)
        if (
          !creation ||
          creation.state.status !== 'HOMEWORLD' ||
          (creation.pendingCascadeSkills ?? []).includes(skill)
        ) {
          return
        }
        await postCharacterCreationCommand(
          {
            type: 'SelectCharacterCreationBackgroundSkill',
            gameId: roomId,
            actorId,
            characterId: flow.draft.characterId,
            skill
          },
          requestId('select-character-background-cascade')
        )
      })
      .catch((error) => setError(error.message))
  return characterCreationHomeworldPublishPromise
}

const publishCharacterCreationCascadeResolution = (
  flow,
  cascadeSkill,
  selection
) => {
  characterCreationHomeworldPublishPromise =
    characterCreationHomeworldPublishPromise
      .catch(() => {
        // Keep the queue alive after an earlier rejected command.
      })
      .then(async () => {
        if (characterCreationReadOnly || !flow || flow.step !== 'homeworld') {
          return
        }
        await ensureCharacterCreationPublished()
        const creation = projectedCharacterCreation(flow.draft.characterId)
        if (
          !creation ||
          creation.state.status !== 'HOMEWORLD' ||
          !(creation.pendingCascadeSkills ?? []).includes(cascadeSkill)
        ) {
          return
        }
        await postCharacterCreationCommand(
          {
            type: 'ResolveCharacterCreationCascadeSkill',
            gameId: roomId,
            actorId,
            characterId: flow.draft.characterId,
            cascadeSkill,
            selection
          },
          requestId('resolve-character-background-cascade')
        )
        await publishCharacterCreationHomeworldProgressNow(flow)
      })
      .catch((error) => setError(error.message))
  return characterCreationHomeworldPublishPromise
}

const publishCharacterCreationTermCascadeResolution = async (
  flow,
  cascadeSkill,
  selection,
  fallbackFlow
) => {
  if (characterCreationReadOnly || !flow || flow.step !== 'career') return
  await ensureCharacterCreationPublished()
  const response = await postCharacterCreationCommand(
    {
      type: 'ResolveCharacterCreationTermCascadeSkill',
      gameId: roomId,
      actorId,
      characterId: flow.draft.characterId,
      cascadeSkill,
      selection
    },
    requestId('resolve-character-term-cascade')
  )
  syncCharacterCreationFlowFromRoomState(
    response.state,
    flow.draft.characterId,
    fallbackFlow
  )
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

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

const characterCreationSeed = () => ({
  name: '',
  equipment: [],
  credits: 0,
  notes: ''
})

const creationStepFromStatus = (status) => {
  switch (status) {
    case 'CHARACTERISTICS':
      return 'characteristics'
    case 'HOMEWORLD':
      return 'homeworld'
    case 'BASIC_TRAINING':
      return 'skills'
    case 'PLAYABLE':
      return 'review'
    default:
      return 'career'
  }
}

const completedTermFromProjection = (term) => ({
  career: term.career,
  drafted: term.draft === 1,
  anagathics: term.anagathics,
  age: null,
  rank: null,
  qualificationRoll: null,
  survivalRoll: term.survival ?? null,
  survivalPassed: term.survival == null ? true : term.complete,
  canCommission: false,
  commissionRoll: null,
  commissionPassed: null,
  canAdvance: false,
  advancementRoll: term.advancement ?? null,
  advancementPassed: term.advancement == null ? null : term.complete,
  termSkillRolls: term.skillsAndTraining.map((skill) => ({
    table: 'serviceSkills',
    roll: 0,
    skill
  })),
  reenlistmentRoll: term.reEnlistment ?? null,
  reenlistmentOutcome: term.canReenlist ? 'allowed' : 'blocked'
})

const careerPlanFromProjection = (creation) => {
  const activeTerm = [...creation.terms]
    .reverse()
    .find((term) => !term.complete && !term.musteringOut)
  if (!activeTerm) return null

  const history = creation.history ?? []
  let selectCareerIndex = -1
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].type === 'SELECT_CAREER') {
      selectCareerIndex = index
      break
    }
  }
  const currentTermHistory =
    selectCareerIndex >= 0 ? history.slice(selectCareerIndex) : history
  const selectCareer = [...currentTermHistory]
    .reverse()
    .find((event) => event.type === 'SELECT_CAREER')
  const survival = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'SURVIVAL_PASSED' || event.type === 'SURVIVAL_FAILED'
    )
  const commission = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'COMPLETE_COMMISSION' ||
        event.type === 'SKIP_COMMISSION'
    )
  const advancement = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'COMPLETE_ADVANCEMENT' ||
        event.type === 'SKIP_ADVANCEMENT'
    )
  const aging = [...currentTermHistory]
    .reverse()
    .find((event) => event.type === 'COMPLETE_AGING')
  const reenlistment = [...currentTermHistory]
    .reverse()
    .find(
      (event) =>
        event.type === 'RESOLVE_REENLISTMENT' ||
        event.type === 'REENLIST' ||
        event.type === 'REENLIST_BLOCKED' ||
        event.type === 'FORCED_REENLIST'
    )
  const termSkillRolls = currentTermHistory
    .filter((event) => event.type === 'ROLL_TERM_SKILL')
    .map((event) => ({
      table: event.termSkill.table,
      roll: event.termSkill.roll.total,
      skill: event.termSkill.skill ?? event.termSkill.rawSkill
    }))

  return {
    career: activeTerm.career,
    qualificationRoll: selectCareer?.qualification?.total ?? null,
    qualificationPassed: true,
    survivalRoll: survival?.survival?.total ?? activeTerm.survival ?? null,
    survivalPassed:
      survival?.type === 'SURVIVAL_PASSED'
        ? true
        : survival?.type === 'SURVIVAL_FAILED'
          ? false
          : null,
    commissionRoll:
      commission?.type === 'SKIP_COMMISSION'
        ? -1
        : (commission?.commission?.total ?? null),
    commissionPassed:
      commission?.type === 'SKIP_COMMISSION'
        ? false
        : (commission?.commission?.success ?? null),
    advancementRoll:
      advancement?.type === 'SKIP_ADVANCEMENT'
        ? -1
        : (advancement?.advancement?.total ?? activeTerm.advancement ?? null),
    advancementPassed:
      advancement?.type === 'SKIP_ADVANCEMENT'
        ? false
        : (advancement?.advancement?.success ?? null),
    canCommission: creation.state.context?.canCommission ?? null,
    canAdvance: creation.state.context?.canAdvance ?? null,
    drafted: activeTerm.draft === 1,
    rank: null,
    rankTitle: null,
    rankBonusSkill: null,
    termSkillRolls,
    anagathics: activeTerm.anagathics ?? null,
    agingRoll: aging?.aging?.roll?.total ?? null,
    agingMessage:
      aging?.aging?.characteristicChanges?.length > 0
        ? `${aging.aging.characteristicChanges.length} characteristic changes`
        : aging?.aging
          ? 'No aging effects.'
          : null,
    agingSelections: [],
    reenlistmentRoll:
      reenlistment?.reenlistment?.total ?? activeTerm.reEnlistment ?? null,
    reenlistmentOutcome:
      reenlistment?.type === 'RESOLVE_REENLISTMENT'
        ? (reenlistment.reenlistment.outcome ?? null)
        : reenlistment?.type === 'FORCED_REENLIST'
        ? 'forced'
        : reenlistment?.type === 'REENLIST'
          ? 'allowed'
          : reenlistment?.type === 'REENLIST_BLOCKED'
            ? 'blocked'
            : null
  }
}

const flowFromProjectedCharacter = (character) => {
  const creation = character.creation
  if (!creation) return null

  const completedTerms = creation.terms
    .filter((term) => term.complete || term.musteringOut)
    .map(completedTermFromProjection)

  return {
    step: creationStepFromStatus(creation.state.status),
    draft: createInitialCharacterDraft(character.id, {
      name: character.name,
      characterType: character.type,
      age: character.age,
      characteristics: character.characteristics,
      homeworld: creation.homeworld ?? undefined,
      backgroundSkills: creation.backgroundSkills ?? [],
      pendingCascadeSkills:
        creation.state.status === 'HOMEWORLD'
          ? (creation.pendingCascadeSkills ?? [])
          : [],
      pendingTermCascadeSkills:
        creation.state.status === 'SKILLS_TRAINING'
          ? (creation.pendingCascadeSkills ?? [])
          : [],
      pendingAgingChanges: creation.characteristicChanges ?? [],
      careerPlan: careerPlanFromProjection(creation),
      completedTerms,
      skills: character.skills,
      equipment: character.equipment,
      credits: character.credits,
      notes: character.notes
    })
  }
}

const openCharacterCreationFollow = (characterId, { readOnly = true } = {}) => {
  const character = state?.characters[characterId] ?? null
  const flow = character ? flowFromProjectedCharacter(character) : null
  if (!flow) return

  selectedCharacterId = characterId
  characterCreationFlow = flow
  characterCreationReadOnly = readOnly
  if (!readOnly) {
    characterSheetController.setOpen(false)
  }
  characterCreationPanel.open()
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const refreshFollowedCharacterCreationFlow = () => {
  if (!characterCreationReadOnly || !selectedCharacterId) return false

  const character = state?.characters[selectedCharacterId] ?? null
  const flow = character ? flowFromProjectedCharacter(character) : null
  if (!flow) {
    characterCreationFlow = null
    characterCreationReadOnly = false
    characterCreationPanel.close()
    return false
  }

  characterCreationFlow = flow
  return characterCreationPanel.isOpen()
}

const shouldRefreshEditableCharacterCreationFlow = ({
  deferFollowedCreationRolls = []
} = {}) =>
  !characterCreationReadOnly &&
  characterCreationPanel.isOpen() &&
  Boolean(characterCreationFlow) &&
  deferFollowedCreationRolls.length === 0

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

const startCharacterCreationWizard = () => {
  characterCreationReadOnly = false
  if (!characterCreationPanel.isOpen()) characterCreationPanel.show()
  if (characterCreationFlow) {
    renderCharacterCreationWizard()
    characterCreationPanel.scrollToTop()
    return
  }
  const seed = characterCreationSeed()
  const flow = createManualCharacterCreationFlow({
    state,
    name: seed.name || null,
    characterType: 'PLAYER'
  })
  characterCreationFlow = {
    ...flow,
    draft: {
      ...flow.draft,
      name: seed.name || flow.draft.name,
      credits: seed.credits,
      equipment: seed.equipment,
      notes: seed.notes
    }
  }
  characterCreationFlow = nextCharacterCreationWizardStep(
    characterCreationFlow
  ).flow
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const startNewCharacterCreationWizard = async () => {
  characterCreationFlow = null
  characterCreationReadOnly = false
  selectedCharacterId = null
  selectPiece(null)
  characterSheetController.setOpen(false)
  characterCreationPanel.open()
  startCharacterCreationWizard()
  await ensureCharacterCreationPublished()
}

const autoAdvanceCharacterCreationSetup = () => {
  if (characterCreationReadOnly) return false
  if (!characterCreationFlow) return false
  if (
    !['basics', 'characteristics', 'homeworld'].includes(
      characterCreationFlow.step
    )
  ) {
    return false
  }
  if (
    characterCreationFlow.step === 'homeworld' &&
    characterCreationStepIndex(
      creationStepFromStatus(
        currentCharacterCreationProjection()?.state.status ?? 'HOMEWORLD'
      )
    ) <= characterCreationStepIndex('homeworld')
  ) {
    const validation = deriveCharacterCreationValidationSummary(
      characterCreationFlow
    )
    if (validation.ok) {
      publishCharacterCreationHomeworldProgress(characterCreationFlow)
    }
    return false
  }

  const result = nextCharacterCreationWizardStep(characterCreationFlow)
  if (!result.moved) return false
  characterCreationFlow = result.flow
  return true
}

const syncCharacterCreationWizardFields = () => {
  if (!characterCreationFlow) return

  const values = {}
  for (const field of els.characterCreationFields.querySelectorAll(
    '[data-character-creation-field]'
  )) {
    values[field.dataset.characterCreationField] = field.value
  }
  characterCreationFlow = applyParsedCharacterCreationDraftPatch(
    characterCreationFlow,
    parseCharacterCreationDraftPatch(values)
  ).flow
}

const renderCharacterCreationWizardControls = () => {
  els.backCharacterWizard.disabled = true
  els.nextCharacterWizard.disabled = true
  els.backCharacterWizard.hidden = true
  els.nextCharacterWizard.hidden = true
  if (els.creatorActions) els.creatorActions.hidden = true

  els.characterCreationStatus.replaceChildren()
}

const renderCharacterCreationWizard = () => {
  reconcileEditableCharacterCreationFlowWithProjection()
  while (autoAdvanceCharacterCreationSetup()) {
    // Keep setup steps linear even when reopening a flow that is already valid.
  }

  if (!characterCreationPanel.render(characterCreationFlow)) return

  const flow = characterCreationFlow
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
    characterCreationReadOnly
  )
  if (characterCreationReadOnly) {
    for (const control of els.characterCreationFields.querySelectorAll(
      'button, input, select, textarea'
    )) {
      control.disabled = true
    }
  }
  renderCharacterCreationWizardControls()
}

const renderCharacterCreationNextStep = (flow) => {
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
    panel.append(renderCharacterCreationCascadeChoice(viewModel.blockingChoice))
  }
  if (!['characteristics', 'homeworld'].includes(flow.step)) {
    panel.append(stats)
  }
  if (actions.childElementCount > 0) panel.append(actions)
  return panel
}

const renderCharacterCreationFields = (flow) => {
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

const renderCharacterCreationDeath = (flow) => {
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
  if (!characterCreationReadOnly) {
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

const renderCharacterCreationHomeworld = (flow) => {
  const viewModel = deriveCharacterCreationHomeworldViewModel(flow)
  const wrapper = document.createElement('div')
  wrapper.className = 'creation-homeworld'

  const fieldGrid = document.createElement('div')
  fieldGrid.className = 'creation-homeworld-fields'

  const lawField = viewModel.fields.find(
    (field) => field.key === 'homeworld.lawLevel'
  )
  const tradeField = viewModel.fields.find(
    (field) => field.key === 'homeworld.tradeCodes'
  )

  if (lawField) {
    fieldGrid.append(
      renderCharacterCreationOptionField(lawField, viewModel.lawLevelOptions)
    )
  }
  if (tradeField) {
    fieldGrid.append(
      renderCharacterCreationOptionField(tradeField, viewModel.tradeCodeOptions)
    )
  }

  const summary = document.createElement('div')
  summary.className = 'creation-homeworld-summary'
  const title = document.createElement('strong')
  title.textContent = 'Background skills'
  const detail = document.createElement('p')
  const selectedCount =
    viewModel.backgroundSkills.selectedSkills.length +
    viewModel.backgroundSkills.pendingCascadeSkills.length
  const remaining = viewModel.backgroundSkills.remainingSelections
  const grantedCount = viewModel.backgroundSkills.skillOptions.filter(
    (option) => option.preselected
  ).length
  const pendingCascadeCount =
    viewModel.backgroundSkills.cascadeSkillChoices.length
  detail.textContent =
    pendingCascadeCount > 0
      ? `Choose ${pendingCascadeCount === 1 ? 'a specialty' : 'specialties'} for the granted cascade skill.`
      : remaining > 0
        ? `${selectedCount}/${viewModel.backgroundSkills.allowance} selected. Choose ${remaining} more.`
        : `${selectedCount}/${viewModel.backgroundSkills.allowance} selected. ${
            grantedCount > 0 ? `${grantedCount} granted by homeworld.` : ''
          }`
  const skillList = renderCharacterCreationBackgroundSkills(viewModel)

  summary.append(title, detail)
  summary.append(skillList)
  wrapper.append(fieldGrid, summary)
  return wrapper
}

const bindCharacterCreationActionButton = (button, callback) => {
  let active = false
  const run = (event) => {
    event.preventDefault()
    if (active) return
    active = true
    const priorDisabled = 'disabled' in button ? button.disabled : null
    if ('disabled' in button) {
      button.disabled = true
    }
    Promise.resolve(callback()).finally(() => {
      active = false
      if ('disabled' in button) {
        button.disabled = priorDisabled ?? false
      }
    })
  }
  button.addEventListener('pointerdown', run)
  button.addEventListener('click', run)
}

const renderCharacterCreationTermSkillTables = (flow) => {
  const viewModel = deriveCharacterCreationTermSkillTrainingViewModel(flow)
  if (!viewModel) return document.createDocumentFragment()

  const panel = document.createElement('div')
  panel.className = 'creation-term-skills'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const text = document.createElement('p')
  text.textContent = viewModel.prompt
  const progress = document.createElement('div')
  progress.className = 'creation-term-skill-progress'
  progress.textContent = `${viewModel.required - viewModel.remaining}/${viewModel.required} rolled`
  const rolled = document.createElement('div')
  rolled.className = 'creation-term-skill-rolls'
  for (const roll of viewModel.rolled) {
    const chip = document.createElement('span')
    const label = document.createElement('b')
    label.textContent = roll.label
    const detail = document.createElement('small')
    detail.textContent = roll.detail
    chip.append(label, detail)
    rolled.append(chip)
  }
  const buttons = document.createElement('div')
  buttons.className = 'creation-term-actions'

  for (const action of viewModel.actions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = action.label
    button.title = action.reason
    button.disabled = action.disabled
    bindCharacterCreationActionButton(button, () =>
      rollCharacterCreationTermSkill(action.table).catch((error) =>
        setError(error.message)
      )
    )
    buttons.append(button)
  }

  panel.classList.toggle('complete', !viewModel.open)
  panel.append(title, text, progress)
  if (rolled.childElementCount > 0) panel.append(rolled)
  if (buttons.childElementCount > 0) panel.append(buttons)
  return panel
}

const renderCharacterCreationReenlistmentRollButton = (flow) => {
  const action = deriveNextCharacterCreationReenlistmentRoll(flow)
  if (!action) return null

  const panel = document.createElement('div')
  panel.className = 'creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = action.label
  bindCharacterCreationActionButton(button, () =>
    rollCharacterCreationReenlistment().catch((error) =>
      setError(error.message)
    )
  )
  const note = document.createElement('small')
  note.textContent = action.reason
  panel.append(button, note)
  return panel
}

const renderCharacterCreationAgingRollButton = (flow) => {
  const action = deriveNextCharacterCreationAgingRoll(flow)
  if (!action) return null

  const panel = document.createElement('div')
  panel.className = 'creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = action.label
  bindCharacterCreationActionButton(button, () =>
    rollCharacterCreationAging().catch((error) => setError(error.message))
  )
  const note = document.createElement('small')
  const modifier = action.modifier === 0 ? '' : ` (${action.modifier})`
  note.textContent = `${action.reason}${modifier}`
  panel.append(button, note)
  return panel
}

const renderCharacterCreationAgingChoices = (flow) => {
  const changes = deriveCharacterCreationAgingChangeOptions(flow)
  if (changes.length === 0) return document.createDocumentFragment()

  const panel = document.createElement('div')
  panel.className = 'creation-term-skills'
  const title = document.createElement('strong')
  title.textContent = 'Aging effects'
  const text = document.createElement('p')
  text.textContent = 'Choose where each aging effect applies.'
  panel.append(title, text)

  for (const change of changes) {
    const row = document.createElement('div')
    row.className = 'creation-term-actions'
    const label = document.createElement('small')
    label.textContent = `${change.type.toLowerCase()} ${change.modifier}`
    row.append(label)
    for (const option of change.options) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option.toUpperCase()
      button.addEventListener('click', () => {
        if (!characterCreationFlow) return
        characterCreationFlow = applyCharacterCreationAgingChange({
          flow: characterCreationFlow,
          index: change.index,
          characteristic: option
        }).flow
        setError('')
        renderCharacterCreationWizard()
      })
      row.append(button)
    }
    panel.append(row)
  }

  return panel
}

const renderCharacterCreationAnagathicsDecision = (flow) => {
  const decision = deriveCharacterCreationAnagathicsDecision(flow)
  if (!decision) return document.createDocumentFragment()

  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'
  const title = document.createElement('strong')
  title.textContent = 'Anagathics'
  const text = document.createElement('p')
  text.textContent =
    'Choose whether this term used anagathics before aging and reenlistment.'
  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  const use = document.createElement('button')
  use.type = 'button'
  use.textContent = 'Use anagathics'
  use.title = decision.reason
  use.addEventListener('click', () => {
    if (!characterCreationFlow) return
    characterCreationFlow = applyCharacterCreationAnagathicsDecision({
      flow: characterCreationFlow,
      useAnagathics: true
    }).flow
    setError('')
    renderCharacterCreationWizard()
    characterCreationPanel.scrollToTop()
  })

  const skip = document.createElement('button')
  skip.type = 'button'
  skip.textContent = 'Skip'
  skip.addEventListener('click', () => {
    if (!characterCreationFlow) return
    characterCreationFlow = applyCharacterCreationAnagathicsDecision({
      flow: characterCreationFlow,
      useAnagathics: false
    }).flow
    setError('')
    renderCharacterCreationWizard()
    characterCreationPanel.scrollToTop()
  })

  actions.append(use, skip)
  panel.append(title, text, actions)
  return panel
}

const reenlistmentOutcomeText = (plan) => {
  if (plan?.reenlistmentOutcome === 'forced') {
    return `Reenlistment ${plan.reenlistmentRoll}: mandatory reenlistment.`
  }
  if (plan?.reenlistmentOutcome === 'allowed') {
    return `Reenlistment ${plan.reenlistmentRoll}: may reenlist or muster out.`
  }
  if (plan?.reenlistmentOutcome === 'blocked') {
    return `Reenlistment ${plan.reenlistmentRoll}: must muster out.`
  }
  if (plan?.reenlistmentOutcome === 'retire') {
    return 'Seven terms served: must retire and muster out.'
  }
  return 'Roll reenlistment before deciding what happens next.'
}

const renderCharacterCreationTermCascadeChoices = (flow) => {
  if (flow.draft.pendingTermCascadeSkills.length === 0) {
    return document.createDocumentFragment()
  }

  const panel = document.createElement('div')
  panel.className = 'creation-term-skills'
  const title = document.createElement('strong')
  title.textContent = 'Choose a specialty'
  const text = document.createElement('p')
  text.textContent = 'Resolve the rolled cascade skill before continuing.'
  panel.append(title, text)

  for (const cascade of deriveCharacterCreationCascadeSkillChoiceViewModels(
    flow.draft.pendingTermCascadeSkills
  )) {
    panel.append(renderCharacterCreationCascadeChoice(cascade, 'term'))
  }

  return panel
}

const renderCharacterCreationBackgroundSkills = (viewModel) => {
  const list = document.createElement('div')
  list.className = 'creation-background-options'
  const remaining = viewModel.backgroundSkills.remainingSelections

  for (const option of viewModel.backgroundSkills.skillOptions) {
    const button = document.createElement('button')
    button.type = 'button'
    const unavailable = !option.selected && remaining <= 0
    button.className = [
      option.selected ? 'selected' : '',
      option.preselected ? 'preselected' : '',
      unavailable ? 'unavailable' : ''
    ]
      .filter(Boolean)
      .join(' ')
    button.textContent = option.label
    button.disabled = option.preselected || unavailable
    button.title = option.preselected
      ? 'Granted by homeworld'
      : option.selected
        ? 'Remove selection'
        : option.cascade
          ? 'Select, then choose a specialty'
          : 'Select background skill'
    button.addEventListener('click', () => {
      if (!characterCreationFlow) return
      syncCharacterCreationWizardFields()
      const wasSelected = option.selected
      characterCreationFlow = {
        ...characterCreationFlow,
        draft: wasSelected
          ? removeCharacterCreationBackgroundSkillSelection(
              characterCreationFlow.draft,
              option.label
            )
          : applyCharacterCreationBackgroundSkillSelection(
              characterCreationFlow.draft,
              option.label
            )
      }
      setError('')
      const nextFlow = characterCreationFlow
      renderCharacterCreationWizard()
      if (!wasSelected) {
        if (option.cascade) {
          publishCharacterCreationBackgroundCascadeSelection(
            nextFlow,
            option.label
          )
        } else {
          publishCharacterCreationHomeworldProgress(nextFlow)
        }
      }
    })
    list.append(button)
  }

  return list
}

const renderCharacterCreationCascadeChoice = (
  cascade,
  scope = 'background'
) => {
  const panel = document.createElement('div')
  panel.className = 'creation-cascade-choice'
  const title = document.createElement('strong')
  title.textContent = cascade.title || `${cascade.label}-${cascade.level}`
  const options = document.createElement('div')
  options.className = 'creation-background-options'

  if (cascade.prompt) {
    const prompt = document.createElement('p')
    prompt.textContent = cascade.prompt
    panel.append(title, prompt)
  } else {
    panel.append(title)
  }

  for (const option of cascade.options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = option.label
    button.title = option.cascade
      ? 'This opens another cascade choice'
      : 'Resolve cascade skill'
    button.addEventListener('click', () => {
      if (!characterCreationFlow) return
      syncCharacterCreationWizardFields()
      characterCreationFlow =
        scope === 'term'
          ? resolveCharacterCreationTermCascadeSkill({
              flow: characterCreationFlow,
              cascadeSkill: cascade.cascadeSkill,
              selection: option.label
            }).flow
          : {
              ...characterCreationFlow,
              draft: resolveCharacterCreationCascadeSkill({
                draft: characterCreationFlow.draft,
                cascadeSkill: cascade.cascadeSkill,
                selection: option.label
              })
            }
      setError('')
      const nextFlow = characterCreationFlow
      renderCharacterCreationWizard()
      if (scope === 'term') {
        publishCharacterCreationTermCascadeResolution(
          flow,
          cascade.cascadeSkill,
          option.label,
          nextFlow
        ).catch((error) => setError(error.message))
      } else {
        publishCharacterCreationCascadeResolution(
          nextFlow,
          cascade.cascadeSkill,
          option.label
        )
      }
    })
    options.append(button)
  }

  panel.append(options)
  return panel
}

const renderCharacterCreationOptionField = (field, options) => {
  const label = document.createElement('label')
  label.className = `character-creation-field ${field.kind}`
  const name = document.createElement('span')
  name.textContent = field.required ? `${field.label} *` : field.label
  const control = document.createElement('select')
  control.dataset.characterCreationField = field.key
  control.autocomplete = 'off'

  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = `Select ${field.label.toLowerCase()}`
  control.append(empty)

  for (const option of options) {
    const item = document.createElement('option')
    item.value = option.value
    item.textContent = option.label
    item.selected = option.selected
    control.append(item)
  }

  label.append(name, control)
  if (field.errors.length > 0) {
    const error = document.createElement('small')
    error.textContent = field.errors
      .map((message) => message.replace(/^Homeworld /, ''))
      .join(', ')
    label.append(error)
  }
  return label
}

const characteristicModifierLabel = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  const modifier = Math.floor(number / 3) - 2
  if (modifier === 0) return ''
  return modifier > 0 ? `+${modifier}` : String(modifier)
}

const renderCharacterCreationCharacteristicGrid = (flow) => {
  const fields = deriveCharacterCreationFieldViewModels(flow)
  const grid = document.createElement('div')
  grid.className = 'creation-stat-grid dice-stat-grid'
  for (const field of fields) {
    const cell = document.createElement('div')
    cell.className = 'creation-stat-cell dice-stat-cell'
    const name = document.createElement('span')
    name.textContent = field.label
    const row = document.createElement('span')
    row.className = 'creation-stat-value-row'
    const modifier = document.createElement('small')
    if (field.value === '' || field.value === null) {
      const rollButton = document.createElement('button')
      rollButton.type = 'button'
      rollButton.className = 'stat-die-button'
      rollButton.setAttribute('aria-label', `Roll ${field.label}`)
      rollButton.title = `Roll ${field.label}`
      for (let index = 0; index < 5; index += 1) {
        const pip = document.createElement('span')
        pip.className = 'stat-die-pip'
        rollButton.append(pip)
      }
      bindCharacterCreationActionButton(rollButton, () =>
        rollCharacterCreationCharacteristic(field.key).catch((error) =>
          setError(error.message)
        )
      )
      modifier.textContent = ''
      row.append(rollButton, modifier)
    } else {
      const value = document.createElement('strong')
      value.textContent = field.value
      modifier.textContent = characteristicModifierLabel(field.value)
      row.append(value, modifier)
    }
    cell.append(name, row)
    if (field.errors.length > 0 && field.value !== '') {
      const error = document.createElement('small')
      error.className = 'creation-stat-error'
      error.textContent = field.errors.join(', ')
      cell.append(error)
    }
    grid.append(cell)
  }
  return grid
}

const formatCareerCheckShort = (check) => {
  if (!check.available) return 'Unavailable'
  const modifier =
    check.modifier === 0
      ? ''
      : check.modifier > 0
        ? ` +${check.modifier}`
        : ` ${check.modifier}`
  return `${check.requirement}${modifier}`
}

const careerOutcomeText = (plan) => {
  if (!plan?.career) return 'Select a career to attempt qualification.'
  if (plan.drafted && plan.survivalRoll === null) {
    return `Drafted into ${plan.career}: ready to roll survival.`
  }
  const lines = []
  if (plan.qualificationRoll !== null) {
    lines.push(
      `Qualification ${plan.qualificationRoll}: ${
        plan.qualificationPassed ? 'accepted' : 'rejected'
      }`
    )
  }
  if (plan.survivalRoll !== null) {
    lines.push(
      `Survival ${plan.survivalRoll}: ${
        plan.survivalPassed ? 'survived' : 'mishap'
      }`
    )
  }
  if (plan.commissionRoll !== null) {
    lines.push(
      plan.commissionRoll === -1
        ? 'Commission skipped'
        : `Commission ${plan.commissionRoll}: ${
            plan.commissionPassed ? 'commissioned' : 'not commissioned'
          }`
    )
  }
  if (plan.advancementRoll !== null) {
    lines.push(
      plan.advancementRoll === -1
        ? 'Advancement skipped'
        : `Advancement ${plan.advancementRoll}: ${
            plan.advancementPassed ? 'advanced' : 'held rank'
          }`
    )
  }
  if (plan.agingRoll != null) {
    lines.push(`Aging ${plan.agingRoll}: ${plan.agingMessage ?? 'resolved'}`)
  }
  if (plan.reenlistmentOutcome) {
    lines.push(reenlistmentOutcomeText(plan))
  }
  return lines.join(' | ') || `${plan.career}: ready to roll qualification.`
}

const renderCharacterCreationCareerPicker = (flow) => {
  const wrapper = document.createElement('div')
  wrapper.className = 'creation-career-picker'

  const plan = flow.draft.careerPlan
  for (const [key, value] of Object.entries({
    career: plan?.career ?? '',
    drafted: plan?.drafted ? 'true' : 'false',
    qualificationPassed:
      plan?.qualificationPassed === null ||
      plan?.qualificationPassed === undefined
        ? ''
        : String(plan.qualificationPassed),
    qualificationRoll: plan?.qualificationRoll ?? '',
    survivalRoll: plan?.survivalRoll ?? '',
    commissionRoll: plan?.commissionRoll ?? '',
    advancementRoll: plan?.advancementRoll ?? ''
  })) {
    const hidden = document.createElement('input')
    hidden.type = 'hidden'
    hidden.dataset.characterCreationField = key
    hidden.value = value === null ? '' : String(value)
    wrapper.append(hidden)
  }

  const outcome = document.createElement('div')
  outcome.className = 'creation-career-outcome'
  const outcomeTitle = document.createElement('strong')
  outcomeTitle.textContent = plan?.career
    ? `${plan.career} term`
    : 'Choose a career'
  const outcomeBody = document.createElement('p')
  outcomeBody.textContent = careerOutcomeText(plan)
  outcome.append(outcomeTitle, outcomeBody)
  wrapper.append(outcome)

  if (plan?.qualificationPassed === false && !plan.drafted) {
    wrapper.append(renderCharacterCreationDraftFallback(flow))
  }

  const shouldShowCareerList = !plan?.career
  if (shouldShowCareerList) {
    const list = document.createElement('div')
    list.className = 'creation-career-list'
    for (const career of deriveCharacterCreationCareerOptionViewModels(
      flow.draft
    )) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = career.selected ? 'selected' : ''
      button.setAttribute('aria-pressed', career.selected ? 'true' : 'false')
      const title = document.createElement('span')
      title.className = 'creation-career-title'
      title.textContent = career.label
      const qualification = document.createElement('span')
      qualification.className = 'creation-career-check'
      qualification.textContent = `Qualify ${formatCareerCheckShort(career.qualification)}`
      const survival = document.createElement('span')
      survival.className = 'creation-career-check'
      survival.textContent = `Survive ${formatCareerCheckShort(career.survival)}`
      button.append(title, qualification, survival)
      button.addEventListener('click', () => {
        resolveCharacterCreationCareerQualification(career.key).catch(
          (error) => setError(error.message)
        )
      })
      list.append(button)
    }
    wrapper.append(list)
  }
  return wrapper
}

const renderCharacterCreationTermResolution = (flow) => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'
  const plan = flow.draft.careerPlan
  const title = document.createElement('strong')
  title.textContent = 'Career term'
  const text = document.createElement('p')

  if (!plan?.career) {
    return document.createDocumentFragment()
  }

  if (!isCharacterCreationCareerTermResolved(flow.draft)) {
    text.textContent = 'Roll each required check. The next roll appears above.'
    panel.append(title, text)
    return panel
  }

  if (deriveCharacterCreationTermSkillTableActions(flow).length > 0) {
    text.textContent =
      'Roll this term’s skills before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (flow.draft.pendingTermCascadeSkills.length > 0) {
    text.textContent =
      'Choose the rolled skill specialty before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (deriveCharacterCreationAnagathicsDecision(flow)) {
    text.textContent =
      'Decide whether this term used anagathics before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (deriveNextCharacterCreationAgingRoll(flow)) {
    text.textContent = 'Roll aging before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (flow.draft.pendingAgingChanges.length > 0) {
    text.textContent = 'Apply aging effects before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (plan.survivalPassed === true && !plan.reenlistmentOutcome) {
    text.textContent = 'Roll reenlistment before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  const survived = plan.survivalPassed === true
  if (!survived) {
    text.textContent =
      'Killed in service. This character cannot muster out or become playable.'
    panel.append(title, text)
    return panel
  }

  text.textContent = reenlistmentOutcomeText(plan)
  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  if (
    survived &&
    (plan.reenlistmentOutcome === 'allowed' ||
      plan.reenlistmentOutcome === 'forced')
  ) {
    const another = document.createElement('button')
    another.type = 'button'
    another.textContent =
      plan.reenlistmentOutcome === 'forced'
        ? 'Serve required term'
        : 'Serve another term'
    another.addEventListener('click', () => {
      if (!characterCreationFlow) return
      characterCreationFlow = completeCharacterCreationCareerTerm({
        flow: characterCreationFlow,
        continueCareer: true
      }).flow
      setError('')
      renderCharacterCreationWizard()
      characterCreationPanel.scrollToTop()
    })
    actions.append(another)
  }

  const muster = document.createElement('button')
  muster.type = 'button'
  muster.textContent = 'Muster out'
  muster.addEventListener('click', () => {
    if (!characterCreationFlow) return
    characterCreationFlow = completeCharacterCreationCareerTerm({
      flow: characterCreationFlow,
      continueCareer: false
    }).flow
    setError('')
    renderCharacterCreationWizard()
    characterCreationPanel.scrollToTop()
  })
  actions.append(muster)

  panel.append(title, text, actions)
  return panel
}

const termSummary = (term, index) => {
  const result = term.survivalPassed ? 'survived' : 'killed in service'
  const commission =
    term.commissionRoll === null
      ? ''
      : term.commissionRoll === -1
        ? ', skipped commission'
        : term.commissionPassed
          ? ', commissioned'
          : ', no commission'
  const advancement =
    term.advancementRoll === null
      ? ''
      : term.advancementRoll === -1
        ? ', skipped advancement'
        : term.advancementPassed
          ? ', advanced'
          : ', held rank'
  const rank = term.rankTitle ? `, rank ${term.rankTitle}` : ''
  const bonusSkill = term.rankBonusSkill
    ? `; rank skill ${term.rankBonusSkill}`
    : ''
  const training =
    term.termSkillRolls?.length > 0
      ? `; training ${term.termSkillRolls
          .map((roll) => `${roll.skill} (${roll.roll})`)
          .join(', ')}`
      : ''
  const aging =
    term.agingRoll != null
      ? `; aging ${term.agingRoll}${
          term.agingMessage ? ` ${term.agingMessage}` : ''
        }`
      : ''
  const anagathics = term.anagathics === true ? '; anagathics' : ''
  const reenlistment =
    term.reenlistmentOutcome && term.reenlistmentRoll !== null
      ? `; reenlistment ${term.reenlistmentRoll} ${term.reenlistmentOutcome}`
      : term.reenlistmentOutcome === 'retire'
        ? '; retirement required'
        : ''
  return `${index + 1}. ${term.career}: ${result}${commission}${advancement}${rank}${bonusSkill}${training}${anagathics}${aging}${reenlistment}`
}

const renderCharacterCreationTermHistory = (flow) => {
  if (flow.draft.completedTerms.length === 0) {
    return document.createDocumentFragment()
  }
  const panel = document.createElement('div')
  panel.className = 'creation-term-history'
  const title = document.createElement('strong')
  title.textContent = 'Terms served'
  const list = document.createElement('div')
  for (const [index, term] of flow.draft.completedTerms.entries()) {
    const item = document.createElement('span')
    item.textContent = termSummary(term, index)
    list.append(item)
  }
  panel.append(title, list)
  return panel
}

const selectFailedQualificationCareer = (career, drafted) => {
  if (!characterCreationFlow) return
  characterCreationFlow = applyParsedCharacterCreationDraftPatch(
    characterCreationFlow,
    {
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
    }
  ).flow
  setError('')
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const resolveCharacterCreationCareerQualification = async (career) => {
  if (!characterCreationFlow || characterCreationReadOnly) return
  setError('')
  syncCharacterCreationWizardFields()

  const flowWithCareer = applyParsedCharacterCreationDraftPatch(
    characterCreationFlow,
    parseCharacterCreationDraftPatch({
      career,
      qualificationRoll: null,
      qualificationPassed: null
    })
  ).flow

  await characterCreationHomeworldPublishPromise
  await ensureCharacterCreationPublished()

  let response = null
  try {
    response = await postCharacterCreationCommand(
      {
        type: 'ResolveCharacterCreationQualification',
        gameId: roomId,
        actorId,
        characterId: flowWithCareer.draft.characterId,
        career
      },
      requestId('resolve-character-qualification')
    )
  } catch (error) {
    syncCharacterCreationFlowFromRoomState(
      state,
      flowWithCareer.draft.characterId,
      characterCreationFlow
    )
    renderCharacterCreationWizard()
    characterCreationPanel.scrollToTop()
    throw error
  }
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Qualification roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  const projectedCharacter =
    response.state?.characters?.[flowWithCareer.draft.characterId] ?? null
  const projectedFlow = projectedCharacter
    ? flowFromProjectedCharacter(projectedCharacter)
    : null
  const localResolvedFlow = applyCharacterCreationCareerRoll(
    flowWithCareer,
    latestRoll.total
  ).flow
  characterCreationFlow =
    projectedFlow?.draft.careerPlan ||
    projectedCharacter?.creation?.state.status !== 'CAREER_SELECTION'
      ? (projectedFlow ?? localResolvedFlow)
      : localResolvedFlow
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const renderCharacterCreationDraftFallback = (flow) => {
  const viewModel = deriveCharacterCreationFailedQualificationViewModel(flow)
  if (!viewModel.open) return document.createDocumentFragment()

  const panel = document.createElement('div')
  panel.className = 'creation-draft-fallback'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const note = document.createElement('p')
  note.textContent = viewModel.message

  const list = document.createElement('div')
  list.className = 'creation-draft-list'
  for (const option of viewModel.options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent =
      option.rollRequirement === null
        ? option.actionLabel
        : `${option.actionLabel} (${option.rollRequirement})`
    button.addEventListener('click', () => {
      if (option.option === 'Drifter') {
        selectFailedQualificationCareer('Drifter', false)
        return
      }
      setError(
        'Draft resolution is handled by the event-backed creator flow; choose Drifter here or restart from the shared creation actions.'
      )
    })
    list.append(button)
  }

  panel.append(title, note, list)
  return panel
}

const renderCharacterCreationCharacteristicRollButton = (flow) => {
  const viewModel = deriveCharacterCreationCharacteristicRollButton(flow)
  if (!viewModel) return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindCharacterCreationActionButton(button, () =>
    rollCharacterCreationCharacteristic().catch((error) =>
      setError(error.message)
    )
  )
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  wrapper.append(button, hint)
  if (viewModel.skipLabel) {
    const skipButton = document.createElement('button')
    skipButton.type = 'button'
    skipButton.className = 'secondary'
    skipButton.textContent = viewModel.skipLabel
    skipButton.addEventListener('click', () => {
      characterCreationFlow = skipCharacterCreationCareerRoll(flow).flow
      renderCharacterCreationWizard()
      characterCreationPanel.scrollToTop()
    })
    wrapper.append(skipButton)
  }
  return wrapper
}

const renderCharacterCreationCareerRollButton = (flow) => {
  const viewModel = deriveCharacterCreationCareerRollButton(flow)
  if (!viewModel) return null
  if (viewModel.key === 'qualificationRoll') return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindCharacterCreationActionButton(button, () =>
    rollCharacterCreationCareerCheck().catch((error) => setError(error.message))
  )
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  wrapper.append(button, hint)
  return wrapper
}

const renderCharacterCreationBasicTrainingButton = (flow) => {
  const viewModel = deriveCharacterCreationBasicTrainingButton(flow)
  if (!viewModel) return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindCharacterCreationActionButton(button, () => {
    if (!characterCreationFlow) return
    syncCharacterCreationWizardFields()
    setError('')
    return completeCharacterCreationBasicTraining().catch((error) =>
      setError(error.message)
    )
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

const renderCharacterCreationMusteringOut = (flow) => {
  const panel = document.createElement('div')
  panel.className = 'creation-mustering-out'
  const title = document.createElement('strong')
  title.textContent = 'Mustering out'
  const remaining = remainingMusteringBenefits(flow.draft)
  const summary = document.createElement('p')
  summary.textContent =
    flow.draft.completedTerms.length === 0
      ? 'No career terms completed yet.'
      : remaining > 0
        ? `${remaining} benefit ${remaining === 1 ? 'roll' : 'rolls'} remaining.`
        : 'Benefits complete.'

  const benefitList = document.createElement('div')
  benefitList.className = 'creation-benefit-list'
  for (const benefit of flow.draft.musteringBenefits) {
    const item = document.createElement('span')
    item.textContent = `${benefit.career}: ${benefit.kind} ${benefit.roll} -> ${benefit.value}`
    benefitList.append(item)
  }

  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'
  for (const [kind, label] of [
    ['cash', 'Roll cash'],
    ['material', 'Roll benefit']
  ]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    const modifier = characterCreationMusteringBenefitRollModifier({
      draft: flow.draft,
      kind
    })
    button.disabled =
      remaining <= 0 ||
      !canRollCharacterCreationMusteringBenefit({ draft: flow.draft, kind })
    if (modifier !== 0) {
      button.title = `${modifier > 0 ? '+' : ''}${modifier} DM`
    }
    bindCharacterCreationActionButton(button, () =>
      rollCharacterCreationMusteringBenefit(kind).catch((error) =>
        setError(error.message)
      )
    )
    actions.append(button)
  }

  panel.append(title, summary, benefitList, actions)
  return panel
}

const rollCharacterCreationCharacteristic = async (
  characteristicKey = null
) => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const rollAction = deriveCharacterCreationCharacteristicRollButton(
    characterCreationFlow
  )
  if (!rollAction) return
  const targetKey = characteristicKey ?? rollAction.key ?? null

  if (!targetKey) {
    setError('Choose a characteristic to roll')
    return
  }

  await ensureCharacterCreationPublished()

  const response = await postCharacterCreationCommand(
    {
      type: 'RollCharacterCreationCharacteristic',
      gameId: roomId,
      actorId,
      characterId: characterCreationFlow.draft.characterId,
      characteristic: targetKey
    },
    requestId('characteristic-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Characteristic roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  const fallbackFlow = applyCharacterCreationCharacteristicRoll(
    characterCreationFlow,
    latestRoll.total,
    targetKey
  ).flow
  syncCharacterCreationFlowFromRoomState(
    response.state,
    characterCreationFlow.draft.characterId,
    fallbackFlow
  )
  autoAdvanceCharacterCreationSetup()
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const completeCharacterCreationBasicTraining = async () => {
  if (!characterCreationFlow) return
  const characterId = characterCreationFlow.draft.characterId
  const fallbackFlow = applyCharacterCreationBasicTraining(
    characterCreationFlow
  ).flow

  await ensureCharacterCreationPublished()
  const response = await postCharacterCreationCommand(
    {
      type: 'CompleteCharacterCreationBasicTraining',
      gameId: roomId,
      actorId,
      characterId
    },
    requestId('complete-character-basic-training')
  )
  syncCharacterCreationFlowFromRoomState(response.state, characterId, fallbackFlow)
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const rollCharacterCreationMusteringBenefit = async (kind) => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-mustering-roll')
    )
  }

  if (
    !canRollCharacterCreationMusteringBenefit({
      draft: characterCreationFlow.draft,
      kind
    })
  ) {
    return
  }
  const modifier = characterCreationMusteringBenefitRollModifier({
    draft: characterCreationFlow.draft,
    kind
  })
  const modifierText =
    modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`
  const response = await postDiceCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: `1d6${modifierText}`,
      reason: `${characterCreationFlow.draft.name.trim() || 'Character'} mustering out`
    }),
    requestId('mustering-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Mustering roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  characterCreationFlow = applyCharacterCreationMusteringBenefit({
    flow: characterCreationFlow,
    kind,
    roll: latestRoll.total
  }).flow
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const rollCharacterCreationTermSkill = async (table) => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const action = deriveCharacterCreationTermSkillTableActions(
    characterCreationFlow
  ).find((candidate) => candidate.table === table)
  if (!action || action.disabled) return

  await ensureCharacterCreationPublished()
  const characterId = characterCreationFlow.draft.characterId
  const response = await postCharacterCreationCommand(
    {
      type: 'RollCharacterCreationTermSkill',
      gameId: roomId,
      actorId,
      characterId,
      table
    },
    requestId('term-skill-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Term skill roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  const fallbackFlow = applyCharacterCreationTermSkillRoll({
    flow: characterCreationFlow,
    table,
    roll: latestRoll.total
  }).flow
  syncCharacterCreationFlowFromRoomState(response.state, characterId, fallbackFlow)
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const rollCharacterCreationReenlistment = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  await ensureCharacterCreationPublished()
  const characterId = characterCreationFlow.draft.characterId
  const response = await postCharacterCreationCommand(
    {
      type: 'ResolveCharacterCreationReenlistment',
      gameId: roomId,
      actorId,
      characterId
    },
    requestId('reenlistment-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Reenlistment roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  const fallbackFlow = applyCharacterCreationReenlistmentRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  syncCharacterCreationFlowFromRoomState(response.state, characterId, fallbackFlow)
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const rollCharacterCreationAging = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const action = deriveNextCharacterCreationAgingRoll(characterCreationFlow)

  await ensureCharacterCreationPublished()
  const characterId = characterCreationFlow.draft.characterId
  const response = await postCharacterCreationCommand(
    {
      type: 'ResolveCharacterCreationAging',
      gameId: roomId,
      actorId,
      characterId
    },
    requestId('aging-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Aging roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  const fallbackFlow = applyCharacterCreationAgingRoll(
    characterCreationFlow,
    latestRoll.total + (action?.modifier ?? 0)
  ).flow
  syncCharacterCreationFlowFromRoomState(
    response.state,
    characterId,
    fallbackFlow
  )
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
}

const renderCharacterCreationReview = (flow) => {
  const summary = deriveCharacterCreationReviewSummary(flow)
  const review = document.createElement('div')
  review.className = 'character-creation-review'
  const title = document.createElement('strong')
  title.textContent = summary.title
  const subtitle = document.createElement('p')
  subtitle.textContent = summary.subtitle
  review.append(title, subtitle)

  for (const section of summary.sections) {
    const group = document.createElement('dl')
    const heading = document.createElement('dt')
    heading.textContent = section.label
    group.append(heading)
    for (const item of section.items) {
      const row = document.createElement('dd')
      row.textContent = `${item.label}: ${item.value}`
      group.append(row)
    }
    review.append(group)
  }

  return review
}

const rollCharacterCreationCareerCheck = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const rollAction = deriveCharacterCreationCareerRollButton(
    characterCreationFlow
  )
  if (!rollAction) return

  await ensureCharacterCreationPublished()

  const commandTypeByRollKey = {
    survivalRoll: 'ResolveCharacterCreationSurvival',
    commissionRoll: 'ResolveCharacterCreationCommission',
    advancementRoll: 'ResolveCharacterCreationAdvancement'
  }
  const commandType = commandTypeByRollKey[rollAction.key]
  if (!commandType) return
  const characterId = characterCreationFlow.draft.characterId
  const response = await postCharacterCreationCommand(
    {
      type: commandType,
      gameId: roomId,
      actorId,
      characterId
    },
    requestId('career-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Career roll did not return a dice result')
    return
  }

  await waitForDiceRevealOrDelay(latestRoll)
  const fallbackFlow = applyCharacterCreationCareerRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  syncCharacterCreationFlowFromRoomState(response.state, characterId, fallbackFlow)
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
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
  await postBoardCommand({
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

const createWizardToken = async () => {
  if (!characterCreationFlow) return
  if (!selectedBoard()) {
    await postBoardCommand(
      createBoardCommand({ roomId, actorId }),
      requestId('create-board-for-wizard-character')
    )
  }

  const board = selectedBoard()
  if (!state || !board) return

  const width = 50
  const height = 50
  const scale = 1
  const pieceId = uniquePieceId(state, characterCreationFlow.draft.name)
  const x = Math.max(
    0,
    Math.min(board.width - width * scale, 160 + (boardPieces().length % 8) * 58)
  )
  const y = Math.max(
    0,
    Math.min(
      board.height - height * scale,
      140 + Math.floor(boardPieces().length / 8) * 58
    )
  )

  await postBoardCommand({
    type: 'CreatePiece',
    gameId: roomId,
    actorId,
    pieceId,
    boardId: board.id,
    name: characterCreationFlow.draft.name.trim(),
    characterId: characterCreationFlow.draft.characterId,
    imageAssetId: null,
    x,
    y,
    width,
    height,
    scale
  })
  selectPiece(pieceId)
}

const finishCharacterCreationWizard = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const validation = deriveCharacterCreationValidationSummary({
    ...characterCreationFlow,
    step: 'review'
  })
  if (!validation.ok) {
    setError(validation.errors.join(', '))
    renderCharacterCreationWizard()
    return
  }

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-wizard-character')
    )
  }

  const commands = deriveCharacterCreationCommands(characterCreationFlow, {
    identity: clientIdentity(),
    state
  })
  if (commands.length === 0) {
    setError('Character creation needs the current room state')
    return
  }

  await postCharacterCreationCommands(commands)

  await createWizardToken()
  characterCreationFlow = null
  renderCharacterCreationWizard()
  characterCreationPanel.close()
  characterSheetController.setOpen(true)
  render()
}

const advanceCharacterCreationWizard = async () => {
  if (!characterCreationFlow) {
    startCharacterCreationWizard()
    return
  }

  syncCharacterCreationWizardFields()
  if (characterCreationFlow.step === 'review') {
    await finishCharacterCreationWizard()
    return
  }

  const result = nextCharacterCreationWizardStep(characterCreationFlow)
  if (!result.moved) {
    setError(result.validation.errors.join(', '))
  } else {
    setError('')
    characterCreationFlow = result.flow
    renderCharacterCreationWizard()
    characterCreationPanel.scrollToTop()
    return
  }
  renderCharacterCreationWizard()
}

const backCharacterCreationWizard = () => {
  if (!characterCreationFlow) return
  syncCharacterCreationWizardFields()
  characterCreationFlow = backCharacterCreationWizardStep(
    characterCreationFlow
  ).flow
  setError('')
  renderCharacterCreationWizard()
  characterCreationPanel.scrollToTop()
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
    const command = nextBootstrapCommand({ roomId, actorId, state })
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
  onMessage: handleServerMessage
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
  nextState,
  {
    animateLatestDiceLog = true,
    deferDiceRevealIds = new Set(),
    deferFollowedCreationRolls = []
  } = {}
) => {
  const previousDiceId = latestDiceId
  state = appSession.setAuthoritativeState(nextState).authoritativeState
  const shouldRenderFollowedCreation = refreshFollowedCharacterCreationFlow()
  const shouldRenderEditableCreation = shouldRefreshEditableCharacterCreationFlow(
    {
      deferFollowedCreationRolls
    }
  )
  const latestRoll = state?.diceLog?.[state.diceLog.length - 1] || null
  latestDiceId = latestRoll?.id || null
  render()
  if (shouldRenderFollowedCreation) {
    if (deferFollowedCreationRolls.length > 0) {
      Promise.all(
        deferFollowedCreationRolls.map((roll) => waitForDiceReveal(roll))
      )
        .then(() => {
          if (refreshFollowedCharacterCreationFlow()) {
            renderCharacterCreationWizard()
          }
        })
        .catch((error) => setError(error.message))
    } else {
      renderCharacterCreationWizard()
    }
  }
  if (shouldRenderEditableCreation) {
    renderCharacterCreationWizard()
  }
  if (
    latestRoll &&
    animateLatestDiceLog &&
    firstStateApplied &&
    latestRoll.id !== previousDiceId
  ) {
    animateRoll(latestRoll)
  } else if (
    latestRoll &&
    latestRoll.id !== previousDiceId &&
    !deferDiceRevealIds.has(latestRoll.id)
  ) {
    resolveDiceReveal(latestRoll.id)
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

const characterCreationActions = (character) => {
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
      postCharacterCreationCommand(viewModel.command).catch((error) =>
        setError(error.message)
      )
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
      gameId: roomId,
      actorId,
      characterId,
      ...patch
    }),
  setVisibility: (piece, visibility) =>
    postSheetCommand({
      type: 'SetPieceVisibility',
      gameId: roomId,
      actorId,
      pieceId: piece.id,
      visibility
    }),
  setFreedom: (piece, freedom) =>
    postSheetCommand({
      type: 'SetPieceFreedom',
      gameId: roomId,
      actorId,
      pieceId: piece.id,
      freedom
    }),
  rollSkill: (_piece, _character, _skill, reason) =>
    postSheetCommand(
      buildRollDiceCommand({
        identity: clientIdentity(),
        expression: '2d6',
        reason
      })
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
  renderCreationPresenceDock()
}

const animateRoll = (roll) => {
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

boardController = createBoardController({
  canvas: els.canvas,
  context: els.canvas.getContext('2d'),
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
    firstStateApplied = false
    latestDiceId = null
    selectedCharacterId = null
    clearCreationActivityFeed()
    selectPiece(null)
    boardController?.clearDrag()
    characterSheetController.setOpen(false)
    connectSocket()
    fetchState().catch((error) => setError(error.message))
  }
})

els.sheetButton.addEventListener('click', () => {
  if (!currentSelectedPieceId() && selectedPiece()) {
    selectPiece(selectedPiece().id)
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
  if (characterCreationReadOnly) {
    characterCreationFlow = null
    characterCreationReadOnly = false
    selectedCharacterId = null
  }
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
  const nextFlow = characterCreationFlow
  if (nextFlow?.step === 'homeworld') {
    publishCharacterCreationHomeworldProgress(nextFlow)
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
  postDiceCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: els.diceExpression.value.trim() || '2d6',
      reason: 'Table roll'
    })
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
