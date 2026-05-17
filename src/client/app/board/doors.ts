import type { Command } from '../../../shared/commands'
import type { BoardState, GameState } from '../../../shared/state'
import {
  buildSetDoorOpenCommand,
  type ClientIdentity
} from '../../game-commands'
import { deriveDoorToggleViewModels } from './los-view'

type DoorCommand = Extract<Command, { type: 'SetDoorOpen' }>

export interface BoardDoorActionsDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: 'div'): HTMLDivElement
}

export interface BoardDoorActionsDeps {
  document: BoardDoorActionsDocument
  identity: () => ClientIdentity
  getState: () => GameState | null
  dispatch: (command: DoorCommand) => Promise<unknown>
  reportError: (message: string) => void
}

export interface BoardDoorActions {
  render: (board: BoardState | null) => HTMLElement | null
}

export const createBoardDoorActions = ({
  document,
  identity,
  getState,
  dispatch,
  reportError
}: BoardDoorActionsDeps): BoardDoorActions => ({
  render: (board) => {
    if (!board) return null
    const doors = deriveDoorToggleViewModels(board)
    if (doors.length === 0) return null

    const actions = document.createElement('div')
    actions.className = 'sheet-actions'
    for (const door of doors) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = door.toggleLabel
      button.className = door.open ? 'active' : ''
      button.title = `${door.label}: ${door.stateLabel}`
      button.addEventListener('click', () => {
        const state = getState()
        if (!state) return
        dispatch(
          buildSetDoorOpenCommand({
            identity: identity(),
            state,
            boardId: board.id,
            doorId: door.id,
            open: door.nextOpen
          })
        ).catch((error: Error) => reportError(error.message))
      })
      actions.append(button)
    }
    return actions
  }
})
