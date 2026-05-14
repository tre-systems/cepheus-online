import type { CharacteristicKey } from '../../../../../shared/state.js'
import type { CharacterCreationTermSkillTable } from '../flow.js'
import { bindAsyncActionButton } from '../../../core/async-button.js'
import type {
  CharacterCreationAgingChoicesViewModel,
  CharacterCreationAgingRollViewModel,
  CharacterCreationAnagathicsDecisionViewModel,
  CharacterCreationReenlistmentRollViewModel,
  CharacterCreationTermSkillTrainingViewModel
} from '../view.js'

export interface CharacterCreationCareerSupportDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
  createDocumentFragment(): DocumentFragment
}

export interface CharacterCreationCareerSupportViewDeps {
  rollTermSkill: (table: CharacterCreationTermSkillTable) => Promise<void>
  rollReenlistment: () => Promise<void>
  rollAging: () => Promise<void>
  decideAnagathics: (useAnagathics: boolean) => Promise<void>
  applyAgingChange: (index: number, characteristic: CharacteristicKey) => void
  reportError: (message: string) => void
}

export const renderCharacterCreationTermSkillTables = (
  document: CharacterCreationCareerSupportDocument,
  viewModel: CharacterCreationTermSkillTrainingViewModel,
  {
    rollTermSkill,
    reportError
  }: Pick<
    CharacterCreationCareerSupportViewDeps,
    'rollTermSkill' | 'reportError'
  >
): HTMLElement | DocumentFragment => {
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
    bindAsyncActionButton(button, () =>
      rollTermSkill(action.table as CharacterCreationTermSkillTable).catch(
        (error) => reportError(error.message)
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

export const renderCharacterCreationReenlistmentRollButton = (
  document: CharacterCreationCareerSupportDocument,
  viewModel: CharacterCreationReenlistmentRollViewModel,
  {
    rollReenlistment,
    reportError
  }: Pick<
    CharacterCreationCareerSupportViewDeps,
    'rollReenlistment' | 'reportError'
  >
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  bindAsyncActionButton(button, () =>
    rollReenlistment().catch((error) => reportError(error.message))
  )
  const note = document.createElement('small')
  note.textContent = viewModel.reason
  panel.append(button, note)
  return panel
}

export const renderCharacterCreationAgingRollButton = (
  document: CharacterCreationCareerSupportDocument,
  viewModel: CharacterCreationAgingRollViewModel,
  {
    rollAging,
    reportError
  }: Pick<CharacterCreationCareerSupportViewDeps, 'rollAging' | 'reportError'>
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.label
  bindAsyncActionButton(button, () =>
    rollAging().catch((error) => reportError(error.message))
  )
  const note = document.createElement('small')
  const modifier = viewModel.modifierText ? ` (${viewModel.modifierText})` : ''
  note.textContent = `${viewModel.reason}${modifier}`
  panel.append(button, note)
  return panel
}

export const renderCharacterCreationAgingChoices = (
  document: CharacterCreationCareerSupportDocument,
  viewModel: CharacterCreationAgingChoicesViewModel,
  {
    applyAgingChange
  }: Pick<CharacterCreationCareerSupportViewDeps, 'applyAgingChange'>
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-skills'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const text = document.createElement('p')
  text.textContent = viewModel.prompt
  panel.append(title, text)

  for (const change of viewModel.choices) {
    const row = document.createElement('div')
    row.className = 'creation-term-actions'
    const label = document.createElement('small')
    label.textContent = change.label
    row.append(label)
    for (const option of change.options) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option.label
      button.addEventListener('click', () => {
        applyAgingChange(change.index, option.characteristic)
      })
      row.append(button)
    }
    panel.append(row)
  }

  return panel
}

export const renderCharacterCreationAnagathicsDecision = (
  document: CharacterCreationCareerSupportDocument,
  viewModel: CharacterCreationAnagathicsDecisionViewModel,
  {
    decideAnagathics,
    reportError
  }: Pick<
    CharacterCreationCareerSupportViewDeps,
    'decideAnagathics' | 'reportError'
  >
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const text = document.createElement('p')
  text.textContent = viewModel.prompt
  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  const use = document.createElement('button')
  use.type = 'button'
  use.textContent = viewModel.useLabel
  use.title = viewModel.reason
  bindAsyncActionButton(use, () =>
    decideAnagathics(true).catch((error) => reportError(error.message))
  )

  const skip = document.createElement('button')
  skip.type = 'button'
  skip.textContent = viewModel.skipLabel
  bindAsyncActionButton(skip, () =>
    decideAnagathics(false).catch((error) => reportError(error.message))
  )

  actions.append(use, skip)
  panel.append(title, text, actions)
  return panel
}
