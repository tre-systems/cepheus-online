export type PwaUpdateStatus =
  | 'idle'
  | 'installing'
  | 'installedWaiting'
  | 'refreshing'
  | 'refreshFailed'

export type PwaUpdateActiveStatus = Exclude<
  PwaUpdateStatus,
  'idle' | 'refreshFailed'
>

export type PwaUpdateState =
  | { readonly status: 'idle' }
  | { readonly status: 'installing' }
  | { readonly status: 'installedWaiting' }
  | { readonly status: 'refreshing' }
  | {
      readonly status: 'refreshFailed'
      readonly failedFrom: PwaUpdateActiveStatus | 'idle'
      readonly message?: string
    }

export type PwaUpdateEvent =
  | { readonly type: 'registrationUpdateFound' }
  | { readonly type: 'waitingWorkerAvailable' }
  | { readonly type: 'controllerChange' }
  | { readonly type: 'userAcceptedRefresh' }
  | { readonly type: 'failure'; readonly message?: string }

export interface PwaUpdateStateStoreOptions {
  readonly initialState?: PwaUpdateState
  readonly onStateChange?: (
    state: PwaUpdateState,
    event: PwaUpdateEvent
  ) => void
}

export interface PwaUpdateStateStore {
  getState: () => PwaUpdateState
  dispatch: (event: PwaUpdateEvent) => PwaUpdateState
}

export const initialPwaUpdateState: PwaUpdateState = { status: 'idle' }

export const registrationUpdateFound = (
  state: PwaUpdateState
): PwaUpdateState => {
  if (state.status === 'installedWaiting' || state.status === 'refreshing') {
    return state
  }

  return { status: 'installing' }
}

export const waitingWorkerAvailable = (
  state: PwaUpdateState
): PwaUpdateState => {
  if (state.status === 'refreshing') return state
  return { status: 'installedWaiting' }
}

export const userAcceptedRefresh = (state: PwaUpdateState): PwaUpdateState => {
  if (state.status !== 'installedWaiting') return state
  return { status: 'refreshing' }
}

export const controllerChange = (): PwaUpdateState => initialPwaUpdateState

export const pwaUpdateFailure = (
  state: PwaUpdateState,
  message?: string
): PwaUpdateState => ({
  status: 'refreshFailed',
  failedFrom:
    state.status === 'refreshFailed' ? state.failedFrom : state.status,
  ...(message ? { message } : {})
})

export const transitionPwaUpdateState = (
  state: PwaUpdateState,
  event: PwaUpdateEvent
): PwaUpdateState => {
  switch (event.type) {
    case 'registrationUpdateFound':
      return registrationUpdateFound(state)
    case 'waitingWorkerAvailable':
      return waitingWorkerAvailable(state)
    case 'controllerChange':
      return controllerChange()
    case 'userAcceptedRefresh':
      return userAcceptedRefresh(state)
    case 'failure':
      return pwaUpdateFailure(state, event.message)
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export const arePwaUpdateStatesEqual = (
  left: PwaUpdateState,
  right: PwaUpdateState
): boolean => {
  if (left.status !== right.status) return false
  if (left.status !== 'refreshFailed' || right.status !== 'refreshFailed') {
    return true
  }

  return left.failedFrom === right.failedFrom && left.message === right.message
}

export const createPwaUpdateStateStore = ({
  initialState = initialPwaUpdateState,
  onStateChange
}: PwaUpdateStateStoreOptions = {}): PwaUpdateStateStore => {
  let state = initialState

  return {
    getState: () => state,
    dispatch: (event) => {
      const nextState = transitionPwaUpdateState(state, event)
      if (!arePwaUpdateStatesEqual(state, nextState)) {
        state = nextState
        onStateChange?.(state, event)
      } else {
        state = nextState
      }
      return state
    }
  }
}
