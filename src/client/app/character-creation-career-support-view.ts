import type { CharacteristicKey } from '../../shared/state.js'
import {
  deriveCharacterCreationAgingChangeOptions,
  deriveCharacterCreationAnagathicsDecision,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationReenlistmentRoll,
  type CharacterCreationFlow,
  type CharacterCreationTermSkillTable
} from './character-creation-flow.js'
import { bindAsyncActionButton } from './async-action-button.js'
import { deriveCharacterCreationTermSkillTrainingViewModel } from './character-creation-view.js'

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
  flow: CharacterCreationFlow,
  {
    rollTermSkill,
    reportError
  }: Pick<
    CharacterCreationCareerSupportViewDeps,
    'rollTermSkill' | 'reportError'
  >
): HTMLElement | DocumentFragment => {
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
  flow: CharacterCreationFlow,
  {
    rollReenlistment,
    reportError
  }: Pick<
    CharacterCreationCareerSupportViewDeps,
    'rollReenlistment' | 'reportError'
  >
): HTMLElement | null => {
  const action = deriveNextCharacterCreationReenlistmentRoll(flow)
  if (!action) return null

  const panel = document.createElement('div')
  panel.className = 'creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = action.label
  bindAsyncActionButton(button, () =>
    rollReenlistment().catch((error) => reportError(error.message))
  )
  const note = document.createElement('small')
  note.textContent = action.reason
  panel.append(button, note)
  return panel
}

export const renderCharacterCreationAgingRollButton = (
  document: CharacterCreationCareerSupportDocument,
  flow: CharacterCreationFlow,
  {
    rollAging,
    reportError
  }: Pick<CharacterCreationCareerSupportViewDeps, 'rollAging' | 'reportError'>
): HTMLElement | null => {
  const action = deriveNextCharacterCreationAgingRoll(flow)
  if (!action) return null

  const panel = document.createElement('div')
  panel.className = 'creation-roll-action'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = action.label
  bindAsyncActionButton(button, () =>
    rollAging().catch((error) => reportError(error.message))
  )
  const note = document.createElement('small')
  const modifier = action.modifier === 0 ? '' : ` (${action.modifier})`
  note.textContent = `${action.reason}${modifier}`
  panel.append(button, note)
  return panel
}

export const renderCharacterCreationAgingChoices = (
  document: CharacterCreationCareerSupportDocument,
  flow: CharacterCreationFlow,
  {
    applyAgingChange
  }: Pick<CharacterCreationCareerSupportViewDeps, 'applyAgingChange'>
): HTMLElement | DocumentFragment => {
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
        applyAgingChange(change.index, option)
      })
      row.append(button)
    }
    panel.append(row)
  }

  return panel
}

export const renderCharacterCreationAnagathicsDecision = (
  document: CharacterCreationCareerSupportDocument,
  flow: CharacterCreationFlow,
  {
    decideAnagathics,
    reportError
  }: Pick<
    CharacterCreationCareerSupportViewDeps,
    'decideAnagathics' | 'reportError'
  >
): HTMLElement | DocumentFragment => {
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
  bindAsyncActionButton(use, () =>
    decideAnagathics(true).catch((error) => reportError(error.message))
  )

  const skip = document.createElement('button')
  skip.type = 'button'
  skip.textContent = 'Skip'
  bindAsyncActionButton(skip, () =>
    decideAnagathics(false).catch((error) => reportError(error.message))
  )

  actions.append(use, skip)
  panel.append(title, text, actions)
  return panel
}
