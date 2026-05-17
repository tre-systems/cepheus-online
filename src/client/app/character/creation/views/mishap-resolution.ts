import { bindAsyncActionButton } from '../../../core/async-button'
import type { CharacterCreationMishapResolutionViewModel } from '../view'

export interface CharacterCreationMishapResolutionDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
}

export interface CharacterCreationMishapResolutionViewDeps {
  resolveMishap: () => Promise<void> | void
}

export const renderCharacterCreationMishapResolution = (
  document: CharacterCreationMishapResolutionDocument,
  viewModel: CharacterCreationMishapResolutionViewModel,
  { resolveMishap }: CharacterCreationMishapResolutionViewDeps
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'

  const title = document.createElement('strong')
  title.textContent = viewModel.title

  const text = document.createElement('p')
  text.textContent = viewModel.message

  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = viewModel.buttonLabel
  bindAsyncActionButton(button, resolveMishap)
  actions.append(button)

  panel.append(title, text, actions)
  return panel
}
