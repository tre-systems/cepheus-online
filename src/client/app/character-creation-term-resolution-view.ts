import { bindAsyncActionButton } from './async-action-button.js'
import type { CharacterCreationTermResolutionViewModel } from './character-creation-view.js'

export interface CharacterCreationTermResolutionDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
  createDocumentFragment(): DocumentFragment
}

export interface CharacterCreationTermResolutionViewDeps {
  completeTerm: (continueCareer: boolean) => Promise<void> | void
}

export const renderCharacterCreationTermResolution = (
  document: CharacterCreationTermResolutionDocument,
  viewModel: CharacterCreationTermResolutionViewModel,
  { completeTerm }: CharacterCreationTermResolutionViewDeps
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const text = document.createElement('p')
  text.textContent = viewModel.message

  if (viewModel.actions.length === 0) {
    panel.append(title, text)
    return panel
  }

  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  for (const action of viewModel.actions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = action.label
    bindAsyncActionButton(button, () => completeTerm(action.continueCareer))
    actions.append(button)
  }

  panel.append(title, text, actions)
  return panel
}
