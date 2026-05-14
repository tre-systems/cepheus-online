import type { CharacterId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import { flowFromProjectedCharacter } from './projection.js'
import { characterCreationStepIndex } from './sync.js'

export const projectedCharacterCreation = (
  state: GameState | null,
  characterId: CharacterId
): CharacterCreationProjection | null =>
  state?.characters[characterId]?.creation ?? null

export const syncCharacterCreationFlowFromRoomState = ({
  currentFlow,
  roomState,
  characterId,
  fallbackFlow = null
}: {
  currentFlow: CharacterCreationFlow | null
  roomState: GameState | null
  characterId: CharacterId
  fallbackFlow?: CharacterCreationFlow | null
}): CharacterCreationFlow | null => {
  const projectedCharacter = roomState?.characters?.[characterId] ?? null
  const projectedFlow = projectedCharacter
    ? flowFromProjectedCharacter(projectedCharacter)
    : null
  if (
    projectedFlow &&
    fallbackFlow &&
    ['skills', 'equipment', 'review'].includes(fallbackFlow.step) &&
    ['MUSTERING_OUT', 'ACTIVE'].includes(
      projectedCharacter?.creation?.state.status ?? ''
    ) &&
    characterCreationStepIndex(projectedFlow.step) <
      characterCreationStepIndex(fallbackFlow.step)
  ) {
    return fallbackFlow
  }

  return projectedFlow ?? fallbackFlow ?? currentFlow
}

export interface FollowedCharacterCreationRefresh {
  flow: CharacterCreationFlow | null
  readOnly: boolean
  shouldClose: boolean
  shouldRender: boolean
}

export const refreshFollowedCharacterCreationFlowFromState = ({
  state,
  currentFlow,
  selectedCharacterId,
  readOnly,
  panelOpen
}: {
  state: GameState | null
  currentFlow: CharacterCreationFlow | null
  selectedCharacterId: CharacterId | null
  readOnly: boolean
  panelOpen: boolean
}): FollowedCharacterCreationRefresh => {
  if (!readOnly || !selectedCharacterId) {
    return {
      flow: null,
      readOnly,
      shouldClose: false,
      shouldRender: false
    }
  }

  const character = state?.characters[selectedCharacterId] ?? null
  const flow = character?.creation
    ? syncCharacterCreationFlowFromRoomState({
        currentFlow,
        roomState: state,
        characterId: selectedCharacterId,
        fallbackFlow: currentFlow
      })
    : null
  if (!flow) {
    return {
      flow: null,
      readOnly: false,
      shouldClose: true,
      shouldRender: false
    }
  }

  return {
    flow,
    readOnly,
    shouldClose: false,
    shouldRender: panelOpen
  }
}

export const shouldRefreshEditableCharacterCreationFlow = ({
  readOnly,
  panelOpen,
  flow,
  deferredRollCount
}: {
  readOnly: boolean
  panelOpen: boolean
  flow: CharacterCreationFlow | null
  deferredRollCount: number
}): boolean =>
  !readOnly && panelOpen && Boolean(flow) && deferredRollCount === 0
