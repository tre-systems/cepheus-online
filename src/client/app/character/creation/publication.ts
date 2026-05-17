import type { GameState } from '../../../../shared/state'
import type { ClientIdentity } from '../../../game-commands'
import type { CharacterCreationCommand } from '../../core/command-router'
import {
  deriveCreateCharacterCommand,
  deriveStartCharacterCreationCommand,
  type CharacterCreationFlow
} from './flow'

export interface CharacterCreationPublicationControllerDeps {
  getFlow: () => CharacterCreationFlow | null
  getState: () => GameState | null
  isReadOnly: () => boolean
  identity: () => ClientIdentity
  createGame: () => Promise<unknown>
  postCharacterCreationCommands: (
    commands: readonly CharacterCreationCommand[]
  ) => Promise<unknown>
  reportError: (message: string) => void
}

export interface CharacterCreationPublicationController {
  ensurePublished: () => Promise<void>
}

export const createCharacterCreationPublicationController = ({
  getFlow,
  getState,
  isReadOnly,
  identity,
  createGame,
  postCharacterCreationCommands,
  reportError
}: CharacterCreationPublicationControllerDeps): CharacterCreationPublicationController => {
  let publishPromise: Promise<void> | null = null

  const ensurePublishedNow = async (): Promise<void> => {
    const flow = getFlow()
    if (!flow || isReadOnly()) return

    if (!getState()) {
      await createGame()
    }

    const publishedFlow = getFlow()
    const state = getState()
    if (!state || !publishedFlow) return

    const characterId = publishedFlow.draft.characterId
    const character = state.characters[characterId] ?? null
    const commands: CharacterCreationCommand[] = []

    if (!character) {
      commands.push(
        deriveCreateCharacterCommand(publishedFlow.draft, {
          identity: identity(),
          state: null
        }) as CharacterCreationCommand
      )
    }

    if (!character?.creation) {
      commands.push(
        deriveStartCharacterCreationCommand(publishedFlow.draft, {
          identity: identity(),
          state: null
        }) as CharacterCreationCommand
      )
    }

    if (commands.length > 0) {
      await postCharacterCreationCommands(commands)
    }
  }

  return {
    ensurePublished: () => {
      if (!publishPromise) {
        publishPromise = ensurePublishedNow()
          .catch((error) => {
            reportError(error.message)
            throw error
          })
          .finally(() => {
            publishPromise = null
          })
      }
      return publishPromise
    }
  }
}
