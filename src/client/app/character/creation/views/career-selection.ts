import { bindAsyncActionButton } from '../../../core/async-button'
import {
  type CharacterCreationCareerRollButton,
  type CharacterCreationCareerSelectionViewModel,
  type CharacterCreationFailedQualificationViewModel,
  formatCharacterCreationCareerCheckShort
} from '../view'

export interface CharacterCreationCareerSelectionDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: 'input'): HTMLInputElement
  createElement(tagName: string): HTMLElement
  createDocumentFragment(): DocumentFragment
}

export interface CharacterCreationCareerSelectionViewDeps {
  resolveCareerQualification: (career: string) => Promise<void>
  rollCareerCheck: () => Promise<void>
  resolveFailedQualificationOption: (
    option: 'Drifter' | 'Draft'
  ) => Promise<void>
  reportError: (message: string) => void
}

export const renderCharacterCreationCareerPicker = (
  document: CharacterCreationCareerSelectionDocument,
  viewModel: CharacterCreationCareerSelectionViewModel,
  deps: Pick<
    CharacterCreationCareerSelectionViewDeps,
    | 'resolveCareerQualification'
    | 'resolveFailedQualificationOption'
    | 'reportError'
  >
): HTMLElement => {
  const wrapper = document.createElement('div')
  wrapper.className = 'creation-career-picker'

  for (const { key, value } of viewModel.hiddenFields) {
    const hidden = document.createElement('input')
    hidden.type = 'hidden'
    hidden.dataset.characterCreationField = key
    hidden.value = value
    wrapper.append(hidden)
  }

  const outcome = document.createElement('div')
  outcome.className = 'creation-career-outcome'
  const outcomeTitle = document.createElement('strong')
  outcomeTitle.textContent = viewModel.outcomeTitle
  const outcomeBody = document.createElement('p')
  outcomeBody.textContent = viewModel.outcomeText
  outcome.append(outcomeTitle, outcomeBody)
  wrapper.append(outcome)

  if (viewModel.failedQualification.open) {
    wrapper.append(
      renderCharacterCreationDraftFallback(
        document,
        viewModel.failedQualification,
        deps
      )
    )
  }

  if (viewModel.showCareerList) {
    const list = document.createElement('div')
    list.className = 'creation-career-list'
    for (const career of viewModel.careerOptions) {
      const row = document.createElement('div')
      row.className = career.selected
        ? 'creation-career-card selected'
        : 'creation-career-card'
      const details = document.createElement('div')
      details.className = 'creation-career-details'
      const title = document.createElement('span')
      title.className = 'creation-career-title'
      title.textContent = career.label
      const checks = document.createElement('div')
      checks.className = 'creation-career-checks'
      const qualification = document.createElement('span')
      qualification.className = 'creation-career-check'
      qualification.textContent = `Qualify ${formatCharacterCreationCareerCheckShort(career.qualification)}`
      const survival = document.createElement('span')
      survival.className = 'creation-career-check'
      survival.textContent = `Survive ${formatCharacterCreationCareerCheckShort(career.survival)}`
      checks.append(qualification, survival)
      details.append(title, checks)
      const qualify = document.createElement('button')
      qualify.type = 'button'
      qualify.className = 'creation-career-qualify'
      qualify.textContent = 'Qualify'
      qualify.setAttribute('aria-label', `Qualify for ${career.label}`)
      bindAsyncActionButton(qualify, () =>
        deps
          .resolveCareerQualification(career.key)
          .catch((error) => deps.reportError(error.message))
      )
      row.append(details, qualify)
      list.append(row)
    }
    wrapper.append(list)
  }
  return wrapper
}

export const renderCharacterCreationCareerRollButton = (
  document: CharacterCreationCareerSelectionDocument,
  viewModel: CharacterCreationCareerRollButton,
  {
    rollCareerCheck,
    reportError
  }: Pick<
    CharacterCreationCareerSelectionViewDeps,
    'rollCareerCheck' | 'reportError'
  >
): HTMLElement | null => {
  if (viewModel.key === 'qualificationRoll') return null

  const wrapper = document.createElement('div')
  wrapper.className = 'character-creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  button.disabled = viewModel.disabled
  bindAsyncActionButton(button, () =>
    rollCareerCheck().catch((error) => reportError(error.message))
  )
  const hint = document.createElement('small')
  hint.textContent = viewModel.reason
  wrapper.append(button, hint)
  return wrapper
}

const renderCharacterCreationDraftFallback = (
  document: CharacterCreationCareerSelectionDocument,
  viewModel: CharacterCreationFailedQualificationViewModel,
  {
    resolveFailedQualificationOption,
    reportError
  }: Pick<
    CharacterCreationCareerSelectionViewDeps,
    'resolveFailedQualificationOption' | 'reportError'
  >
): HTMLElement | DocumentFragment => {
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
    bindAsyncActionButton(button, () =>
      resolveFailedQualificationOption(option.option).catch((error) =>
        reportError(error.message)
      )
    )
    list.append(button)
  }

  panel.append(title, note, list)
  return panel
}
