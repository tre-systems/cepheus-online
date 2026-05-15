import type { CharacterId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import { legacyFlowFromProjectedCharacter } from './projection.js'

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
    ? legacyFlowFromProjectedCharacter(projectedCharacter)
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
  if (!character?.creation) {
    return {
      flow: null,
      readOnly: false,
      shouldClose: true,
      shouldRender: false
    }
  }
  if (character.creation.state.status === 'CHARACTERISTICS') {
    return {
      flow: currentFlow?.step === 'characteristics' ? currentFlow : null,
      readOnly,
      shouldClose: false,
      shouldRender: panelOpen
    }
  }
  const flow = syncCharacterCreationFlowFromRoomState({
    currentFlow,
    roomState: state,
    characterId: selectedCharacterId,
    fallbackFlow: currentFlow
  })
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
