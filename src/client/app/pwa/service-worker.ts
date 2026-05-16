import {
  createPwaUpdateStateStore,
  type PwaUpdateEvent,
  type PwaUpdateState,
  type PwaUpdateStateStore
} from './update-state'

interface ServiceWorkerEventTarget {
  addEventListener: (type: string, listener: (event: Event) => void) => void
}

interface ServiceWorkerRegistrationTarget {
  controller: ServiceWorker | null
  register: (scriptURL: string) => Promise<ServiceWorkerRegistration>
  addEventListener: (
    type: 'controllerchange',
    listener: (event: Event) => void
  ) => void
}

interface ServiceWorkerUpdateWindowTarget {
  addEventListener: (
    type: 'focus' | 'online',
    listener: (event: Event) => void
  ) => void
  removeEventListener: (
    type: 'focus' | 'online',
    listener: (event: Event) => void
  ) => void
  setInterval: (handler: () => void, timeout: number) => number
  clearInterval: (handle: number) => void
}

interface ServiceWorkerUpdateDocumentTarget {
  visibilityState: DocumentVisibilityState
  addEventListener: (
    type: 'visibilitychange',
    listener: (event: Event) => void
  ) => void
  removeEventListener: (
    type: 'visibilitychange',
    listener: (event: Event) => void
  ) => void
}

export interface ServiceWorkerControllerOptions {
  navigatorLike?: Navigator
  locationLike?: Pick<Location, 'reload'>
  windowTarget?: ServiceWorkerUpdateWindowTarget | null
  documentTarget?: ServiceWorkerUpdateDocumentTarget | null
  scriptUrl?: string
  updateCheckIntervalMs?: number | null
  onUpdateStateChange?: (state: PwaUpdateState, event: PwaUpdateEvent) => void
}

export interface ServiceWorkerController {
  getUpdateState: () => PwaUpdateState
  acceptUpdate?: () => boolean
  checkForUpdate?: () => void
  dispose?: () => void
}

const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

const hasEventTarget = (
  target: ServiceWorker | ServiceWorkerRegistration | null
): target is (ServiceWorker | ServiceWorkerRegistration) &
  ServiceWorkerEventTarget =>
  target !== null && typeof target.addEventListener === 'function'

const requestServiceWorkerUpdate = (
  registration: ServiceWorkerRegistration
): void => {
  registration.update().catch(() => {
    // Browsers reject update checks while offline or under transient network
    // failures; the next focus/online/interval check will try again.
  })
}

const startServiceWorkerUpdateChecks = ({
  registration,
  windowTarget,
  documentTarget,
  updateCheckIntervalMs
}: {
  registration: ServiceWorkerRegistration
  windowTarget: ServiceWorkerUpdateWindowTarget | null
  documentTarget: ServiceWorkerUpdateDocumentTarget | null
  updateCheckIntervalMs: number | null
}): (() => void) => {
  const checkForUpdate = (): void => {
    requestServiceWorkerUpdate(registration)
  }
  const checkWhenVisible = (): void => {
    if (documentTarget?.visibilityState === 'visible') {
      checkForUpdate()
    }
  }

  windowTarget?.addEventListener('focus', checkForUpdate)
  windowTarget?.addEventListener('online', checkForUpdate)
  documentTarget?.addEventListener('visibilitychange', checkWhenVisible)

  const intervalHandle =
    windowTarget && updateCheckIntervalMs !== null && updateCheckIntervalMs > 0
      ? windowTarget.setInterval(checkForUpdate, updateCheckIntervalMs)
      : null

  return () => {
    windowTarget?.removeEventListener('focus', checkForUpdate)
    windowTarget?.removeEventListener('online', checkForUpdate)
    documentTarget?.removeEventListener('visibilitychange', checkWhenVisible)
    if (windowTarget && intervalHandle !== null) {
      windowTarget.clearInterval(intervalHandle)
    }
  }
}

const addUpdateFoundListener = (
  registration: ServiceWorkerRegistration,
  updateState: PwaUpdateStateStore
): void => {
  registration.addEventListener('updatefound', () => {
    updateState.dispatch({ type: 'registrationUpdateFound' })

    const installingWorker = registration.installing
    if (!hasEventTarget(installingWorker)) return

    installingWorker.addEventListener('statechange', () => {
      if (registration.waiting !== null) {
        updateState.dispatch({ type: 'waitingWorkerAvailable' })
      }
    })
  })
}

const observeServiceWorkerRegistration = (
  registration: ServiceWorkerRegistration,
  updateState: PwaUpdateStateStore
): void => {
  if (registration.waiting !== null) {
    updateState.dispatch({ type: 'waitingWorkerAvailable' })
  }

  addUpdateFoundListener(registration, updateState)
}

export const registerClientServiceWorker = ({
  navigatorLike = navigator,
  locationLike = location,
  windowTarget = typeof window === 'undefined' ? null : window,
  documentTarget = typeof document === 'undefined' ? null : document,
  scriptUrl = '/sw.js',
  updateCheckIntervalMs = DEFAULT_UPDATE_CHECK_INTERVAL_MS,
  onUpdateStateChange
}: ServiceWorkerControllerOptions = {}): ServiceWorkerController | null => {
  if (!('serviceWorker' in navigatorLike)) return null

  const serviceWorker =
    navigatorLike.serviceWorker as ServiceWorkerRegistrationTarget
  let hadServiceWorkerController = serviceWorker.controller !== null
  let isReloadingForServiceWorker = false
  let registration: ServiceWorkerRegistration | null = null
  let stopUpdateChecks = (): void => {}
  const updateState = createPwaUpdateStateStore({
    onStateChange: onUpdateStateChange
  })

  serviceWorker
    .register(scriptUrl)
    .then((nextRegistration) => {
      registration = nextRegistration
      observeServiceWorkerRegistration(nextRegistration, updateState)
      stopUpdateChecks()
      stopUpdateChecks = startServiceWorkerUpdateChecks({
        registration: nextRegistration,
        windowTarget,
        documentTarget,
        updateCheckIntervalMs
      })

      if (hadServiceWorkerController) {
        requestServiceWorkerUpdate(nextRegistration)
      }
    })
    .catch(() => {
      updateState.dispatch({
        type: 'failure',
        message: 'Service worker registration failed'
      })
    })
  serviceWorker.addEventListener('controllerchange', () => {
    updateState.dispatch({ type: 'controllerChange' })

    if (!hadServiceWorkerController) {
      hadServiceWorkerController = true
      return
    }

    if (isReloadingForServiceWorker) return
    isReloadingForServiceWorker = true
    locationLike.reload()
  })

  return {
    getUpdateState: updateState.getState,
    acceptUpdate: () => {
      const waitingWorker = registration?.waiting ?? null
      const nextState = updateState.dispatch({ type: 'userAcceptedRefresh' })
      if (nextState.status !== 'refreshing') return false
      if (!waitingWorker) {
        updateState.dispatch({
          type: 'failure',
          message: 'No waiting service worker update is available'
        })
        return false
      }
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      return true
    },
    checkForUpdate: () => {
      if (registration) requestServiceWorkerUpdate(registration)
    },
    dispose: () => {
      stopUpdateChecks()
    }
  }
}
