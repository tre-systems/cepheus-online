import type { CharacteristicKey } from '../../shared/state.js'
import type {
  CharacterCreationCharacteristicRollKey,
  CharacterCreationFlow
} from './character-creation-flow.js'
import { bindAsyncActionButton } from './async-action-button.js'
import {
  deriveCharacterCreationFieldViewModels,
  formatCharacterCreationCharacteristicModifier
} from './character-creation-view.js'

export interface CharacterCreationCharacteristicsDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
}

export interface CharacterCreationCharacteristicsViewDeps {
  rollCharacteristic: (
    characteristicKey: CharacterCreationCharacteristicRollKey
  ) => Promise<void>
  reportError: (message: string) => void
}

export const renderCharacterCreationCharacteristicGrid = (
  document: CharacterCreationCharacteristicsDocument,
  flow: CharacterCreationFlow,
  { rollCharacteristic, reportError }: CharacterCreationCharacteristicsViewDeps
): HTMLElement => {
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
      const characteristicKey = field.key as CharacteristicKey
      bindAsyncActionButton(rollButton, () =>
        rollCharacteristic(characteristicKey).catch((error) =>
          reportError(error.message)
        )
      )
      modifier.textContent = ''
      row.append(rollButton, modifier)
    } else {
      const value = document.createElement('strong')
      value.textContent = field.value
      modifier.textContent = formatCharacterCreationCharacteristicModifier(
        field.value
      )
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
