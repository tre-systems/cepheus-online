import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createRoomSocketController,
  type RoomSocketConstructor,
  type RoomSocketLike,
  type RoomSocketMessageEvent
} from './room-socket-controller'

type SocketListener = () => void
type MessageListener = (event: RoomSocketMessageEvent) => void

class FakeRoomSocket implements RoomSocketLike {
  static readonly instances: FakeRoomSocket[] = []

  readonly listeners = {
    open: new Set<SocketListener>(),
    close: new Set<SocketListener>(),
    error: new Set<SocketListener>(),
    message: new Set<MessageListener>()
  }

  closed = false

  constructor(readonly url: string) {
    FakeRoomSocket.instances.push(this)
  }

  addEventListener(type: 'open', listener: SocketListener): void
  addEventListener(type: 'close', listener: SocketListener): void
  addEventListener(type: 'error', listener: SocketListener): void
  addEventListener(type: 'message', listener: MessageListener): void
  addEventListener(
    type: 'open' | 'close' | 'error' | 'message',
    listener: SocketListener | MessageListener
  ): void {
    if (type === 'message') {
      this.listeners.message.add(listener as MessageListener)
      return
    }

    this.listeners[type].add(listener as SocketListener)
  }

  close(): void {
    this.closed = true
  }

  dispatch(type: 'open' | 'close' | 'error'): void {
    for (const listener of this.listeners[type]) {
      listener()
    }
  }

  dispatchMessage(data: string): void {
    for (const listener of this.listeners.message) {
      listener({ data })
    }
  }
}

const resetSockets = (): void => {
  FakeRoomSocket.instances.length = 0
}

describe('room socket controller', () => {
  it('opens a viewer-scoped socket and reports open status', () => {
    resetSockets()
    const statuses: string[] = []
    const controller = createRoomSocketController({
      webSocketConstructor: FakeRoomSocket as RoomSocketConstructor,
      getUrlInput: () => ({
        protocol: 'https:',
        host: 'cepheus.test',
        roomId: 'room-1',
        viewerRole: 'referee',
        actorId: 'user-1',
        actorSessionSecret: 'test-session-token-123456'
      }),
      onStatus: (status) => statuses.push(status),
      onError: () => {
        throw new Error('unexpected error')
      },
      onMessage: () => {
        throw new Error('unexpected message')
      }
    })

    controller.connect()
    assert.equal(
      FakeRoomSocket.instances[0]?.url,
      'wss://cepheus.test/rooms/room-1/ws?viewer=referee&user=user-1&session=test-session-token-123456'
    )
    FakeRoomSocket.instances[0]?.dispatch('open')

    assert.deepEqual(statuses, ['Connecting', 'Live'])
  })

  it('closes the previous socket before reconnecting', () => {
    resetSockets()
    const controller = createRoomSocketController({
      webSocketConstructor: FakeRoomSocket as RoomSocketConstructor,
      getUrlInput: () => ({
        protocol: 'http:',
        host: 'localhost:8787',
        roomId: 'room-1',
        viewerRole: 'player',
        actorId: 'user-1',
        actorSessionSecret: 'test-session-token-123456'
      }),
      onStatus: () => {},
      onError: () => {},
      onMessage: () => {}
    })

    controller.connect()
    controller.connect()

    assert.equal(FakeRoomSocket.instances.length, 2)
    assert.equal(FakeRoomSocket.instances[0]?.closed, true)
    assert.equal(FakeRoomSocket.instances[1]?.closed, false)
  })

  it('reports fallback status from close and error events', () => {
    resetSockets()
    const statuses: string[] = []
    let offline = false
    const controller = createRoomSocketController({
      webSocketConstructor: FakeRoomSocket as RoomSocketConstructor,
      getUrlInput: () => ({
        protocol: 'http:',
        host: 'localhost:8787',
        roomId: 'room-1',
        viewerRole: 'player',
        actorId: 'user-1',
        actorSessionSecret: 'test-session-token-123456'
      }),
      isOffline: () => offline,
      onStatus: (status) => statuses.push(status),
      onError: () => {},
      onMessage: () => {}
    })

    controller.connect()
    FakeRoomSocket.instances[0]?.dispatch('error')
    offline = true
    FakeRoomSocket.instances[0]?.dispatch('close')

    assert.deepEqual(statuses, ['Connecting', 'HTTP fallback', 'Offline'])
  })

  it('parses JSON messages and reports invalid frames', () => {
    resetSockets()
    const messages: unknown[] = []
    const errors: string[] = []
    const controller = createRoomSocketController({
      webSocketConstructor: FakeRoomSocket as RoomSocketConstructor,
      getUrlInput: () => ({
        protocol: 'http:',
        host: 'localhost:8787',
        roomId: 'room-1',
        viewerRole: 'player',
        actorId: 'user-1',
        actorSessionSecret: 'test-session-token-123456'
      }),
      onStatus: () => {},
      onError: (message) => errors.push(message),
      onMessage: (message) => messages.push(message)
    })

    controller.connect()
    FakeRoomSocket.instances[0]?.dispatchMessage('{"type":"pong"}')
    FakeRoomSocket.instances[0]?.dispatchMessage('{')

    assert.deepEqual(messages, [{ type: 'pong' }])
    assert.deepEqual(errors, ['Received an invalid server message'])
  })

  it('closes the active socket and suppresses callbacks after disposal', () => {
    resetSockets()
    const statuses: string[] = []
    const controller = createRoomSocketController({
      webSocketConstructor: FakeRoomSocket as RoomSocketConstructor,
      getUrlInput: () => ({
        protocol: 'http:',
        host: 'localhost:8787',
        roomId: 'room-1',
        viewerRole: 'player',
        actorId: 'user-1',
        actorSessionSecret: 'test-session-token-123456'
      }),
      onStatus: (status) => statuses.push(status),
      onError: () => {},
      onMessage: () => {}
    })

    controller.connect()
    controller.dispose()
    controller.dispose()
    FakeRoomSocket.instances[0]?.dispatch('open')
    controller.connect()

    assert.equal(FakeRoomSocket.instances[0]?.closed, true)
    assert.equal(FakeRoomSocket.instances.length, 1)
    assert.deepEqual(statuses, ['Connecting'])
  })
})
