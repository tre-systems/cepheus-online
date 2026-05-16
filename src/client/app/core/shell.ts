import type { RequiredAppElements } from './elements.js'
import {
  createPwaInstallController,
  type PwaInstallController
} from '../pwa/install.js'
import {
  registerClientServiceWorker,
  type ServiceWorkerController,
  type ServiceWorkerControllerOptions
} from '../pwa/service-worker.js'
import {
  createPwaUpdatePromptController,
  type PwaUpdatePromptController
} from '../pwa/update-prompt.js'

export type AppShellElements = Pick<
  RequiredAppElements,
  | 'pwaInstallPrompt'
  | 'pwaInstallButton'
  | 'pwaInstallDismissButton'
  | 'pwaUpdatePrompt'
  | 'pwaUpdateButton'
  | 'pwaUpdateDismissButton'
>

export interface AppShellControllers {
  pwaInstall: PwaInstallController
  pwaUpdate: PwaUpdatePromptController
}

export interface AppShellOptions {
  elements: AppShellElements
  createPwaInstall?: typeof createPwaInstallController
  createPwaUpdate?: typeof createPwaUpdatePromptController
}

export const registerAppShellServiceWorker = (
  options: ServiceWorkerControllerOptions = {},
  registerServiceWorker = registerClientServiceWorker
): ServiceWorkerController | null => registerServiceWorker(options)

export const createAppShell = ({
  elements,
  createPwaInstall = createPwaInstallController,
  createPwaUpdate = createPwaUpdatePromptController
}: AppShellOptions): AppShellControllers => {
  const pwaInstall = createPwaInstall({
    elements: {
      prompt: elements.pwaInstallPrompt,
      installButton: elements.pwaInstallButton,
      dismissButton: elements.pwaInstallDismissButton
    }
  })
  const pwaUpdate = createPwaUpdate({
    elements: {
      prompt: elements.pwaUpdatePrompt,
      updateButton: elements.pwaUpdateButton,
      dismissButton: elements.pwaUpdateDismissButton
    }
  })

  return {
    pwaInstall,
    pwaUpdate
  }
}
