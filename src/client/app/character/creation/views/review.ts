import type {
  CharacterCreationReviewSummary,
  CharacterCreationTermHistoryViewModel
} from '../view.js'

export type CharacterCreationReviewDocument = Pick<
  Document,
  'createElement' | 'createDocumentFragment'
>

export const renderCharacterCreationTermHistory = (
  document: CharacterCreationReviewDocument,
  viewModel: CharacterCreationTermHistoryViewModel
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-history'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const list = document.createElement('div')
  for (const term of viewModel.terms) {
    const item = document.createElement('span')
    item.textContent = term
    list.append(item)
  }
  panel.append(title, list)
  return panel
}

export const renderCharacterCreationReview = (
  document: CharacterCreationReviewDocument,
  summary: CharacterCreationReviewSummary
): HTMLElement => {
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
