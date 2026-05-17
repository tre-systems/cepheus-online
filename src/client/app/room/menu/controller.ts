import { buildRoomUrl } from '../../core/location.js'
import { createDisposer, type Disposable } from '../../core/disposable.js'

export interface RoomMenuElements {
  roomForm: HTMLFormElement
  roomInput: HTMLInputElement
  userInput: HTMLInputElement
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

export const createRoomMenuController = ({
  elements,
  initialRoomId,
  initialActorId,
  defaultRoomId,
  defaultActorId,
  locationLike,
  historyLike,
  onOpenRoom
}: RoomMenuControllerOptions): Disposable => {
  const disposer = createDisposer()
  elements.roomInput.value = initialRoomId
  elements.userInput.value = initialActorId

  disposer.listen(elements.roomForm, 'submit', (event) => {
    event.preventDefault()
    const identity = resolveRoomIdentity(
      elements.roomInput.value,
      elements.userInput.value,
      defaultRoomId,
      defaultActorId
    )
    updateRoomUrl(
      identity,
      locationLike ?? globalThis.location,
      historyLike ?? globalThis.history
    )
    elements.roomDialog.close()
    onOpenRoom(identity)
  })

  disposer.listen(elements.menuButton, 'click', () => {
    elements.roomDialog.showModal()
  })

  disposer.listen(elements.roomCancelButton, 'click', () => {
    elements.roomDialog.close()
  })

  return disposer
}
