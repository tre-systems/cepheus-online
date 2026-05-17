import type { RoomWebSocketUrlOptions } from '../core/location'
import { buildRoomWebSocketUrl } from '../core/location'

export interface RoomSocketLike {
  addEventListener(type: 'open', listener: () => void): void
  addEventListener(type: 'close', listener: () => void): void
  addEventListener(type: 'error', listener: () => void): void
  addEventListener(
    type: 'message',
    listener: (event: RoomSocketMessageEvent) => void
  ): void
  close: () => void
}

export interface RoomSocketMessageEvent {
  data: string
}

export type RoomSocketConstructor = new (url: string) => RoomSocketLike

export interface RoomSocketControllerOptions {
  webSocketConstructor: RoomSocketConstructor
  getUrlInput: () => RoomWebSocketUrlOptions
  buildUrl?: (input: RoomWebSocketUrlOptions) => string
  isOffline?: () => boolean
  onStatus: (status: string) => void
  onError: (message: string) => void
  onMessage: (message: unknown) => void
}

export interface RoomSocketController {
  connect: () => void
  dispose: () => void
}

export const createRoomSocketController = ({
  webSocketConstructor,
  getUrlInput,
  buildUrl = buildRoomWebSocketUrl,
  isOffline = () => false,
  onStatus,
  onError,
  onMessage
}: RoomSocketControllerOptions): RoomSocketController => {
  let socket: RoomSocketLike | null = null
  let disposed = false

  const setFallbackStatus = (): void => {
    onStatus(isOffline() ? 'Offline' : 'HTTP fallback')
  }

  const connect = (): void => {
    if (disposed) return
    if (socket) socket.close()

    const nextSocket = new webSocketConstructor(buildUrl(getUrlInput()))
    socket = nextSocket
    onStatus('Connecting')

    nextSocket.addEventListener('open', () => {
      if (disposed) return
      onStatus('Live')
    })

    nextSocket.addEventListener('close', () => {
      if (disposed) return
      setFallbackStatus()
    })

    nextSocket.addEventListener('error', () => {
      if (disposed) return
      setFallbackStatus()
    })

    nextSocket.addEventListener('message', (event) => {
      if (disposed) return

      try {
        onMessage(JSON.parse(event.data))
      } catch {
        onError('Received an invalid server message')
      }
    })
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    socket?.close()
    socket = null
  }

  return { connect, dispose }
}
