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

    createRoomMenuController({
      elements: {
        roomForm: new FakeElement() as unknown as HTMLFormElement,
        roomInput: roomInput as unknown as HTMLInputElement,
        userInput: userInput as unknown as HTMLInputElement,
        menuButton: menuButton as unknown as HTMLElement,
        roomDialog: roomDialog as unknown as HTMLDialogElement,
        roomCancelButton: roomCancelButton as unknown as HTMLElement
      },
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

    createRoomMenuController({
      elements: {
        roomForm: roomForm as unknown as HTMLFormElement,
        roomInput: roomInput as unknown as HTMLInputElement,
        userInput: userInput as unknown as HTMLInputElement,
        menuButton: new FakeElement() as unknown as HTMLElement,
        roomDialog: roomDialog as unknown as HTMLDialogElement,
        roomCancelButton: new FakeElement() as unknown as HTMLElement
      },
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
})
