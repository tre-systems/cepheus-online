import type { BenefitKind } from '../../shared/character-creation/types.js'
import {
  canRollCharacterCreationMusteringBenefit,
  characterCreationMusteringBenefitRollModifier,
  remainingMusteringBenefits,
  type CharacterCreationFlow
} from './character-creation-flow.js'
import { bindAsyncActionButton } from './async-action-button.js'

export interface CharacterCreationMusteringDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
}

export interface CharacterCreationMusteringViewDeps {
  rollMusteringBenefit: (kind: BenefitKind) => Promise<void>
  reportError: (message: string) => void
}

export const renderCharacterCreationMusteringOut = (
  document: CharacterCreationMusteringDocument,
  flow: CharacterCreationFlow,
  { rollMusteringBenefit, reportError }: CharacterCreationMusteringViewDeps
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-mustering-out'
  const title = document.createElement('strong')
  title.textContent = 'Mustering out'
  const remaining = remainingMusteringBenefits(flow.draft)
  const summary = document.createElement('p')
  summary.textContent =
    flow.draft.completedTerms.length === 0
      ? 'No career terms completed yet.'
      : remaining > 0
        ? `${remaining} benefit ${remaining === 1 ? 'roll' : 'rolls'} remaining.`
        : 'Benefits complete.'

  const benefitList = document.createElement('div')
  benefitList.className = 'creation-benefit-list'
  for (const benefit of flow.draft.musteringBenefits) {
    const item = document.createElement('span')
    item.textContent = `${benefit.career}: ${benefit.kind} ${benefit.roll} -> ${benefit.value}`
    benefitList.append(item)
  }

  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'
  const benefitActions = [
    ['cash', 'Roll cash'],
    ['material', 'Roll benefit']
  ] satisfies readonly [BenefitKind, string][]
  for (const [kind, label] of benefitActions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    const modifier = characterCreationMusteringBenefitRollModifier({
      draft: flow.draft,
      kind
    })
    button.disabled =
      remaining <= 0 ||
      !canRollCharacterCreationMusteringBenefit({ draft: flow.draft, kind })
    if (modifier !== 0) {
      button.title = `${modifier > 0 ? '+' : ''}${modifier} DM`
    }
    bindAsyncActionButton(button, () =>
      rollMusteringBenefit(kind).catch((error) => reportError(error.message))
    )
    actions.append(button)
  }

  panel.append(title, summary, benefitList, actions)
  return panel
}
