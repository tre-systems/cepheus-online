import type {
  CharacterCreationCharacteristicRollKey,
  CharacterCreationFlow
} from './flow'
import { characterCreationCareerNames } from './flow'
import { bindAsyncActionButton } from '../../core/async-button'
import { renderCharacterCreationCascadeChoice as renderCharacterCreationCascadeChoiceView } from './views/homeworld'
import {
  deriveCharacterCreationCharacteristicRollButton,
  type CharacterCreationBasicTrainingButton,
  type CharacterCreationDeathViewModel,
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationSkillStrip,
  type CharacterCreationMusteringOutViewModel,
  type CharacterCreationNextStepViewModel,
  type CharacterCreationPendingCascadeChoiceViewModel
} from './view'

export interface CharacterCreationRendererDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: 'input'): HTMLInputElement
  createElement(tagName: 'label'): HTMLLabelElement
  createElement(tagName: 'option'): HTMLOptionElement
  createElement(tagName: 'select'): HTMLSelectElement
  createElement(tagName: 'textarea'): HTMLTextAreaElement
  createElement(tagName: string): HTMLElement
  createDocumentFragment(): DocumentFragment
}

export interface CharacterCreationNextStepRendererDeps {
  advanceStep: () => Promise<void>
  reportError: (message: string) => void
  resolveBackgroundCascadeSkill: (choice: {
    scope: 'background'
    cascadeSkill: string
    selection: string
  }) => void
}

export interface CharacterCreationDeathRendererDeps {
  readOnly: () => boolean
  startNewCharacter: () => Promise<void>
  reportError: (message: string) => void
}

export interface CharacterCreationCharacteristicRollRendererDeps {
  rollCharacteristic: (
    characteristicKey?: CharacterCreationCharacteristicRollKey
  ) => Promise<void>
  reportError: (message: string) => void
}

export interface CharacterCreationBasicTrainingRendererDeps {
  hasFlow: () => boolean
  syncFields: () => void
  completeBasicTraining: (skill?: string) => Promise<void>
  reportError: (message: string) => void
}

export interface CharacterCreationDraftFieldsRendererDeps {
  renderCharacteristicRollButton: (
    flow: CharacterCreationFlow
  ) => HTMLElement | null
  renderCareerRollButton: () => HTMLElement | null
  renderBasicTrainingButton: () => HTMLElement | null
  musteringOut: CharacterCreationMusteringOutViewModel | null
  renderMusteringOut: (
    viewModel: CharacterCreationMusteringOutViewModel
  ) => HTMLElement
}

export const renderCharacterCreationNextStep = (
  document: CharacterCreationRendererDocument,
  viewModel: CharacterCreationNextStepViewModel,
  {
    advanceStep,
    reportError,
    resolveBackgroundCascadeSkill
  }: CharacterCreationNextStepRendererDeps
): HTMLElement => {
  const panel = document.createElement('section')
  panel.className = 'creation-next-step'

  const heading = document.createElement('strong')
  heading.textContent = viewModel.phase
  const prompt = document.createElement('p')
  prompt.textContent = viewModel.prompt
  const stats = document.createElement('div')
  stats.className = 'creation-stat-strip'
  const skills = document.createElement('p')
  skills.className = 'creation-skill-strip'
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
  skills.textContent = viewModel.skills.summary

  if (!viewModel.primaryAction.disabled) {
    const primary = document.createElement('button')
    primary.type = 'button'
    primary.textContent = viewModel.primaryAction.label
    primary.addEventListener('click', () => {
      advanceStep().catch((error) => reportError(error.message))
    })
    actions.append(primary)
  }

  panel.append(heading, prompt)
  if (viewModel.blockingChoice) {
    panel.append(
      renderBlockingBackgroundChoice(
        document,
        viewModel.blockingChoice,
        resolveBackgroundCascadeSkill
      )
    )
  }
  if (viewModel.step !== 'characteristics') {
    panel.append(stats)
  }
  if (viewModel.skills.skills.length > 0) panel.append(skills)
  if (actions.childElementCount > 0) panel.append(actions)
  return panel
}

export const renderCharacterCreationDeath = (
  document: CharacterCreationRendererDocument,
  viewModel: CharacterCreationDeathViewModel,
  {
    readOnly,
    startNewCharacter,
    reportError
  }: CharacterCreationDeathRendererDeps
): HTMLElement => {
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
  if (!readOnly()) {
    const actions = document.createElement('div')
    actions.className = 'creation-death-actions'
    const next = document.createElement('button')
    next.type = 'button'
    next.textContent = 'Start a new character'
    next.addEventListener('click', () => {
      startNewCharacter().catch((error) => reportError(error.message))
    })
    actions.append(next)
    panel.append(actions)
  }
  return panel
}

export const renderCharacterCreationCharacteristicRollButton = (
  document: CharacterCreationRendererDocument,
  flow: CharacterCreationFlow,
  {
    rollCharacteristic,
    reportError
  }: CharacterCreationCharacteristicRollRendererDeps
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
    rollCharacteristic().catch((error) => reportError(error.message))
  )
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  wrapper.append(button, hint)
  return wrapper
}

export const renderCharacterCreationBasicTrainingButton = (
  document: CharacterCreationRendererDocument,
  viewModel: CharacterCreationBasicTrainingButton,
  {
    hasFlow,
    syncFields,
    completeBasicTraining,
    reportError
  }: CharacterCreationBasicTrainingRendererDeps
): HTMLElement | null => {
  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const bindTrainingButton = (button: HTMLButtonElement, skill?: string) => {
    bindAsyncActionButton(button, () => {
      if (!hasFlow()) return
      syncFields()
      reportError('')
      return completeBasicTraining(skill).catch((error) =>
        reportError(error.message)
      )
    })
  }
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindTrainingButton(button)
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  const skills = document.createElement('div')
  skills.className = 'creation-training-skills'
  if (viewModel.kind === 'choose-one') {
    for (const skill of viewModel.skills) {
      const skillButton = document.createElement('button')
      skillButton.type = 'button'
      skillButton.textContent = skill
      skillButton.disabled = viewModel.disabled
      bindTrainingButton(skillButton, skill)
      skills.append(skillButton)
    }
    wrapper.append(hint, skills)
    return wrapper
  }
  for (const skill of viewModel.skills) {
    const chip = document.createElement('span')
    chip.textContent = skill
    skills.append(chip)
  }
  wrapper.append(button, hint, skills)
  return wrapper
}

export const renderCharacterCreationDraftFields = (
  document: CharacterCreationRendererDocument,
  flow: CharacterCreationFlow,
  {
    renderCharacteristicRollButton,
    renderCareerRollButton,
    renderBasicTrainingButton,
    musteringOut,
    renderMusteringOut
  }: CharacterCreationDraftFieldsRendererDeps
): DocumentFragment => {
  const fragment = document.createDocumentFragment()
  for (const field of deriveCharacterCreationFieldViewModels(flow)) {
    if (field.key === 'skills') {
      fragment.append(renderSkillReviewField(document, flow, field))
      continue
    }

    fragment.append(renderDraftField(document, field))
  }

  const careerRollButton = renderCareerRollButton()
  const characteristicRollButton = renderCharacteristicRollButton(flow)
  const basicTrainingButton = renderBasicTrainingButton()
  if (characteristicRollButton) fragment.append(characteristicRollButton)
  if (careerRollButton) fragment.append(careerRollButton)
  if (basicTrainingButton) fragment.append(basicTrainingButton)
  if (flow.step === 'equipment' && musteringOut) {
    fragment.prepend(renderMusteringOut(musteringOut))
  }
  return fragment
}

const renderBlockingBackgroundChoice = (
  document: CharacterCreationRendererDocument,
  choice: CharacterCreationPendingCascadeChoiceViewModel,
  resolveBackgroundCascadeSkill: CharacterCreationNextStepRendererDeps['resolveBackgroundCascadeSkill']
): HTMLElement =>
  renderCharacterCreationCascadeChoiceView(document, choice, 'background', {
    resolveCascadeSkill: ({ scope, cascadeSkill, selection }) => {
      if (scope !== 'background') return
      resolveBackgroundCascadeSkill({ scope, cascadeSkill, selection })
    }
  })

type CharacterCreationFieldViewModel = ReturnType<
  typeof deriveCharacterCreationFieldViewModels
>[number]

const renderSkillReviewField = (
  document: CharacterCreationRendererDocument,
  flow: CharacterCreationFlow,
  field: CharacterCreationFieldViewModel
): HTMLElement => {
  const panel = document.createElement('section')
  panel.className = 'character-creation-field skill-review'
  const title = document.createElement('span')
  title.textContent = field.required ? `${field.label} *` : field.label
  const skills = document.createElement('div')
  skills.className = 'creation-skill-review-list'
  const skillValues = deriveCharacterCreationSkillStrip(flow).skills
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
  appendFieldErrorMessages(
    document,
    panel,
    skillValues.length > 0
      ? field.errors.filter((error) => !error.startsWith('At least one skill'))
      : field.errors
  )
  return panel
}

const renderDraftField = (
  document: CharacterCreationRendererDocument,
  field: CharacterCreationFieldViewModel
): HTMLElement => {
  const label = document.createElement('label')
  label.className = `character-creation-field ${field.kind}`
  const name = document.createElement('span')
  name.textContent = field.required ? `${field.label} *` : field.label

  const control = renderDraftFieldControl(document, field)
  control.dataset.characterCreationField = field.key
  control.value = field.value
  control.autocomplete = 'off'

  label.append(name, control)
  appendFieldErrors(document, label, field)
  return label
}

const renderDraftFieldControl = (
  document: CharacterCreationRendererDocument,
  field: CharacterCreationFieldViewModel
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
  if (field.kind === 'textarea') {
    const control = document.createElement('textarea')
    control.rows = field.key === 'skills' ? 4 : 3
    return control
  }
  if (field.kind === 'select') {
    const control = document.createElement('select')
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
    return control
  }

  const control = document.createElement('input')
  control.type = 'text'
  if (field.kind === 'number') control.inputMode = 'numeric'
  return control
}

const appendFieldErrors = (
  document: CharacterCreationRendererDocument,
  element: HTMLElement,
  field: CharacterCreationFieldViewModel
): void => {
  appendFieldErrorMessages(document, element, field.errors)
}

const appendFieldErrorMessages = (
  document: CharacterCreationRendererDocument,
  element: HTMLElement,
  errors: readonly string[]
): void => {
  if (errors.length === 0) return
  const error = document.createElement('small')
  error.textContent = errors.join(', ')
  element.append(error)
}
