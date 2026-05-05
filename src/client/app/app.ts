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
import { deriveCharacterCreationActionPlan } from './character-creation-actions.js'
import {
  applyCharacterCreationBasicTraining,
  applyCharacterCreationCharacteristicRoll,
  applyCharacterCreationCareerRoll,
  applyParsedCharacterCreationDraftPatch,
  backCharacterCreationWizardStep,
  characterCreationCareerNames,
  createManualCharacterCreationFlow,
  deriveCharacterCreationCommands,
  nextCharacterCreationWizardStep
} from './character-creation-flow.js'
import {
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCharacteristicRollButton,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationStepProgressItems,
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
  createCharacter: document.getElementById('createCharacterButton'),
  createCharacterRail: document.getElementById('createCharacterRailButton'),
  characterCreator: document.getElementById('characterCreator'),
  characterCreatorClose: document.getElementById('characterCreatorCloseButton'),
  characterCreatorTitle: document.getElementById('characterCreatorTitle'),
  startCharacterWizard: document.getElementById('startCharacterWizardButton'),
  backCharacterWizard: document.getElementById('backCharacterWizardButton'),
  nextCharacterWizard: document.getElementById('nextCharacterWizardButton'),
  acceptGeneratedCharacter: document.getElementById(
    'acceptGeneratedCharacterButton'
  ),
  generateCharacter: document.getElementById('generateCharacterButton'),
  generatedCharacterPreview: document.getElementById(
    'generatedCharacterPreview'
  ),
  characterCreationWizard: document.getElementById('characterCreationWizard'),
  characterCreationSteps: document.getElementById('characterCreationSteps'),
  characterCreationStatus: document.getElementById('characterCreationStatus'),
  characterCreationFields: document.getElementById('characterCreationFields'),
  createPiece: document.getElementById('createPieceButton'),
  createBoard: document.getElementById('createBoardButton'),
  characterNameInput: document.getElementById('characterNameInput'),
  characterAgeInput: document.getElementById('characterAgeInput'),
  characterStrInput: document.getElementById('characterStrInput'),
  characterDexInput: document.getElementById('characterDexInput'),
  characterEndInput: document.getElementById('characterEndInput'),
  characterIntInput: document.getElementById('characterIntInput'),
  characterEduInput: document.getElementById('characterEduInput'),
  characterSocInput: document.getElementById('characterSocInput'),
  characterSkillsInput: document.getElementById('characterSkillsInput'),
  characterCreditsInput: document.getElementById('characterCreditsInput'),
  characterTokenInput: document.getElementById('characterTokenInput'),
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
let pendingGeneratedCharacter = null
let characterCreationFlow = null

const isCharacterCreatorOpen = () => !els.characterCreator.hidden

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
  notes: ''
})

const startCharacterCreationWizard = () => {
  if (!isCharacterCreatorOpen()) {
    els.characterCreator.hidden = false
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
      age: seed.age,
      credits: seed.credits,
      equipment: seed.equipment,
      notes: seed.notes
    }
  }
  pendingGeneratedCharacter = null
  renderGeneratedCharacterPreview()
  renderCharacterCreationWizard()
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
    els.nextCharacterWizard.title = ''
    els.nextCharacterWizard.textContent = 'Next'
    return
  }
  const buttons = deriveCharacterCreationButtonStates(characterCreationFlow)
  els.backCharacterWizard.disabled = buttons.secondary?.disabled ?? true
  els.nextCharacterWizard.disabled = buttons.primary.disabled
  els.nextCharacterWizard.title = buttons.primary.reason ?? ''
  els.nextCharacterWizard.textContent = buttons.primary.label

  const validation = deriveCharacterCreationValidationSummary(
    characterCreationFlow
  )
  const status = document.createElement('p')
  status.textContent = validation.ok
    ? 'Ready to continue'
    : `${validation.errors.length} ${
        validation.errors.length === 1 ? 'issue' : 'issues'
      } to fix`
  status.className = validation.ok ? 'ok' : 'invalid'
  els.characterCreationStatus.replaceChildren(status)
}

const renderCharacterCreationWizard = () => {
  els.characterCreatorTitle.textContent =
    characterCreationFlow?.draft?.name?.trim() || 'Create traveller'
  els.startCharacterWizard.textContent = characterCreationFlow
    ? 'Restart character creation'
    : 'Begin character creation'

  if (!characterCreationFlow) {
    els.characterCreationWizard.hidden = true
    els.characterCreationSteps.replaceChildren()
    els.characterCreationStatus.replaceChildren()
    els.characterCreationFields.replaceChildren()
    els.backCharacterWizard.disabled = true
    els.nextCharacterWizard.disabled = true
    els.nextCharacterWizard.textContent = 'Next'
    return
  }

  const flow = characterCreationFlow
  const progress = document.createElement('div')
  progress.className = 'character-creation-progress'
  for (const step of deriveCharacterCreationStepProgressItems(flow)) {
    const item = document.createElement('span')
    item.className = [
      step.current ? 'active' : '',
      step.complete ? 'complete' : '',
      step.invalid ? 'invalid' : ''
    ]
      .filter(Boolean)
      .join(' ')
    item.textContent = step.label
    progress.append(item)
  }

  els.characterCreationSteps.replaceChildren(progress)
  els.characterCreationFields.replaceChildren(
    flow.step === 'review'
      ? renderCharacterCreationReview(flow)
      : renderCharacterCreationFields(flow)
  )
  els.characterCreationWizard.hidden = false
  renderCharacterCreationWizardControls()
}

const renderCharacterCreationFields = (flow) => {
  const fragment = document.createDocumentFragment()
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
  return fragment
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
  wrapper.append(button, hint)
  return wrapper
}

const rollCharacterCreationCharacteristic = async () => {
  if (!characterCreationFlow) return
  setError('')
  syncCharacterCreationWizardFields()

  const rollAction = deriveCharacterCreationCharacteristicRollButton(
    characterCreationFlow
  )
  if (!rollAction) return

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
      reason: rollAction.reason
    }),
    requestId('characteristic-roll')
  )
  const latestRoll =
    response.state?.diceLog?.[response.state.diceLog.length - 1]
  if (!latestRoll) {
    setError('Characteristic roll did not return a dice result')
    return
  }

  characterCreationFlow = applyCharacterCreationCharacteristicRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  renderCharacterCreationWizard()
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

  characterCreationFlow = applyCharacterCreationCareerRoll(
    characterCreationFlow,
    latestRoll.total
  ).flow
  renderCharacterCreationWizard()
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
  if (plan.pieceId) selectedPieceId = plan.pieceId
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
  selectedPieceId = pieceId
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
  if (plan.pieceId) selectedPieceId = plan.pieceId
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
  if (!selectedPieceId) {
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
