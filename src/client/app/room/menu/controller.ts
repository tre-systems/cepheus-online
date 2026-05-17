import { buildRoomUrl } from '../../core/location.js'
import { createDisposer, type Disposable } from '../../core/disposable.js'

export interface RoomMenuElements {
  roomForm: HTMLFormElement
  roomInput: HTMLInputElement
  userInput: HTMLInputElement
  betaRoomNameInput: HTMLInputElement
  betaCreateRoomButton: HTMLButtonElement
  betaInviteRoleSelect: HTMLSelectElement
  betaCreateInviteButton: HTMLButtonElement
  betaInviteLinkInput: HTMLInputElement
  betaInviteTokenInput: HTMLInputElement
  betaAcceptInviteButton: HTMLButtonElement
  betaRoomStatus: HTMLElement
  menuButton: HTMLElement
  roomDialog: Pick<HTMLDialogElement, 'close' | 'showModal'>
  roomCancelButton: HTMLElement
}

export interface RoomIdentity {
  roomId: string
  actorId: string
}

export interface RoomMenuControllerOptions {
  elements: RoomMenuElements
  initialRoomId: string
  initialActorId: string
  defaultRoomId: string
  defaultActorId: string
  locationLike?: Pick<Location, 'href'>
  historyLike?: Pick<History, 'replaceState'>
  getCurrentActorId?: () => string
  createRoom?: (input: { name: string }) => Promise<{ id: string }>
  createInvite?: (input: {
    roomId: string
    role: 'REFEREE' | 'PLAYER' | 'SPECTATOR'
  }) => Promise<{ inviteUrl: string }>
  acceptInvite?: (token: string) => Promise<{ roomId: string }>
  reportError?: (message: string) => void
  onOpenRoom: (identity: RoomIdentity) => void
}

export const resolveRoomIdentity = (
  roomValue: string,
  userValue: string,
  defaultRoomId: string,
  defaultActorId: string
): RoomIdentity => ({
  roomId: roomValue.trim() || defaultRoomId,
  actorId: userValue.trim() || defaultActorId
})

const updateRoomUrl = (
  identity: RoomIdentity,
  locationLike: Pick<Location, 'href'>,
  historyLike: Pick<History, 'replaceState'>
) => {
  const nextUrl = buildRoomUrl(locationLike.href, identity)
  historyLike.replaceState(null, '', nextUrl)
}

const inviteTokenFromUrl = (
  locationLike: Pick<Location, 'href'> | undefined
): string => {
  try {
    return (
      new URL(locationLike?.href ?? globalThis.location.href).searchParams
        .get('invite')
        ?.trim() ?? ''
    )
  } catch {
    return ''
  }
}

const betaActorId = (
  elements: Pick<RoomMenuElements, 'userInput'>,
  defaultActorId: string,
  getCurrentActorId?: () => string
): string => {
  const currentActorId = getCurrentActorId?.().trim()
  if (currentActorId) return currentActorId

  return elements.userInput.value.trim() || defaultActorId
}

const setBetaBusy = (
  elements: Pick<
    RoomMenuElements,
    'betaCreateRoomButton' | 'betaCreateInviteButton' | 'betaAcceptInviteButton'
  >,
  busy: boolean
): void => {
  elements.betaCreateRoomButton.disabled = busy
  elements.betaCreateInviteButton.disabled = busy
  elements.betaAcceptInviteButton.disabled = busy
}

const betaInviteRole = (
  elements: Pick<RoomMenuElements, 'betaInviteRoleSelect'>
): 'REFEREE' | 'PLAYER' | 'SPECTATOR' => {
  const value = elements.betaInviteRoleSelect.value
  return value === 'REFEREE' || value === 'SPECTATOR' ? value : 'PLAYER'
}

export const createRoomMenuController = ({
  elements,
  initialRoomId,
  initialActorId,
  defaultRoomId,
  defaultActorId,
  locationLike,
  historyLike,
  getCurrentActorId,
  createRoom,
  createInvite,
  acceptInvite,
  reportError = () => {},
  onOpenRoom
}: RoomMenuControllerOptions): Disposable => {
  const disposer = createDisposer()
  elements.roomInput.value = initialRoomId
  elements.userInput.value = initialActorId
  elements.betaInviteTokenInput.value = inviteTokenFromUrl(locationLike)

  const openRoom = (identity: RoomIdentity): void => {
    updateRoomUrl(
      identity,
      locationLike ?? globalThis.location,
      historyLike ?? globalThis.history
    )
    elements.roomDialog.close()
    onOpenRoom(identity)
  }

  disposer.listen(elements.roomForm, 'submit', (event) => {
    event.preventDefault()
    const identity = resolveRoomIdentity(
      elements.roomInput.value,
      elements.userInput.value,
      defaultRoomId,
      defaultActorId
    )
    openRoom(identity)
  })

  disposer.listen(elements.betaCreateRoomButton, 'click', () => {
    if (!createRoom) {
      elements.betaRoomStatus.textContent = 'Sign in required'
      return
    }

    setBetaBusy(elements, true)
    elements.betaRoomStatus.textContent = ''
    createRoom({
      name: elements.betaRoomNameInput.value.trim() || 'New Room'
    })
      .then((room) => {
        elements.roomInput.value = room.id
        elements.betaRoomStatus.textContent = 'Room created'
        openRoom({
          roomId: room.id,
          actorId: betaActorId(elements, defaultActorId, getCurrentActorId)
        })
      })
      .catch((error: Error) => {
        elements.betaRoomStatus.textContent = error.message
        reportError(error.message)
      })
      .finally(() => setBetaBusy(elements, false))
  })

  disposer.listen(elements.betaCreateInviteButton, 'click', () => {
    if (!createInvite) {
      elements.betaRoomStatus.textContent = 'Sign in required'
      return
    }

    const roomId = elements.roomInput.value.trim() || defaultRoomId
    setBetaBusy(elements, true)
    elements.betaRoomStatus.textContent = ''
    createInvite({
      roomId,
      role: betaInviteRole(elements)
    })
      .then((invite) => {
        elements.betaInviteLinkInput.value = invite.inviteUrl
        elements.betaRoomStatus.textContent = 'Invite created'
      })
      .catch((error: Error) => {
        elements.betaRoomStatus.textContent = error.message
        reportError(error.message)
      })
      .finally(() => setBetaBusy(elements, false))
  })

  disposer.listen(elements.betaAcceptInviteButton, 'click', () => {
    if (!acceptInvite) {
      elements.betaRoomStatus.textContent = 'Sign in required'
      return
    }

    const token = elements.betaInviteTokenInput.value.trim()
    if (!token) {
      elements.betaRoomStatus.textContent = 'Invite token required'
      return
    }

    setBetaBusy(elements, true)
    elements.betaRoomStatus.textContent = ''
    acceptInvite(token)
      .then((accepted) => {
        elements.roomInput.value = accepted.roomId
        elements.betaRoomStatus.textContent = 'Invite accepted'
        openRoom({
          roomId: accepted.roomId,
          actorId: betaActorId(elements, defaultActorId, getCurrentActorId)
        })
      })
      .catch((error: Error) => {
        elements.betaRoomStatus.textContent = error.message
        reportError(error.message)
      })
      .finally(() => setBetaBusy(elements, false))
  })

  disposer.listen(elements.menuButton, 'click', () => {
    elements.roomDialog.showModal()
  })

  disposer.listen(elements.roomCancelButton, 'click', () => {
    elements.roomDialog.close()
  })

  return disposer
}
