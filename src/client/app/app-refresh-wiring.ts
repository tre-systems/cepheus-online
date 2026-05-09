export interface AppRefreshWiringOptions {
  refreshButton: EventTarget
  fetchState: () => Promise<unknown>
  reportError: (message: string) => void
}

export const createAppRefreshWiring = ({
  refreshButton,
  fetchState,
  reportError
}: AppRefreshWiringOptions): void => {
  refreshButton.addEventListener('click', () => {
    fetchState().catch((error) => reportError(error.message))
  })
}
