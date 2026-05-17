import type { BenefitKind } from '../../../../../shared/character-creation/types'
import { bindAsyncActionButton } from '../../../core/async-button'
import type { CharacterCreationMusteringOutViewModel } from '../view'

export interface CharacterCreationMusteringDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
}

export interface CharacterCreationMusteringViewDeps {
  rollMusteringBenefit: (career: string, kind: BenefitKind) => Promise<void>
  reportError: (message: string) => void
}

export const renderCharacterCreationMusteringOut = (
  document: CharacterCreationMusteringDocument,
  viewModel: CharacterCreationMusteringOutViewModel,
  { rollMusteringBenefit, reportError }: CharacterCreationMusteringViewDeps
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-mustering-out'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const summary = document.createElement('p')
  summary.textContent = viewModel.summary

  const benefitList = document.createElement('div')
  benefitList.className = 'creation-benefit-list'
  for (const benefit of viewModel.benefits) {
    const item = document.createElement('div')
    item.className = 'creation-benefit-card'
    const label = document.createElement('span')
    label.textContent = benefit.label
    const value = document.createElement('strong')
    value.textContent = benefit.valueLabel
    const roll = document.createElement('small')
    roll.textContent = benefit.rollLabel
    const meta = document.createElement('small')
    meta.textContent = benefit.metaLabel
    item.append(label, value, roll, meta)
    benefitList.append(item)
  }

  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'
  for (const action of viewModel.actions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = action.label
    button.disabled = action.disabled
    if (action.title) button.title = action.title
    bindAsyncActionButton(button, () =>
      rollMusteringBenefit(action.career, action.kind).catch((error) =>
        reportError(error.message)
      )
    )
    actions.append(button)
  }

  panel.append(title, summary, benefitList, actions)
  return panel
}
