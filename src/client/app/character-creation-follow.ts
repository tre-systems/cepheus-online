import type { CharacterId } from '../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../shared/state'
import type { CharacterCreationFlow } from './character-creation-flow.js'
import { flowFromProjectedCharacter } from './character-creation-projection.js'

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
  selectedCharacterId,
  readOnly,
  panelOpen
}: {
  state: GameState | null
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
  const flow = character ? flowFromProjectedCharacter(character) : null
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
