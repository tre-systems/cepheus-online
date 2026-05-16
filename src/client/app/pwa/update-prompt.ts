import type { ServiceWorkerController } from './service-worker.js'
import type { PwaUpdateState } from './update-state.js'

export interface PwaUpdatePromptElements {
  prompt: HTMLElement | null
  updateButton: HTMLElement | null
  dismissButton: HTMLElement | null
}

export interface PwaUpdatePromptControllerOptions {
  elements: PwaUpdatePromptElements
  serviceWorker?: ServiceWorkerController | null
}

export interface PwaUpdatePromptController {
  render: (state: PwaUpdateState) => void
  setServiceWorker: (serviceWorker: ServiceWorkerController | null) => void
  hide: () => void
}

const promptMessage = (state: PwaUpdateState): string => {
  switch (state.status) {
    case 'installing':
      return 'Downloading update...'
    case 'installedWaiting':
      return 'A new version is ready.'
    case 'refreshing':
      return 'Refreshing...'
    case 'refreshFailed':
      return state.message || 'Update refresh failed.'
    case 'idle':
      return 'Cepheus is up to date.'
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

export const createPwaUpdatePromptController = ({
  elements,
  serviceWorker = null
}: PwaUpdatePromptControllerOptions): PwaUpdatePromptController => {
  let currentServiceWorker = serviceWorker
  let currentState: PwaUpdateState = { status: 'idle' }
  let dismissed = false

  const hide = (): void => {
    if (elements.prompt) elements.prompt.hidden = true
  }

  const render = (state: PwaUpdateState): void => {
    currentState = state
    if (!elements.prompt || !elements.updateButton) return
    if (state.status === 'idle') {
      dismissed = false
      hide()
      return
    }

    elements.prompt
      .querySelector('[data-pwa-update-message]')
      ?.replaceChildren(promptMessage(state))
    elements.updateButton.textContent =
      state.status === 'refreshFailed' ? 'Retry' : 'Refresh'
    elements.updateButton.setAttribute(
      'aria-disabled',
      state.status === 'installing' || state.status === 'refreshing'
        ? 'true'
        : 'false'
    )
    elements.updateButton.toggleAttribute(
      'disabled',
      state.status === 'installing' || state.status === 'refreshing'
    )
    elements.prompt.hidden = dismissed && state.status !== 'refreshFailed'
  }

  elements.updateButton?.addEventListener('click', () => {
    dismissed = false
    if (currentState.status === 'refreshFailed') {
      currentServiceWorker?.checkForUpdate?.()
      return
    }
    currentServiceWorker?.acceptUpdate?.()
  })

  elements.dismissButton?.addEventListener('click', () => {
    dismissed = true
    hide()
  })

  return {
    render,
    setServiceWorker: (nextServiceWorker) => {
      currentServiceWorker = nextServiceWorker
    },
    hide
  }
}
