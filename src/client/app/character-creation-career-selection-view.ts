import type { CharacterCreationFlow } from './character-creation-flow.js'
import { bindAsyncActionButton } from './async-action-button.js'
import {
  deriveCharacterCreationCareerOptionViewModels,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationFailedQualificationViewModel,
  formatCharacterCreationCareerCheckShort,
  formatCharacterCreationCareerOutcome
} from './character-creation-view.js'

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
  flow: CharacterCreationFlow,
  deps: Pick<
    CharacterCreationCareerSelectionViewDeps,
    | 'resolveCareerQualification'
    | 'resolveFailedQualificationOption'
    | 'reportError'
  >
): HTMLElement => {
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
  outcomeBody.textContent = formatCharacterCreationCareerOutcome(plan)
  outcome.append(outcomeTitle, outcomeBody)
  wrapper.append(outcome)

  if (plan?.qualificationPassed === false && !plan.drafted) {
    wrapper.append(renderCharacterCreationDraftFallback(document, flow, deps))
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
      qualification.textContent = `Qualify ${formatCharacterCreationCareerCheckShort(career.qualification)}`
      const survival = document.createElement('span')
      survival.className = 'creation-career-check'
      survival.textContent = `Survive ${formatCharacterCreationCareerCheckShort(career.survival)}`
      button.append(title, qualification, survival)
      bindAsyncActionButton(button, () =>
        deps
          .resolveCareerQualification(career.key)
          .catch((error) => deps.reportError(error.message))
      )
      list.append(button)
    }
    wrapper.append(list)
  }
  return wrapper
}

export const renderCharacterCreationCareerRollButton = (
  document: CharacterCreationCareerSelectionDocument,
  flow: CharacterCreationFlow,
  {
    rollCareerCheck,
    reportError
  }: Pick<
    CharacterCreationCareerSelectionViewDeps,
    'rollCareerCheck' | 'reportError'
  >
): HTMLElement | null => {
  const viewModel = deriveCharacterCreationCareerRollButton(flow)
  if (!viewModel) return null
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
  flow: CharacterCreationFlow,
  {
    resolveFailedQualificationOption,
    reportError
  }: Pick<
    CharacterCreationCareerSelectionViewDeps,
    'resolveFailedQualificationOption' | 'reportError'
  >
): HTMLElement | DocumentFragment => {
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
