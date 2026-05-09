import type { GameCommand } from '../../shared/commands'
import type { GameState } from '../../shared/state'
import {
  type BootstrapCommandContext,
  nextBootstrapCommand
} from './bootstrap-flow.js'

export interface RoomBootstrapScene {
  run: () => Promise<void>
}

export interface RoomBootstrapSceneOptions {
  getIdentity: () => BootstrapCommandContext
  getState: () => GameState | null
  postCommand: (command: GameCommand, requestId?: string) => Promise<unknown>
  fetchState: () => Promise<unknown>
  clearError: () => void
  planNextCommand?: typeof nextBootstrapCommand
  maxSteps?: number
}

export const createRoomBootstrapScene = ({
  getIdentity,
  getState,
  postCommand,
  fetchState,
  clearError,
  planNextCommand = nextBootstrapCommand,
  maxSteps = 10
}: RoomBootstrapSceneOptions): RoomBootstrapScene => ({
  run: async () => {
    clearError()
    for (let i = 0; i < maxSteps; i++) {
      const command = planNextCommand({
        ...getIdentity(),
        state: getState()
      })
      if (!command) break
      await postCommand(command, `bootstrap-${i}`)
    }
    await fetchState()
  }
})
