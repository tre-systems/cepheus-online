import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ServerMessage } from '../../../shared/protocol'
import type { ConnectivityEventTarget } from '../core/connectivity-controller'
import {
  createRoomConnectionController,
  type RoomConnectionControllerOptions
} from './connection'
import type {
  RoomSocketConstructor,
  RoomSocketLike,
  RoomSocketMessageEvent
} from './socket'

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

  dispatch(type: 'close' | 'error' | 'open'): void {
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

class FakeEventTarget implements ConnectivityEventTarget {
  readonly listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: 'online' | 'offline', listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(
    type: 'online' | 'offline',
    listener: EventListener
  ): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: 'online' | 'offline'): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type))
    }
  }
}

const resetSockets = (): void => {
  FakeRoomSocket.instances.length = 0
}

const createOptions = (
  options: Partial<RoomConnectionControllerOptions> = {}
): RoomConnectionControllerOptions => ({
  webSocketConstructor: FakeRoomSocket as RoomSocketConstructor,
  getUrlInput: () => ({
    protocol: 'http:',
    host: 'localhost:8787',
    roomId: 'room-1',
    viewerRole: 'player',
    actorId: 'user-1',
    actorSessionSecret: 'test-session-token-123456'
  }),
  fetchState: async () => {},
  onStatus: () => {},
  onError: () => {},
  onMessage: () => {},
  connectivity: {
    eventTarget: new FakeEventTarget(),
    navigatorLike: { onLine: true }
  },
  ...options
})

describe('room connection controller', () => {
  it('connects the room socket with the current room identity', () => {
    resetSockets()
    const statuses: string[] = []
    const controller = createRoomConnectionController(
      createOptions({
        onStatus: (status) => statuses.push(status)
      })
    )

    controller.connect()
    FakeRoomSocket.instances[0]?.dispatch('open')

    assert.equal(
      FakeRoomSocket.instances[0]?.url,
      'ws://localhost:8787/rooms/room-1/ws?viewer=player&user=user-1&session=test-session-token-123456'
    )
    assert.deepEqual(statuses, ['Connecting', 'Live'])
  })

  it('reports offline state without reconnecting or fetching', () => {
    resetSockets()
    const target = new FakeEventTarget()
    const statuses: string[] = []
    let fetchCount = 0

    createRoomConnectionController(
      createOptions({
        connectivity: {
          eventTarget: target,
          navigatorLike: { onLine: true }
        },
        fetchState: async () => {
          fetchCount += 1
        },
        onStatus: (status) => statuses.push(status)
      })
    )

    target.dispatch('offline')

    assert.deepEqual(statuses, ['Offline'])
    assert.equal(fetchCount, 0)
    assert.equal(FakeRoomSocket.instances.length, 0)
  })

  it('reconnects and refreshes state when browser connectivity returns', async () => {
    resetSockets()
    const target = new FakeEventTarget()
    let fetchCount = 0

    createRoomConnectionController(
      createOptions({
        connectivity: {
          eventTarget: target,
          navigatorLike: { onLine: false }
        },
        fetchState: async () => {
          fetchCount += 1
        }
      })
    )

    target.dispatch('online')
    await Promise.resolve()

    assert.equal(FakeRoomSocket.instances.length, 1)
    assert.equal(fetchCount, 1)
  })

  it('uses offline fallback status for socket failures while offline', () => {
    resetSockets()
    const target = new FakeEventTarget()
    const statuses: string[] = []
    const controller = createRoomConnectionController(
      createOptions({
        connectivity: {
          eventTarget: target,
          navigatorLike: { onLine: true }
        },
        onStatus: (status) => statuses.push(status)
      })
    )

    controller.connect()
    target.dispatch('offline')
    FakeRoomSocket.instances[0]?.dispatch('close')

    assert.deepEqual(statuses, ['Connecting', 'Offline', 'Offline'])
  })

  it('reports refresh failures after reconnecting', async () => {
    resetSockets()
    const target = new FakeEventTarget()
    const errors: string[] = []

    createRoomConnectionController(
      createOptions({
        connectivity: {
          eventTarget: target,
          navigatorLike: { onLine: false }
        },
        fetchState: async () => {
          throw new Error('refresh failed')
        },
        onError: (message) => errors.push(message)
      })
    )

    target.dispatch('online')
    await Promise.resolve()

    assert.deepEqual(errors, ['refresh failed'])
  })

  it('passes parsed socket messages to the app handler', () => {
    resetSockets()
    const messages: ServerMessage[] = []
    const controller = createRoomConnectionController(
      createOptions({
        onMessage: (message) => messages.push(message)
      })
    )

    controller.connect()
    FakeRoomSocket.instances[0]?.dispatchMessage('{"type":"pong"}')

    assert.deepEqual(messages, [{ type: 'pong' }])
  })
})
