export type ConnectivityStatus = 'online' | 'offline'

export interface ConnectivityState {
  status: ConnectivityStatus
  isReconnecting: boolean
  lastError: string | null
  updateAvailable: boolean
}

export interface CreateConnectivityOptions {
  status?: ConnectivityStatus
  isReconnecting?: boolean
  lastError?: string | null
  updateAvailable?: boolean
}

export type ConnectivityAction =
  | { type: 'online' }
  | { type: 'offline'; error?: string | null }
  | { type: 'reconnectStarted'; error?: string | null }
  | { type: 'reconnectSucceeded' }
  | { type: 'reconnectFailed'; error: string }
  | { type: 'errorReported'; error: string }
  | { type: 'errorCleared' }
  | { type: 'updateAvailable' }
  | { type: 'updateConsumed' }

export interface ConnectivityModel {
  snapshot: () => ConnectivityState
  apply: (action: ConnectivityAction) => ConnectivityState
  setOnline: () => ConnectivityState
  setOffline: (error?: string | null) => ConnectivityState
  startReconnect: (error?: string | null) => ConnectivityState
  finishReconnect: () => ConnectivityState
  failReconnect: (error: string) => ConnectivityState
  reportError: (error: string) => ConnectivityState
  clearError: () => ConnectivityState
  markUpdateAvailable: () => ConnectivityState
  consumeUpdate: () => ConnectivityState
}

const copyState = (state: ConnectivityState): ConnectivityState => ({
  ...state
})

export const createConnectivityState = ({
  status = 'online',
  isReconnecting = false,
  lastError = null,
  updateAvailable = false
}: CreateConnectivityOptions = {}): ConnectivityState => ({
  status,
  isReconnecting,
  lastError,
  updateAvailable
})

export const isConnectivityReady = (
  state: Pick<ConnectivityState, 'status' | 'isReconnecting'>
): boolean => state.status === 'online' && !state.isReconnecting

export const reduceConnectivity = (
  state: ConnectivityState,
  action: ConnectivityAction
): ConnectivityState => {
  switch (action.type) {
    case 'online':
      return {
        ...state,
        status: 'online',
        isReconnecting: false,
        lastError: null
      }
    case 'offline':
      return {
        ...state,
        status: 'offline',
        isReconnecting: false,
        lastError: action.error ?? state.lastError
      }
    case 'reconnectStarted':
      return {
        ...state,
        isReconnecting: true,
        lastError: action.error ?? state.lastError
      }
    case 'reconnectSucceeded':
      return {
        ...state,
        status: 'online',
        isReconnecting: false,
        lastError: null
      }
    case 'reconnectFailed':
      return {
        ...state,
        status: 'offline',
        isReconnecting: false,
        lastError: action.error
      }
    case 'errorReported':
      return {
        ...state,
        lastError: action.error
      }
    case 'errorCleared':
      return {
        ...state,
        lastError: null
      }
    case 'updateAvailable':
      return {
        ...state,
        updateAvailable: true
      }
    case 'updateConsumed':
      return {
        ...state,
        updateAvailable: false
      }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

export const createConnectivityModel = (
  options: CreateConnectivityOptions = {}
): ConnectivityModel => {
  let state = createConnectivityState(options)

  const replace = (next: ConnectivityState): ConnectivityState => {
    state = next
    return copyState(state)
  }

  const apply = (action: ConnectivityAction): ConnectivityState =>
    replace(reduceConnectivity(state, action))

  return {
    snapshot: () => copyState(state),
    apply,
    setOnline: () => apply({ type: 'online' }),
    setOffline: (error) => apply({ type: 'offline', error }),
    startReconnect: (error) => apply({ type: 'reconnectStarted', error }),
    finishReconnect: () => apply({ type: 'reconnectSucceeded' }),
    failReconnect: (error) => apply({ type: 'reconnectFailed', error }),
    reportError: (error) => apply({ type: 'errorReported', error }),
    clearError: () => apply({ type: 'errorCleared' }),
    markUpdateAvailable: () => apply({ type: 'updateAvailable' }),
    consumeUpdate: () => apply({ type: 'updateConsumed' })
  }
}
