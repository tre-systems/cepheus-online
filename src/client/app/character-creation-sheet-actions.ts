import type { CharacterState } from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'
import type { CharacterCreationCommand } from './app-command-router.js'
import { deriveCharacterCreationActionPlan } from './character-creation-actions.js'

export interface CharacterCreationSheetActionsDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: 'div'): HTMLDivElement
}

export interface CharacterCreationSheetActionsDeps {
  document: CharacterCreationSheetActionsDocument
  identity: () => ClientIdentity
  dispatch: (command: CharacterCreationCommand) => Promise<unknown>
  reportError: (message: string) => void
}

export interface CharacterCreationSheetActionsView {
  title: string
  status: string
  summary: string
  actions: HTMLElement | null
}

export const renderCharacterCreationSheetActions = (
  character: CharacterState | null,
  {
    document,
    identity,
    dispatch,
    reportError
  }: CharacterCreationSheetActionsDeps
): CharacterCreationSheetActionsView | null => {
  if (!character) return null

  const plan = deriveCharacterCreationActionPlan(identity(), character)
  if (!plan) return null

  const actions = document.createElement('div')
  actions.className = 'sheet-actions creation-actions'

  for (const viewModel of plan.actions) {
    if (!viewModel.command) continue

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = viewModel.label
    button.className = viewModel.variant === 'primary' ? 'active' : ''
    button.addEventListener('click', () => {
      dispatch(viewModel.command as CharacterCreationCommand).catch(
        (error: Error) => {
          reportError(error.message)
        }
      )
    })
    actions.append(button)
  }

  return {
    title: plan.title,
    status: plan.status,
    summary: plan.summary,
    actions: actions.childElementCount > 0 ? actions : null
  }
}
