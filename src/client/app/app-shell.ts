import type { RequiredAppElements } from './app-elements.js'
import {
  createPwaInstallController,
  type PwaInstallController
} from './pwa-install.js'
import {
  registerClientServiceWorker,
  type ServiceWorkerController
} from './service-worker.js'

export type AppShellElements = Pick<
  RequiredAppElements,
  'pwaInstallPrompt' | 'pwaInstallButton' | 'pwaInstallDismissButton'
>

export interface AppShellControllers {
  pwaInstall: PwaInstallController
}

export interface AppShellOptions {
  elements: AppShellElements
  createPwaInstall?: typeof createPwaInstallController
}

export const registerAppShellServiceWorker = (
  registerServiceWorker = registerClientServiceWorker
): ServiceWorkerController | null => registerServiceWorker()

export const createAppShell = ({
  elements,
  createPwaInstall = createPwaInstallController
}: AppShellOptions): AppShellControllers => {
  const pwaInstall = createPwaInstall({
    elements: {
      prompt: elements.pwaInstallPrompt,
      installButton: elements.pwaInstallButton,
      dismissButton: elements.pwaInstallDismissButton
    }
  })

  return {
    pwaInstall
  }
}
