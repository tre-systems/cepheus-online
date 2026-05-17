import type { ConnectivityStatus } from './connectivity'

export interface AppBootstrapOptions {
  connectivityStatus: ConnectivityStatus
  connect: () => void
  fetchState: () => Promise<void>
  setStatus: (text: string) => void
  setError: (text: string) => void
}

export interface AppBootstrapController {
  dispose: () => void
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Failed to fetch room state'

export const createAppBootstrap = ({
  connectivityStatus,
  connect,
  fetchState,
  setStatus,
  setError
}: AppBootstrapOptions): AppBootstrapController => {
  let disposed = false

  if (connectivityStatus === 'offline') {
    setStatus('Offline')
    return {
      dispose: () => {
        disposed = true
      }
    }
  }

  connect()
  fetchState().catch((error: unknown) => {
    if (disposed) return
    setError(errorMessage(error))
  })

  return {
    dispose: () => {
      disposed = true
    }
  }
}
