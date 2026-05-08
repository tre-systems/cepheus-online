import type { CharacterId } from '../../shared/ids'
import type { CharacterCreationProjection, GameState } from '../../shared/state'
import {
  createDisposalScope,
  signal,
  type ReadonlySignal
} from '../reactive.js'
import type { CharacterCreationFlow } from './character-creation-flow.js'
import { flowFromProjectedCharacter } from './character-creation-projection.js'
import {
  refreshFollowedCharacterCreationFlowFromState,
  shouldRefreshEditableCharacterCreationFlow,
  syncCharacterCreationFlowFromRoomState
} from './character-creation-follow.js'
import { shouldSyncEditableCharacterCreationFlowWithProjection } from './character-creation-sync.js'

export interface CharacterCreationController {
  flowSignal: ReadonlySignal<CharacterCreationFlow | null>
  readOnlySignal: ReadonlySignal<boolean>
  selectedCharacterIdSignal: ReadonlySignal<CharacterId | null>
  flow: () => CharacterCreationFlow | null
  setFlow: (flow: CharacterCreationFlow | null) => CharacterCreationFlow | null
  readOnly: () => boolean
  setReadOnly: (readOnly: boolean) => boolean
  selectedCharacterId: () => CharacterId | null
  setSelectedCharacterId: (
    characterId: CharacterId | null
  ) => CharacterId | null
  openFollow: (
    characterId: CharacterId,
    options?: { readOnly?: boolean }
  ) => CharacterCreationFlow | null
  syncFlowFromRoomState: (
    roomState: GameState | null,
    characterId: CharacterId,
    fallbackFlow?: CharacterCreationFlow | null
  ) => CharacterCreationFlow | null
  reconcileEditableWithProjection: (
    creation: CharacterCreationProjection | null
  ) => CharacterCreationFlow | null
  refreshFollowed: () => boolean
  shouldRefreshEditable: (options?: { deferredRollCount?: number }) => boolean
  resetForNewCreation: () => void
  clearReadOnlyFollow: () => void
  dispose: () => void
}

export const createCharacterCreationController = ({
  getState,
  isPanelOpen,
  closePanel
}: {
  getState: () => GameState | null
  isPanelOpen: () => boolean
  closePanel: () => void
}): CharacterCreationController => {
  const scope = createDisposalScope()
  const flow = signal<CharacterCreationFlow | null>(null)
  const readOnly = signal(false)
  const selectedCharacterId = signal<CharacterId | null>(null)

  const setFlow = (
    nextFlow: CharacterCreationFlow | null
  ): CharacterCreationFlow | null => {
    flow.value = nextFlow
    return flow.value
  }

  const setReadOnly = (nextReadOnly: boolean): boolean => {
    readOnly.value = nextReadOnly
    return readOnly.value
  }

  const setSelectedCharacterId = (
    characterId: CharacterId | null
  ): CharacterId | null => {
    selectedCharacterId.value = characterId
    return selectedCharacterId.value
  }

  return {
    flowSignal: flow,
    readOnlySignal: readOnly,
    selectedCharacterIdSignal: selectedCharacterId,
    flow: () => flow.value,
    setFlow,
    readOnly: () => readOnly.value,
    setReadOnly,
    selectedCharacterId: () => selectedCharacterId.value,
    setSelectedCharacterId,

    openFollow: (characterId, { readOnly: nextReadOnly = true } = {}) => {
      const character = getState()?.characters[characterId] ?? null
      const nextFlow = character ? flowFromProjectedCharacter(character) : null
      if (!nextFlow) return null

      selectedCharacterId.value = characterId
      flow.value = nextFlow
      readOnly.value = nextReadOnly
      return flow.value
    },

    syncFlowFromRoomState: (roomState, characterId, fallbackFlow = null) => {
      flow.value = syncCharacterCreationFlowFromRoomState({
        currentFlow: flow.value,
        roomState,
        characterId,
        fallbackFlow
      })
      return flow.value
    },

    reconcileEditableWithProjection: (creation) => {
      const currentFlow = flow.value
      if (
        shouldSyncEditableCharacterCreationFlowWithProjection({
          flow: currentFlow,
          creation,
          readOnly: readOnly.value
        }) &&
        currentFlow
      ) {
        return setFlow(
          syncCharacterCreationFlowFromRoomState({
            currentFlow,
            roomState: getState(),
            characterId: currentFlow.draft.characterId,
            fallbackFlow: currentFlow
          })
        )
      }

      return flow.value
    },

    refreshFollowed: () => {
      if (!readOnly.value || !selectedCharacterId.value) return false

      const refresh = refreshFollowedCharacterCreationFlowFromState({
        state: getState(),
        selectedCharacterId: selectedCharacterId.value,
        readOnly: readOnly.value,
        panelOpen: isPanelOpen()
      })

      flow.value = refresh.flow
      readOnly.value = refresh.readOnly
      if (refresh.shouldClose) {
        closePanel()
      }

      return refresh.shouldRender
    },

    shouldRefreshEditable: ({ deferredRollCount = 0 } = {}) =>
      shouldRefreshEditableCharacterCreationFlow({
        readOnly: readOnly.value,
        panelOpen: isPanelOpen(),
        flow: flow.value,
        deferredRollCount
      }),

    resetForNewCreation: () => {
      flow.value = null
      readOnly.value = false
      selectedCharacterId.value = null
    },

    clearReadOnlyFollow: () => {
      if (!readOnly.value) return
      flow.value = null
      readOnly.value = false
      selectedCharacterId.value = null
    },

    dispose: scope.dispose
  }
}
