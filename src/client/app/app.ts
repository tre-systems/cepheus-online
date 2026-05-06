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
import { deriveCharacterCreationActionPlan } from './character-creation-actions.js'
import {
  applyCharacterCreationBasicTraining,
  applyCharacterCreationBackgroundSkillSelection,
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
  createManualCharacterCreationFlow,
  deriveCharacterCreationCommands,
  deriveCharacterCreationAgingChangeOptions,
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
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationValidationSummary,
  parseCharacterCreationDraftPatch
} from './character-creation-view.js'
import {
  generateCharacterPreview,
  planCreatePlayableCharacterCommands,
  planGeneratePlayableCharacterCommands
} from './character-command-plan.js'
import { deriveGeneratedCharacterPreview } from './character-generator-preview.js'
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
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset.js'

registerClientServiceWorker()

const els = getAppElements(document)

const initialIdentity = resolveAppLocationIdentity(location.search)
let roomId = initialIdentity.roomId
let actorId = initialIdentity.actorId
let state = null
let firstStateApplied = false
let latestDiceId = null
const viewerRole = initialIdentity.viewerRole
const canSelectBoards = isRefereeViewer(viewerRole)
const appSession = createAppSession({ roomId, actorId, viewerRole })
let boardController = null
let diceHideTimer = null
let connectivityController = null
const diceRevealState = createDiceRevealState()
const animatedDiceRollActivityIds = new Set()
let pendingGeneratedCharacter = null
let characterCreationFlow = null

const isCharacterCreatorOpen = () => !els.characterCreator.hidden

const scrollCharacterCreatorToTop = () => {
  els.creatorBody?.scrollTo({ top: 0, behavior: 'smooth' })
}

const openCharacterCreatorPanel = () => {
  els.characterCreator.hidden = false
  if (els.roomDialog.open) els.roomDialog.close()
  characterSheetController.setOpen(false)
  render()
}

const closeCharacterCreatorPanel = () => {
  els.characterCreator.hidden = true
  render()
}

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

const requestId = createRequestIdFactory()

const clientIdentity = () => ({
  gameId: roomId,
  actorId
})

const currentSelectedPieceId = () => appSession.snapshot().selectedPieceId

const selectPiece = (pieceId) => {
  appSession.selectPiece(pieceId)
}

const handleServerMessage = (message) => {
  const application = applyClientServerMessage(state, message)
  const liveActivityApplication = prepareLiveActivityApplication(application, {
    animatedDiceRollActivityIds,
    revealedDiceIds: diceRevealState.revealedDiceIds
  })
  const sessionState = appSession.applyServerMessage(application)
  setError(sessionState.requestError || '')
  if (application.shouldApplyState) {
    applyState(application.state, {
      animateLatestDiceLog: liveActivityApplication.animateLatestDiceLog,
      deferDiceRevealIds: liveActivityApplication.deferDiceRevealIds
    })
  }
  for (const activity of liveActivityApplication.diceRollActivities) {
    animatedDiceRollActivityIds.add(activity.id)
    animateRoll(activity)
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

const commandRouter = createAppCommandRouter({
  getEventSeq: () => state?.eventSeq ?? null,
  createRequestId: (command) => requestId(command.type),
  submit: async ({ requestId, command }) => {
    const response = await postRoomCommand({
      roomId,
      requestId,
      command
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

const nullableIntegerInput = (input) => {
  const text = input.value.trim()
  if (!text) return null
  const value = Number.parseInt(text, 10)
  return Number.isFinite(value) ? value : null
}

const characterSkillsFromInput = () =>
  els.characterSkillsInput.value
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean)

const characterCreationSeed = () => ({
  name: els.characterNameInput.value.trim(),
  characteristics: {
    str: nullableIntegerInput(els.characterStrInput),
    dex: nullableIntegerInput(els.characterDexInput),
    end: nullableIntegerInput(els.characterEndInput),
    int: nullableIntegerInput(els.characterIntInput),
    edu: nullableIntegerInput(els.characterEduInput),
    soc: nullableIntegerInput(els.characterSocInput)
  },
  skills: characterSkillsFromInput(),
  equipment: [],
  credits: parseNonNegativeIntegerInput(els.characterCreditsInput, 0),
  notes: ''
})

const startCharacterCreationWizard = () => {
  if (!isCharacterCreatorOpen()) {
    els.characterCreator.hidden = false
  }
  if (characterCreationFlow) {
    renderCharacterCreationWizard()
    scrollCharacterCreatorToTop()
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
  pendingGeneratedCharacter = null
  renderGeneratedCharacterPreview()
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
}

const autoAdvanceCharacterCreationSetup = () => {
  if (!characterCreationFlow) return false
  if (
    !['basics', 'characteristics', 'homeworld'].includes(
      characterCreationFlow.step
    )
  ) {
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
  if (!characterCreationFlow) {
    els.backCharacterWizard.disabled = true
    els.nextCharacterWizard.disabled = true
    els.backCharacterWizard.hidden = false
    els.nextCharacterWizard.hidden = false
    if (els.creatorActions) els.creatorActions.hidden = false
    els.nextCharacterWizard.title = ''
    els.nextCharacterWizard.textContent = 'Next'
    return
  }
  els.backCharacterWizard.disabled = true
  els.nextCharacterWizard.disabled = true
  els.backCharacterWizard.hidden = true
  els.nextCharacterWizard.hidden = true
  if (els.creatorActions) els.creatorActions.hidden = true

  els.characterCreationStatus.replaceChildren()
}

const renderCharacterCreationWizard = () => {
  while (autoAdvanceCharacterCreationSetup()) {
    // Keep setup steps linear even when reopening a flow that is already valid.
  }

  els.characterCreatorTitle.textContent =
    characterCreationFlow?.draft?.name?.trim() || 'Create traveller'
  els.characterCreator.classList.toggle('flow-active', Boolean(characterCreationFlow))
  els.creatorStartSection.hidden = Boolean(characterCreationFlow)
  els.creatorQuickSection.hidden = Boolean(characterCreationFlow)
  els.startCharacterWizard.textContent = 'Begin character creation'

  if (!characterCreationFlow) {
    els.characterCreationWizard.hidden = true
    els.characterCreationSteps.replaceChildren()
    els.characterCreationStatus.replaceChildren()
    els.characterCreationFields.replaceChildren()
    els.backCharacterWizard.disabled = true
    els.nextCharacterWizard.disabled = true
    els.backCharacterWizard.hidden = false
    els.nextCharacterWizard.hidden = false
    if (els.creatorActions) els.creatorActions.hidden = false
    els.nextCharacterWizard.textContent = 'Next'
    return
  }

  const flow = characterCreationFlow
  els.characterCreationSteps.replaceChildren()
  els.characterCreationFields.replaceChildren(
    renderCharacterCreationNextStep(flow),
    flow.step === 'review'
      ? renderCharacterCreationReview(flow)
      : renderCharacterCreationFields(flow)
  )
  els.characterCreationWizard.hidden = false
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
      advanceCharacterCreationWizard().catch((error) =>
        setError(error.message)
      )
    })
    actions.append(primary)
  }

  panel.append(heading, prompt)
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
    const careerRollButton = renderCharacterCreationCareerRollButton(flow)
    if (careerRollButton) fragment.append(careerRollButton)
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
  const pendingCascadeCount = viewModel.backgroundSkills.cascadeSkillChoices.length
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
  for (const cascade of viewModel.backgroundSkills.cascadeSkillChoices) {
    summary.append(renderCharacterCreationCascadeChoice(cascade))
  }
  summary.append(skillList)
  wrapper.append(fieldGrid, summary)
  return wrapper
}

const renderCharacterCreationTermSkillTables = (flow) => {
  const actions = deriveCharacterCreationTermSkillTableActions(flow)
  if (actions.length === 0) return document.createDocumentFragment()

  const panel = document.createElement('div')
  panel.className = 'creation-term-skills'
  const title = document.createElement('strong')
  title.textContent = 'Skills and training'
  const text = document.createElement('p')
  text.textContent = 'Choose a skill table, then roll 1D6 for this term.'
  const buttons = document.createElement('div')
  buttons.className = 'creation-term-actions'

  for (const action of actions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = action.label
    button.title = action.reason
    button.disabled = action.disabled
    button.addEventListener('click', () => {
      rollCharacterCreationTermSkill(action.table).catch((error) =>
        setError(error.message)
      )
    })
    buttons.append(button)
  }

  panel.append(title, text, buttons)
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
  button.addEventListener('click', () => {
    rollCharacterCreationReenlistment().catch((error) =>
      setError(error.message)
    )
  })
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
  button.addEventListener('click', () => {
    rollCharacterCreationAging().catch((error) => setError(error.message))
  })
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
      characterCreationFlow = {
        ...characterCreationFlow,
        draft: option.selected
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
      renderCharacterCreationWizard()
    })
    list.append(button)
  }

  return list
}

const renderCharacterCreationCascadeChoice = (cascade, scope = 'background') => {
  const panel = document.createElement('div')
  panel.className = 'creation-cascade-choice'
  const title = document.createElement('strong')
  title.textContent = `${cascade.label}-${cascade.level}`
  const options = document.createElement('div')
  options.className = 'creation-background-options'

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
      renderCharacterCreationWizard()
    })
    options.append(button)
  }

  panel.append(title, options)
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
      rollButton.addEventListener('click', () => {
        rollCharacterCreationCharacteristic(field.key).catch((error) =>
          setError(error.message)
        )
      })
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

  const shouldShowCareerList =
    !plan?.career || (plan.qualificationPassed === false && !plan.drafted)
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
        if (!characterCreationFlow) return
        characterCreationFlow = applyParsedCharacterCreationDraftPatch(
          characterCreationFlow,
          parseCharacterCreationDraftPatch({ career: career.key })
        ).flow
        setError('')
        renderCharacterCreationWizard()
        scrollCharacterCreatorToTop()
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
    text.textContent = 'Roll this term’s skills before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (flow.draft.pendingTermCascadeSkills.length > 0) {
    text.textContent = 'Choose the rolled skill specialty before deciding what happens next.'
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
  text.textContent = survived
    ? reenlistmentOutcomeText(plan)
    : 'A mishap ended the term. Muster out to continue character creation.'
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
      scrollCharacterCreatorToTop()
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
    scrollCharacterCreatorToTop()
  })
  actions.append(muster)

  panel.append(title, text, actions)
  return panel
}

const termSummary = (term, index) => {
  const result = term.survivalPassed ? 'survived' : 'mishap'
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
  const reenlistment =
    term.reenlistmentOutcome && term.reenlistmentRoll !== null
      ? `; reenlistment ${term.reenlistmentRoll} ${term.reenlistmentOutcome}`
      : term.reenlistmentOutcome === 'retire'
        ? '; retirement required'
        : ''
  return `${index + 1}. ${term.career}: ${result}${commission}${advancement}${rank}${bonusSkill}${training}${aging}${reenlistment}`
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

const selectDraftCareer = (career) => {
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
        drafted: true
      }
    }
  ).flow
  setError('')
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
}

const renderCharacterCreationDraftFallback = (flow) => {
  const panel = document.createElement('div')
  panel.className = 'creation-draft-fallback'
  const title = document.createElement('strong')
  title.textContent = 'The Draft'
  const note = document.createElement('p')
  note.textContent = 'Qualification failed. Roll 1D6 or choose a draft service.'

  const rollButton = document.createElement('button')
  rollButton.type = 'button'
  rollButton.textContent = 'Roll draft'
  rollButton.addEventListener('click', () => {
    rollCharacterCreationDraft(flow).catch((error) => setError(error.message))
  })

  const list = document.createElement('div')
  list.className = 'creation-draft-list'
  CEPHEUS_SRD_RULESET.theDraft.forEach((career, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = `${index + 1} ${career}`
    button.addEventListener('click', () => selectDraftCareer(career))
    list.append(button)
  })

  panel.append(title, note, rollButton, list)
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
  button.addEventListener('click', () => {
    rollCharacterCreationCharacteristic().catch((error) =>
      setError(error.message)
    )
  })
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
      scrollCharacterCreatorToTop()
    })
    wrapper.append(skipButton)
  }
  return wrapper
}

const renderCharacterCreationCareerRollButton = (flow) => {
  const viewModel = deriveCharacterCreationCareerRollButton(flow)
  if (!viewModel) return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  button.addEventListener('click', () => {
    rollCharacterCreationCareerCheck().catch((error) => setError(error.message))
  })
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
  button.addEventListener('click', () => {
    if (!characterCreationFlow) return
    syncCharacterCreationWizardFields()
    characterCreationFlow = applyCharacterCreationBasicTraining(
      characterCreationFlow
    ).flow
    setError('')
    renderCharacterCreationWizard()
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
    button.addEventListener('click', () => {
      rollCharacterCreationMusteringBenefit(kind).catch((error) =>
        setError(error.message)
      )
    })
    actions.append(button)
  }

  panel.append(title, summary, benefitList, actions)
  return panel
}

const rollCharacterCreationCharacteristic = async (characteristicKey = null) => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const rollAction = deriveCharacterCreationCharacteristicRollButton(
    characterCreationFlow
  )
  if (!rollAction) return
  const targetKey = characteristicKey ?? rollAction.key ?? null
  const targetLabel =
    targetKey === null ? rollAction.label.replace('Roll ', '') : targetKey.toUpperCase()

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-characteristic-roll')
    )
  }

  const response = await postCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: '2d6',
      reason: `${characterCreationFlow.draft.name.trim() || 'Character'} ${targetLabel}`
    }),
    requestId('characteristic-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Characteristic roll did not return a dice result')
    return
  }

  await waitForDiceReveal(latestRoll)
  characterCreationFlow = applyCharacterCreationCharacteristicRoll(
    characterCreationFlow,
    latestRoll.total,
    targetKey
  ).flow
  autoAdvanceCharacterCreationSetup()
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
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
  const response = await postCommand(
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

  await waitForDiceReveal(latestRoll)
  characterCreationFlow = applyCharacterCreationMusteringBenefit({
    flow: characterCreationFlow,
    kind,
    roll: latestRoll.total
  }).flow
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
}

const rollCharacterCreationTermSkill = async (table) => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-term-skill-roll')
    )
  }

  const action = deriveCharacterCreationTermSkillTableActions(
    characterCreationFlow
  ).find((candidate) => candidate.table === table)
  if (!action || action.disabled) return

  const response = await postCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: '1d6',
      reason: action.reason
    }),
    requestId('term-skill-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Term skill roll did not return a dice result')
    return
  }

  await waitForDiceReveal(latestRoll)
  characterCreationFlow = applyCharacterCreationTermSkillRoll({
    flow: characterCreationFlow,
    table,
    roll: latestRoll.total
  }).flow
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
}

const rollCharacterCreationReenlistment = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-reenlistment-roll')
    )
  }

  const action = deriveNextCharacterCreationReenlistmentRoll(
    characterCreationFlow
  )
  if (!action) return

  const response = await postCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: '2d6',
      reason: action.reason
    }),
    requestId('reenlistment-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Reenlistment roll did not return a dice result')
    return
  }

  await waitForDiceReveal(latestRoll)
  characterCreationFlow = applyCharacterCreationReenlistmentRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
}

const rollCharacterCreationAging = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-aging-roll')
    )
  }

  const action = deriveNextCharacterCreationAgingRoll(characterCreationFlow)
  if (!action) return

  const modifier =
    action.modifier === 0
      ? ''
      : action.modifier > 0
        ? `+${action.modifier}`
        : `${action.modifier}`
  const response = await postCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: `2d6${modifier}`,
      reason: action.reason
    }),
    requestId('aging-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Aging roll did not return a dice result')
    return
  }

  await waitForDiceReveal(latestRoll)
  characterCreationFlow = applyCharacterCreationAgingRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
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

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-career-roll')
    )
  }

  const response = await postCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: '2d6',
      reason: rollAction.reason
    }),
    requestId('career-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Career roll did not return a dice result')
    return
  }

  await waitForDiceReveal(latestRoll)
  characterCreationFlow = applyCharacterCreationCareerRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  renderCharacterCreationWizard()
  scrollCharacterCreatorToTop()
}

const rollCharacterCreationDraft = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-draft-roll')
    )
  }

  const response = await postCommand(
    buildRollDiceCommand({
      identity: clientIdentity(),
      expression: '1d6',
      reason: `${characterCreationFlow.draft.name.trim() || 'Character'} draft`
    }),
    requestId('draft-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Draft roll did not return a dice result')
    return
  }

  await waitForDiceReveal(latestRoll)
  const index = Math.max(
    0,
    Math.min(CEPHEUS_SRD_RULESET.theDraft.length - 1, latestRoll.total - 1)
  )
  selectDraftCareer(CEPHEUS_SRD_RULESET.theDraft[index])
  scrollCharacterCreatorToTop()
}

const renderGeneratedCharacterPreview = () => {
  const preview = deriveGeneratedCharacterPreview(pendingGeneratedCharacter)
  if (!preview) {
    els.generatedCharacterPreview.hidden = true
    els.generatedCharacterPreview.replaceChildren()
    els.acceptGeneratedCharacter.disabled = true
    return
  }

  const title = document.createElement('strong')
  title.textContent = preview.title
  const subtitle = document.createElement('p')
  subtitle.className = 'generated-character-subtitle'
  subtitle.textContent = preview.subtitle
  const stats = document.createElement('div')
  stats.className = 'generated-character-stats'
  for (const stat of preview.stats) {
    const element = document.createElement('span')
    element.className = 'generated-character-stat'
    const label = document.createElement('b')
    label.textContent = stat.label
    const value = document.createElement('span')
    value.textContent = stat.value
    element.append(label, value)
    stats.append(element)
  }
  const skills = document.createElement('div')
  skills.className = 'generated-character-skills'
  if (preview.skills.length === 0) {
    const empty = document.createElement('span')
    empty.className = 'generated-character-skill empty'
    empty.textContent = 'No skills'
    skills.append(empty)
  } else {
    for (const skill of preview.skills) {
      const element = document.createElement('span')
      element.className = 'generated-character-skill'
      element.textContent = skill.label
      skills.append(element)
    }
  }
  const chips = document.createElement('div')
  chips.className = 'generated-character-chips'
  for (const chip of preview.chips) {
    const element = document.createElement('span')
    element.className = `generated-character-chip ${chip.tone}`
    element.textContent = chip.label
    chips.append(element)
  }
  els.generatedCharacterPreview.replaceChildren(
    title,
    subtitle,
    stats,
    skills,
    chips
  )
  els.generatedCharacterPreview.hidden = false
  els.acceptGeneratedCharacter.disabled = !preview.canAccept
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

const createCustomCharacter = async () => {
  setError('')
  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-character')
    )
  }
  if (els.characterTokenInput.checked && !selectedBoard()) {
    await postCommand(
      createBoardCommand({ roomId, actorId }),
      requestId('create-board-for-character')
    )
  }

  const board = selectedBoard()
  const plan = planCreatePlayableCharacterCommands({
    identity: clientIdentity(),
    state,
    board,
    name: els.characterNameInput.value,
    characterType: 'PLAYER',
    age: nullableIntegerInput(els.characterAgeInput),
    characteristics: {
      str: nullableIntegerInput(els.characterStrInput),
      dex: nullableIntegerInput(els.characterDexInput),
      end: nullableIntegerInput(els.characterEndInput),
      int: nullableIntegerInput(els.characterIntInput),
      edu: nullableIntegerInput(els.characterEduInput),
      soc: nullableIntegerInput(els.characterSocInput)
    },
    skills: characterSkillsFromInput(),
    equipment: [],
    credits: parseNonNegativeIntegerInput(els.characterCreditsInput, 0),
    notes: '',
    createLinkedPiece: els.characterTokenInput.checked,
    existingPieceCount: boardPieces().length
  })
  if (!plan.ok) {
    setError(plan.error)
    if (plan.focus === 'name') els.characterNameInput.focus()
    if (plan.focus === 'skills') els.characterSkillsInput.focus()
    return
  }

  for (const command of plan.commands) {
    await postCommand(command)
  }
  if (plan.pieceId) selectPiece(plan.pieceId)
  els.characterNameInput.value = ''
  pendingGeneratedCharacter = null
  renderGeneratedCharacterPreview()
  closeCharacterCreatorPanel()
  characterSheetController.setOpen(true)
  render()
}

const createWizardToken = async () => {
  if (!characterCreationFlow || !els.characterTokenInput.checked) return
  if (!selectedBoard()) {
    await postCommand(
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

  await postCommand({
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

  for (const command of commands) {
    await postCommand(command)
  }

  await createWizardToken()
  els.characterNameInput.value = ''
  characterCreationFlow = null
  renderCharacterCreationWizard()
  closeCharacterCreatorPanel()
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
    scrollCharacterCreatorToTop()
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
  scrollCharacterCreatorToTop()
}

const rollGeneratedCharacter = () => {
  setError('')
  pendingGeneratedCharacter = generateCharacterPreview({
    state,
    name: els.characterNameInput.value
  })
  renderGeneratedCharacterPreview()
}

const acceptGeneratedCharacter = async () => {
  setError('')
  if (!pendingGeneratedCharacter) rollGeneratedCharacter()
  if (!state) {
    await postCommand(
      createGameCommand({ roomId, actorId }),
      requestId('create-game-for-generated-character')
    )
  }
  if (els.characterTokenInput.checked && !selectedBoard()) {
    await postCommand(
      createBoardCommand({ roomId, actorId }),
      requestId('create-board-for-generated-character')
    )
  }

  const plan = planGeneratePlayableCharacterCommands({
    identity: clientIdentity(),
    state,
    board: selectedBoard(),
    generated: pendingGeneratedCharacter,
    createLinkedPiece: els.characterTokenInput.checked,
    existingPieceCount: boardPieces().length
  })
  if (!plan.ok) {
    setError(plan.error)
    if (plan.focus === 'name') els.characterNameInput.focus()
    if (plan.focus === 'skills') els.characterSkillsInput.focus()
    return
  }

  for (const command of plan.commands) {
    await postCommand(command)
  }
  if (plan.pieceId) selectPiece(plan.pieceId)
  els.characterNameInput.value = ''
  pendingGeneratedCharacter = null
  renderGeneratedCharacterPreview()
  closeCharacterCreatorPanel()
  characterSheetController.setOpen(true)
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
    actorId
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
  { animateLatestDiceLog = true, deferDiceRevealIds = new Set() } = {}
) => {
  const previousDiceId = latestDiceId
  state = appSession.setAuthoritativeState(nextState).authoritativeState
  const latestRoll = state?.diceLog?.[state.diceLog.length - 1] || null
  latestDiceId = latestRoll?.id || null
  render()
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
      sendCommand(viewModel.command).catch((error) => setError(error.message))
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
  getCharacterCreationActions: characterCreationActions,
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
}

const animateRoll = (roll) => {
  const overlayHost = isCharacterCreatorOpen()
    ? els.characterCreator
    : els.roomDialog.open
      ? els.roomDialog
      : document.querySelector('.app-shell')
  if (overlayHost && els.diceOverlay.parentElement !== overlayHost) {
    overlayHost.append(els.diceOverlay)
  }
  els.diceOverlay.classList.toggle('in-creator', isCharacterCreatorOpen())
  els.diceOverlay.classList.toggle('in-dialog', els.roomDialog.open)
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
  defaultRoomId: DEFAULT_APP_LOCATION.roomId,
  defaultActorId: DEFAULT_APP_LOCATION.actorId,
  onOpenRoom: (identity) => {
    roomId = identity.roomId
    actorId = identity.actorId
    appSession.setRoomIdentity({ roomId, actorId })
    firstStateApplied = false
    latestDiceId = null
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
    openCharacterCreatorPanel()
    return
  }
  characterSheetController.toggleOpen()
  render()
})

els.sheetClose.addEventListener('click', () => {
  characterSheetController.setOpen(false)
})

els.createCharacterRail.addEventListener('click', () => {
  openCharacterCreatorPanel()
  if (!characterCreationFlow) startCharacterCreationWizard()
})

els.characterCreatorClose.addEventListener('click', () => {
  closeCharacterCreatorPanel()
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

els.createCharacter.addEventListener('click', () => {
  createCustomCharacter().catch((error) => setError(error.message))
})

els.startCharacterWizard.addEventListener('click', () => {
  startCharacterCreationWizard()
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
  autoAdvanceCharacterCreationSetup()
  renderCharacterCreationWizard()
})

els.nextCharacterWizard.addEventListener('click', () => {
  advanceCharacterCreationWizard().catch((error) => setError(error.message))
})

els.generateCharacter.addEventListener('click', () => {
  rollGeneratedCharacter()
})

els.acceptGeneratedCharacter.addEventListener('click', () => {
  acceptGeneratedCharacter().catch((error) => setError(error.message))
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

createAppBootstrap({
  connectivityStatus: connectivityController.snapshot().status,
  connect: connectSocket,
  fetchState,
  setStatus,
  setError
})
