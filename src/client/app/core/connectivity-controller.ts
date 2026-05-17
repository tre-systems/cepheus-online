import {
  createConnectivityModel,
  type ConnectivityState,
  type CreateConnectivityOptions
} from './connectivity'

export interface ConnectivityEventTarget {
  addEventListener: (
    type: 'online' | 'offline',
    listener: EventListener
  ) => void
  removeEventListener: (
    type: 'online' | 'offline',
    listener: EventListener
  ) => void
}

export interface ConnectivityNavigator {
  onLine?: boolean
}

export interface ConnectivityControllerOptions {
  eventTarget?: ConnectivityEventTarget
  navigatorLike?: ConnectivityNavigator
  initialState?: CreateConnectivityOptions
  onChange?: (
    state: ConnectivityState,
    previousState: ConnectivityState
  ) => void
}

export interface ConnectivityController {
  snapshot: () => ConnectivityState
  dispose: () => void
}

const browserInitialState = (
  navigatorLike: ConnectivityNavigator,
  initialState: CreateConnectivityOptions
): CreateConnectivityOptions => ({
  ...initialState,
  status:
    initialState.status ??
    (navigatorLike.onLine === false ? 'offline' : 'online')
})

export const createConnectivityController = ({
  eventTarget = window,
  navigatorLike = navigator,
  initialState = {},
  onChange
}: ConnectivityControllerOptions = {}): ConnectivityController => {
  const model = createConnectivityModel(
    browserInitialState(navigatorLike, initialState)
  )
  let disposed = false

  const applyChange = (change: () => ConnectivityState): void => {
    if (disposed) return
    const previousState = model.snapshot()
    const state = change()
    onChange?.(state, previousState)
  }

  const handleOnline: EventListener = () => {
    applyChange(() => model.setOnline())
  }

  const handleOffline: EventListener = () => {
    applyChange(() => model.setOffline('Browser is offline'))
  }

  eventTarget.addEventListener('online', handleOnline)
  eventTarget.addEventListener('offline', handleOffline)

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    eventTarget.removeEventListener('online', handleOnline)
    eventTarget.removeEventListener('offline', handleOffline)
  }

  return {
    snapshot: model.snapshot,
    dispose
  }
}
