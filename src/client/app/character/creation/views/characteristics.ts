import type { CharacterCreationCharacteristicRollKey } from '../flow'
import { bindAsyncActionButton } from '../../../core/async-button'
import type { CharacterCreationCharacteristicGridViewModel } from '../view'

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
  viewModel: CharacterCreationCharacteristicGridViewModel,
  { rollCharacteristic, reportError }: CharacterCreationCharacteristicsViewDeps
): HTMLElement => {
  const grid = document.createElement('div')
  grid.className = 'creation-stat-grid dice-stat-grid'
  for (const stat of viewModel.stats) {
    const cell = document.createElement('div')
    cell.className = 'creation-stat-cell dice-stat-cell'
    const name = document.createElement('span')
    name.textContent = stat.label
    const row = document.createElement('span')
    row.className = 'creation-stat-value-row'
    const modifier = document.createElement('small')
    if (stat.missing) {
      const rollButton = document.createElement('button')
      rollButton.type = 'button'
      rollButton.className = 'stat-die-button'
      rollButton.setAttribute('aria-label', stat.rollLabel)
      rollButton.title = stat.rollLabel
      for (let index = 0; index < 5; index += 1) {
        const pip = document.createElement('span')
        pip.className = 'stat-die-pip'
        rollButton.append(pip)
      }
      bindAsyncActionButton(rollButton, () =>
        rollCharacteristic(stat.key).catch((error) =>
          reportError(error.message)
        )
      )
      modifier.textContent = ''
      row.append(rollButton, modifier)
    } else {
      const value = document.createElement('strong')
      value.textContent = stat.value
      modifier.textContent = stat.modifier
      row.append(value, modifier)
    }
    cell.append(name, row)
    if (stat.errors.length > 0 && !stat.missing) {
      const error = document.createElement('small')
      error.className = 'creation-stat-error'
      error.textContent = stat.errors.join(', ')
      cell.append(error)
    }
    grid.append(cell)
  }
  return grid
}
