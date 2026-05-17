import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createRoomMenuController,
  resolveRoomIdentity,
  type RoomIdentity
} from './controller'

class FakeElement {
  private readonly listeners = new Map<string, Array<(event: Event) => void>>()

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener as (event: Event) => void)
    this.listeners.set(type, listeners)
  }

  dispatch(type: string, event = new Event(type)): void {
    for (const listener of this.listeners.get(type) || []) {
      listener(event)
    }
  }
}

class FakeInput extends FakeElement {
  value = ''
  disabled = false
}

class FakeDialog {
  closeCount = 0
  showModalCount = 0

  close(): void {
    this.closeCount += 1
  }

  showModal(): void {
    this.showModalCount += 1
  }
}

const createElements = ({
  roomForm = new FakeElement(),
  menuButton = new FakeElement(),
  roomCancelButton = new FakeElement(),
  roomDialog = new FakeDialog(),
  roomInput = new FakeInput(),
  userInput = new FakeInput()
}: Partial<{
  roomForm: FakeElement
  menuButton: FakeElement
  roomCancelButton: FakeElement
  roomDialog: FakeDialog
  roomInput: FakeInput
  userInput: FakeInput
}> = {}) => ({
  roomForm,
  roomInput,
  userInput,
  betaRoomNameInput: new FakeInput(),
  betaCreateRoomButton: new FakeInput(),
  betaInviteRoleSelect: new FakeInput(),
  betaCreateInviteButton: new FakeInput(),
  betaInviteLinkInput: new FakeInput(),
  betaInviteTokenInput: new FakeInput(),
  betaAcceptInviteButton: new FakeInput(),
  betaRoomStatus: { textContent: '' },
  menuButton,
  roomDialog,
  roomCancelButton
})

const submitEvent = (): Event & { prevented: boolean } => {
  const event = new Event('submit') as Event & { prevented: boolean }
  event.prevented = false
  event.preventDefault = () => {
    event.prevented = true
  }
  return event
}

describe('room menu controller', () => {
  it('resolves trimmed room identity with defaults', () => {
    assert.deepEqual(
      resolveRoomIdentity('  scout-room  ', '  referee  ', 'demo', 'local'),
      { roomId: 'scout-room', actorId: 'referee' }
    )
    assert.deepEqual(resolveRoomIdentity(' ', '', 'demo', 'local'), {
      roomId: 'demo',
      actorId: 'local'
    })
  })

  it('initializes inputs and opens or closes the room dialog', () => {
    const menuButton = new FakeElement()
    const roomCancelButton = new FakeElement()
    const roomDialog = new FakeDialog()
    const roomInput = new FakeInput()
    const userInput = new FakeInput()
    const elements = createElements({
      menuButton,
      roomCancelButton,
      roomDialog,
      roomInput,
      userInput
    })

    createRoomMenuController({
      elements: elements as unknown as Parameters<
        typeof createRoomMenuController
      >[0]['elements'],
      initialRoomId: 'demo-room',
      initialActorId: 'local-user',
      defaultRoomId: 'fallback-room',
      defaultActorId: 'fallback-user',
      locationLike: { href: 'https://cepheus.test/' } as Location,
      historyLike: { replaceState: () => {} } as unknown as History,
      onOpenRoom: () => {}
    })

    assert.equal(roomInput.value, 'demo-room')
    assert.equal(userInput.value, 'local-user')

    menuButton.dispatch('click')
    roomCancelButton.dispatch('click')

    assert.equal(roomDialog.showModalCount, 1)
    assert.equal(roomDialog.closeCount, 1)
  })

  it('submits room changes, updates the URL, and closes the dialog', () => {
    const roomForm = new FakeElement()
    const roomDialog = new FakeDialog()
    const opened: RoomIdentity[] = []
    const replacementUrls: string[] = []
    const roomInput = new FakeInput()
    const userInput = new FakeInput()
    const elements = createElements({
      roomForm,
      roomDialog,
      roomInput,
      userInput
    })

    createRoomMenuController({
      elements: elements as unknown as Parameters<
        typeof createRoomMenuController
      >[0]['elements'],
      initialRoomId: 'demo-room',
      initialActorId: 'local-user',
      defaultRoomId: 'fallback-room',
      defaultActorId: 'fallback-user',
      locationLike: {
        href: 'https://cepheus.test/?viewer=referee&game=old-room'
      } as Location,
      historyLike: {
        replaceState: (
          _state: unknown,
          _unused: string,
          url?: string | URL
        ) => {
          replacementUrls.push(String(url))
        }
      } as History,
      onOpenRoom: (identity) => {
        opened.push(identity)
      }
    })

    roomInput.value = '  new room  '
    userInput.value = '  scout/user  '
    const event = submitEvent()
    roomForm.dispatch('submit', event)

    assert.equal(event.prevented, true)
    assert.deepEqual(opened, [{ roomId: 'new room', actorId: 'scout/user' }])
    assert.equal(roomDialog.closeCount, 1)
    assert.equal(
      replacementUrls[0],
      'https://cepheus.test/?viewer=referee&game=new+room&user=scout%2Fuser'
    )
  })

  it('creates a private beta room and opens it with the current actor id', async () => {
    const roomDialog = new FakeDialog()
    const opened: RoomIdentity[] = []
    const replacementUrls: string[] = []
    const elements = createElements({ roomDialog })

    createRoomMenuController({
      elements: elements as unknown as Parameters<
        typeof createRoomMenuController
      >[0]['elements'],
      initialRoomId: 'demo-room',
      initialActorId: 'local-user',
      defaultRoomId: 'fallback-room',
      defaultActorId: 'fallback-user',
      locationLike: { href: 'https://cepheus.test/' } as Location,
      historyLike: {
        replaceState: (
          _state: unknown,
          _unused: string,
          url?: string | URL | null
        ) => replacementUrls.push(String(url))
      } as unknown as History,
      getCurrentActorId: () => 'discord:1234',
      createRoom: async ({ name }) => ({ id: `room-${name}` }),
      onOpenRoom: (identity) => opened.push(identity)
    })

    elements.betaRoomNameInput.value = 'Spinward'
    elements.betaCreateRoomButton.dispatch('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(opened, [
      { roomId: 'room-Spinward', actorId: 'discord:1234' }
    ])
    assert.equal(elements.roomInput.value, 'room-Spinward')
    assert.equal(elements.betaRoomStatus.textContent, 'Room created')
    assert.equal(
      replacementUrls[0],
      'https://cepheus.test/?game=room-Spinward&user=discord%3A1234'
    )
    assert.equal(roomDialog.closeCount, 1)
  })

  it('creates room invites and stores the returned link', async () => {
    const elements = createElements()

    createRoomMenuController({
      elements: elements as unknown as Parameters<
        typeof createRoomMenuController
      >[0]['elements'],
      initialRoomId: 'demo-room',
      initialActorId: 'local-user',
      defaultRoomId: 'fallback-room',
      defaultActorId: 'fallback-user',
      locationLike: { href: 'https://cepheus.test/' } as Location,
      historyLike: { replaceState: () => {} } as unknown as History,
      createInvite: async ({ roomId, role }) => ({
        inviteUrl: `https://cepheus.test/?invite=${roomId}-${role}`
      }),
      onOpenRoom: () => {}
    })

    elements.roomInput.value = 'room-1'
    elements.betaInviteRoleSelect.value = 'SPECTATOR'
    elements.betaCreateInviteButton.dispatch('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(
      elements.betaInviteLinkInput.value,
      'https://cepheus.test/?invite=room-1-SPECTATOR'
    )
    assert.equal(elements.betaRoomStatus.textContent, 'Invite created')
  })

  it('accepts invite tokens from the URL and opens the joined room', async () => {
    const roomDialog = new FakeDialog()
    const opened: RoomIdentity[] = []
    const elements = createElements({ roomDialog })

    createRoomMenuController({
      elements: elements as unknown as Parameters<
        typeof createRoomMenuController
      >[0]['elements'],
      initialRoomId: 'demo-room',
      initialActorId: 'local-user',
      defaultRoomId: 'fallback-room',
      defaultActorId: 'fallback-user',
      locationLike: {
        href: 'https://cepheus.test/?invite=token-1'
      } as Location,
      historyLike: { replaceState: () => {} } as unknown as History,
      getCurrentActorId: () => 'discord:1234',
      acceptInvite: async (token) => ({ roomId: `room-for-${token}` }),
      onOpenRoom: (identity) => opened.push(identity)
    })

    assert.equal(elements.betaInviteTokenInput.value, 'token-1')

    elements.betaAcceptInviteButton.dispatch('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(opened, [
      { roomId: 'room-for-token-1', actorId: 'discord:1234' }
    ])
    assert.equal(elements.roomInput.value, 'room-for-token-1')
    assert.equal(elements.betaRoomStatus.textContent, 'Invite accepted')
    assert.equal(roomDialog.closeCount, 1)
  })
})
