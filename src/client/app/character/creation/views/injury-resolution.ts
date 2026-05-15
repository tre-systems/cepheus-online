import type { CharacteristicKey } from '../../../../../shared/state'
import type { InjuryResolutionMethod } from '../../../../../shared/characterCreation'
import { bindAsyncActionButton } from '../../../core/async-button.js'
import type { CharacterCreationInjuryResolutionViewModel } from '../view.js'

export interface CharacterCreationInjuryResolutionDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
}

export interface CharacterCreationInjuryResolutionViewDeps {
  readOnly: boolean
  resolveInjury: (
    characteristic: CharacteristicKey,
    method?: InjuryResolutionMethod
  ) => Promise<void> | void
}

export const renderCharacterCreationInjuryResolution = (
  document: CharacterCreationInjuryResolutionDocument,
  viewModel: CharacterCreationInjuryResolutionViewModel,
  { readOnly, resolveInjury }: CharacterCreationInjuryResolutionViewDeps
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'

  const title = document.createElement('strong')
  title.textContent = viewModel.title

  const text = document.createElement('p')
  text.textContent = viewModel.message

  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  const methods =
    viewModel.methods.length > 0
      ? viewModel.methods
      : [{ method: undefined, label: '' }]

  for (const method of methods) {
    for (const target of viewModel.targets) {
      const button = document.createElement('button')
      button.type = 'button'
      button.disabled = readOnly
      button.textContent = [
        method.label,
        `${target.label} ${target.value}${target.modifier ? ` ${target.modifier}` : ''}`
      ]
        .filter(Boolean)
        .join(': ')
      bindAsyncActionButton(button, () =>
        resolveInjury(target.characteristic, method.method)
      )
      actions.append(button)
    }
  }

  panel.append(title, text, actions)
  return panel
}
