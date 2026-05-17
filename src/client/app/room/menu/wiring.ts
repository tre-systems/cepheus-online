import type { PieceId } from '../../../../shared/ids'
import type { Disposable } from '../../core/disposable.js'
import type { RequiredAppElements } from '../../core/elements.js'
import {
  createRoomMenuController,
  type RoomIdentity,
  type RoomMenuControllerOptions
} from './controller.js'

export interface RoomMenuWiringOptions {
  elements: RequiredAppElements
  initialRoomId: string
  initialActorId: string
  defaultRoomId: string
  defaultActorId: string
  getCurrentActorId?: () => string
  createRoom?: RoomMenuControllerOptions['createRoom']
  createInvite?: RoomMenuControllerOptions['createInvite']
  acceptInvite?: RoomMenuControllerOptions['acceptInvite']
  onOpenRoomIdentity: (identity: RoomIdentity) => void
  setAppSessionRoomIdentity: (identity: RoomIdentity) => void
  resetDiceRevealTracking: () => void
  clearSelectedCharacter: () => void
  clearCreationActivityFeed: () => void
  hydrateCreationPresenceDock: () => void
  selectPiece: (pieceId: PieceId | null) => void
  clearBoardDrag: () => void
  closeCharacterSheet: () => void
  connectSocket: () => void
  fetchState: () => Promise<unknown>
  reportError: (message: string) => void
  createController?: (options: RoomMenuControllerOptions) => Disposable
}

export const createRoomMenuWiring = ({
  elements,
  initialRoomId,
  initialActorId,
  defaultRoomId,
  defaultActorId,
  getCurrentActorId,
  createRoom,
  createInvite,
  acceptInvite,
  onOpenRoomIdentity,
  setAppSessionRoomIdentity,
  resetDiceRevealTracking,
  clearSelectedCharacter,
  clearCreationActivityFeed,
  hydrateCreationPresenceDock,
  selectPiece,
  clearBoardDrag,
  closeCharacterSheet,
  connectSocket,
  fetchState,
  reportError,
  createController = createRoomMenuController
}: RoomMenuWiringOptions): Disposable => {
  return createController({
    elements: {
      roomForm: elements.roomForm,
      roomInput: elements.roomInput,
      userInput: elements.userInput,
      betaRoomNameInput: elements.betaRoomNameInput,
      betaCreateRoomButton: elements.betaCreateRoom,
      betaInviteRoleSelect: elements.betaInviteRole,
      betaCreateInviteButton: elements.betaCreateInvite,
      betaInviteLinkInput: elements.betaInviteLink,
      betaInviteTokenInput: elements.betaInviteToken,
      betaAcceptInviteButton: elements.betaAcceptInvite,
      betaRoomStatus: elements.betaRoomStatus,
      menuButton: elements.menu,
      roomDialog: elements.roomDialog,
      roomCancelButton: elements.roomCancel
    },
    initialRoomId,
    initialActorId,
    defaultRoomId,
    defaultActorId,
    getCurrentActorId,
    createRoom,
    createInvite,
    acceptInvite,
    reportError,
    onOpenRoom: (identity) => {
      onOpenRoomIdentity(identity)
      setAppSessionRoomIdentity(identity)
      resetDiceRevealTracking()
      clearSelectedCharacter()
      clearCreationActivityFeed()
      hydrateCreationPresenceDock()
      selectPiece(null)
      clearBoardDrag()
      closeCharacterSheet()
      connectSocket()
      fetchState().catch((error) => reportError(error.message))
    }
  })
}
