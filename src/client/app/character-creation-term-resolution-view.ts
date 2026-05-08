import {
  deriveCharacterCreationAnagathicsDecision,
  deriveCharacterCreationTermSkillTableActions,
  deriveNextCharacterCreationAgingRoll,
  isCharacterCreationCareerTermResolved,
  type CharacterCreationFlow
} from './character-creation-flow.js'
import { formatCharacterCreationReenlistmentOutcome } from './character-creation-view.js'

export interface CharacterCreationTermResolutionDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: string): HTMLElement
  createDocumentFragment(): DocumentFragment
}

export interface CharacterCreationTermResolutionViewDeps {
  completeTerm: (continueCareer: boolean) => void
}

export const renderCharacterCreationTermResolution = (
  document: CharacterCreationTermResolutionDocument,
  flow: CharacterCreationFlow,
  { completeTerm }: CharacterCreationTermResolutionViewDeps
): HTMLElement | DocumentFragment => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-resolution'
  const plan = flow.draft.careerPlan
  const title = document.createElement('strong')
  title.textContent = 'Career term'
  const text = document.createElement('p')

  if (!plan?.career) {
    return document.createDocumentFragment()
  }

  if (!isCharacterCreationCareerTermResolved(flow.draft)) {
    text.textContent = 'Roll each required check. The next roll appears above.'
    panel.append(title, text)
    return panel
  }

  if (deriveCharacterCreationTermSkillTableActions(flow).length > 0) {
    text.textContent =
      'Roll this term’s skills before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (flow.draft.pendingTermCascadeSkills.length > 0) {
    text.textContent =
      'Choose the rolled skill specialty before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (deriveCharacterCreationAnagathicsDecision(flow)) {
    text.textContent =
      'Decide whether this term used anagathics before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (deriveNextCharacterCreationAgingRoll(flow)) {
    text.textContent = 'Roll aging before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (flow.draft.pendingAgingChanges.length > 0) {
    text.textContent = 'Apply aging effects before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  if (plan.survivalPassed === true && !plan.reenlistmentOutcome) {
    text.textContent = 'Roll reenlistment before deciding what happens next.'
    panel.append(title, text)
    return panel
  }

  const survived = plan.survivalPassed === true
  if (!survived) {
    text.textContent =
      'Killed in service. This character cannot muster out or become playable.'
    panel.append(title, text)
    return panel
  }

  text.textContent = formatCharacterCreationReenlistmentOutcome(plan)
  const actions = document.createElement('div')
  actions.className = 'creation-term-actions'

  if (
    survived &&
    (plan.reenlistmentOutcome === 'allowed' ||
      plan.reenlistmentOutcome === 'forced')
  ) {
    const another = document.createElement('button')
    another.type = 'button'
    another.textContent =
      plan.reenlistmentOutcome === 'forced'
        ? 'Serve required term'
        : 'Serve another term'
    another.addEventListener('click', () => completeTerm(true))
    actions.append(another)
  }

  const muster = document.createElement('button')
  muster.type = 'button'
  muster.textContent = 'Muster out'
  muster.addEventListener('click', () => completeTerm(false))
  actions.append(muster)

  panel.append(title, text, actions)
  return panel
}
