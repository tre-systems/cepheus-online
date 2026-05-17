import type { CharacterId } from '../../../../shared/ids'
import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import {
  batch,
  createDisposalScope,
  type ReadonlySignal,
  signal
} from '../../../reactive'
import type { CharacterCreationFlow } from './flow'
import {
  canRenderReadOnlyFollowFromReadModel,
  projectedCharacterCreation,
  refreshFollowedCharacterCreationFlowFromState,
  shouldRefreshEditableCharacterCreationFlow,
  syncCharacterCreationFlowFromRoomState
} from './follow'
import { shouldSyncEditableCharacterCreationFlowWithProjection } from './sync'
import {
  deriveCharacterCreationViewModel,
  flowFromProjectedCharacterReadModel,
  type CharacterCreationViewModel
} from './model'

export interface CharacterCreationController {
  flowSignal: ReadonlySignal<CharacterCreationFlow | null>
  readOnlySignal: ReadonlySignal<boolean>
  selectedCharacterIdSignal: ReadonlySignal<CharacterId | null>
  viewModelSignal: ReadonlySignal<CharacterCreationViewModel>
  flow: () => CharacterCreationFlow | null
  setFlow: (flow: CharacterCreationFlow | null) => CharacterCreationFlow | null
  readOnly: () => boolean
  setReadOnly: (readOnly: boolean) => boolean
  selectedCharacterId: () => CharacterId | null
  setSelectedCharacterId: (
    characterId: CharacterId | null
  ) => CharacterId | null
  currentProjection: () => CharacterCreationProjection | null
  viewModel: () => CharacterCreationViewModel
  openFollow: (
    characterId: CharacterId,
    options?: { readOnly?: boolean; state?: GameState | null }
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
  getRuleset,
  isPanelOpen,
  closePanel
}: {
  getState: () => GameState | null
  getRuleset: () => CepheusRuleset | null
  isPanelOpen: () => boolean
  closePanel: () => void
}): CharacterCreationController => {
  const scope = createDisposalScope()
  const flow = signal<CharacterCreationFlow | null>(null)
  const readOnly = signal(false)
  const selectedCharacterId = signal<CharacterId | null>(null)
  const projectionRevision = signal(0)

  const currentProjection = (): CharacterCreationProjection | null => {
    projectionRevision.value
    const currentFlow = flow.value
    const characterId =
      currentFlow?.draft.characterId ?? selectedCharacterId.value
    if (!characterId) return null
    return projectedCharacterCreation(getState(), characterId)
  }

  const bumpProjectionRevision = (): void => {
    projectionRevision.update((revision) => revision + 1)
  }

  const viewModel = scope.computed(() => {
    const characterId =
      flow.value?.draft.characterId ?? selectedCharacterId.value
    return deriveCharacterCreationViewModel({
      flow: flow.value,
      projection: currentProjection(),
      character: characterId
        ? (getState()?.characters[characterId] ?? null)
        : null,
      readOnly: readOnly.value,
      ruleset: getRuleset()
    })
  })

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
    viewModelSignal: viewModel,
    flow: () => flow.value,
    setFlow,
    readOnly: () => readOnly.value,
    setReadOnly,
    selectedCharacterId: () => selectedCharacterId.value,
    setSelectedCharacterId,
    currentProjection,
    viewModel: () => viewModel.value,

    openFollow: (
      characterId,
      { readOnly: nextReadOnly = true, state: sourceState = getState() } = {}
    ) => {
      const character = sourceState?.characters[characterId] ?? null
      if (!character?.creation) return null
      if (nextReadOnly && !canRenderReadOnlyFollowFromReadModel(character)) {
        return null
      }
      const useReadModelOnly =
        nextReadOnly || character.creation.state.status === 'CHARACTERISTICS'
      const nextFlow = useReadModelOnly
        ? null
        : flowFromProjectedCharacterReadModel(character)
      if (!useReadModelOnly && !nextFlow) return null

      batch(() => {
        bumpProjectionRevision()
        selectedCharacterId.value = characterId
        flow.value = nextFlow
        readOnly.value = nextReadOnly
      })
      return flow.value
    },

    syncFlowFromRoomState: (roomState, characterId, fallbackFlow = null) => {
      batch(() => {
        bumpProjectionRevision()
        if (roomState?.characters?.[characterId]?.creation) {
          selectedCharacterId.value = characterId
        }
        flow.value = syncCharacterCreationFlowFromRoomState({
          currentFlow: flow.value,
          roomState,
          characterId,
          fallbackFlow
        })
      })
      return flow.value
    },

    reconcileEditableWithProjection: (creation) => {
      bumpProjectionRevision()
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
        currentFlow: flow.value,
        selectedCharacterId: selectedCharacterId.value,
        readOnly: readOnly.value,
        panelOpen: isPanelOpen()
      })

      batch(() => {
        bumpProjectionRevision()
        flow.value = refresh.flow
        readOnly.value = refresh.readOnly
        if (refresh.shouldClose) {
          selectedCharacterId.value = null
        }
      })
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
      batch(() => {
        flow.value = null
        readOnly.value = false
        selectedCharacterId.value = null
      })
    },

    clearReadOnlyFollow: () => {
      if (!readOnly.value) return
      batch(() => {
        flow.value = null
        readOnly.value = false
        selectedCharacterId.value = null
      })
    },

    dispose: scope.dispose
  }
}
