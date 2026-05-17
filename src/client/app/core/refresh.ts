import { createDisposer, type Disposable } from './disposable.js'

export interface AppRefreshWiringOptions {
  refreshButton: EventTarget
  fetchState: () => Promise<unknown>
  reportError: (message: string) => void
}

export const createAppRefreshWiring = ({
  refreshButton,
  fetchState,
  reportError
}: AppRefreshWiringOptions): Disposable => {
  const disposer = createDisposer()
  disposer.listen(refreshButton, 'click', () => {
    fetchState().catch((error) => reportError(error.message))
  })

  return disposer
}
