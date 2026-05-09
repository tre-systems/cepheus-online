import type { ServerMessage } from '../../shared/protocol'
import {
  createConnectivityController,
  type ConnectivityController,
  type ConnectivityControllerOptions
} from './connectivity-controller.js'
import type { ConnectivityState } from './connectivity.js'
import {
  createRoomSocketController,
  type RoomSocketConstructor,
  type RoomSocketController,
  type RoomSocketControllerOptions
} from './room-socket-controller.js'

export interface RoomConnectionControllerOptions {
  webSocketConstructor: RoomSocketConstructor
  getUrlInput: RoomSocketControllerOptions['getUrlInput']
  buildUrl?: RoomSocketControllerOptions['buildUrl']
  fetchState: () => Promise<void>
  onStatus: (status: string) => void
  onError: (message: string) => void
  onMessage: (message: ServerMessage) => void
  connectivity?: Pick<
    ConnectivityControllerOptions,
    'eventTarget' | 'navigatorLike' | 'initialState'
  >
}

export interface RoomConnectionController {
  connect: () => void
  connectivitySnapshot: () => ConnectivityState
  dispose: () => void
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const createRoomConnectionController = ({
  webSocketConstructor,
  getUrlInput,
  buildUrl,
  fetchState,
  onStatus,
  onError,
  onMessage,
  connectivity
}: RoomConnectionControllerOptions): RoomConnectionController => {
  let connectivityController: ConnectivityController

  const socketController: RoomSocketController = createRoomSocketController({
    webSocketConstructor,
    buildUrl,
    getUrlInput,
    isOffline: () => connectivityController.snapshot().status === 'offline',
    onStatus,
    onError,
    onMessage: (message) => onMessage(message as ServerMessage)
  })

  connectivityController = createConnectivityController({
    ...connectivity,
    onChange: (state) => {
      if (state.status === 'offline') {
        onStatus('Offline')
        return
      }

      socketController.connect()
      fetchState().catch((error) => onError(errorMessage(error)))
    }
  })

  const dispose = (): void => {
    socketController.dispose()
    connectivityController.dispose()
  }

  return {
    connect: socketController.connect,
    connectivitySnapshot: connectivityController.snapshot,
    dispose
  }
}
