import type { CharacterCreationFlow } from './character-creation-flow.js'
import {
  deriveCharacterCreationReviewSummary,
  formatCharacterCreationCompletedTermSummary
} from './character-creation-view.js'

export type CharacterCreationReviewDocument = Pick<
  Document,
  'createElement' | 'createDocumentFragment'
>

export const renderCharacterCreationTermHistory = (
  document: CharacterCreationReviewDocument,
  flow: CharacterCreationFlow
): HTMLElement | DocumentFragment => {
  if (flow.draft.completedTerms.length === 0) {
    return document.createDocumentFragment()
  }
  const panel = document.createElement('div')
  panel.className = 'creation-term-history'
  const title = document.createElement('strong')
  title.textContent = 'Terms served'
  const list = document.createElement('div')
  for (const [index, term] of flow.draft.completedTerms.entries()) {
    const item = document.createElement('span')
    item.textContent = formatCharacterCreationCompletedTermSummary(term, index)
    list.append(item)
  }
  panel.append(title, list)
  return panel
}

export const renderCharacterCreationReview = (
  document: CharacterCreationReviewDocument,
  flow: CharacterCreationFlow
): HTMLElement => {
  const summary = deriveCharacterCreationReviewSummary(flow)
  const review = document.createElement('div')
  review.className = 'character-creation-review'
  const title = document.createElement('strong')
  title.textContent = summary.title
  const subtitle = document.createElement('p')
  subtitle.textContent = summary.subtitle
  review.append(title, subtitle)

  for (const section of summary.sections) {
    const group = document.createElement('dl')
    const heading = document.createElement('dt')
    heading.textContent = section.label
    group.append(heading)
    for (const item of section.items) {
      const row = document.createElement('dd')
      row.textContent = `${item.label}: ${item.value}`
      group.append(row)
    }
    review.append(group)
  }

  return review
}
