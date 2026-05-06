import {
  createPwaUpdateStateStore,
  type PwaUpdateEvent,
  type PwaUpdateState,
  type PwaUpdateStateStore
} from './pwa-update-state'

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

export interface ServiceWorkerControllerOptions {
  navigatorLike?: Navigator
  locationLike?: Pick<Location, 'reload'>
  scriptUrl?: string
  onUpdateStateChange?: (state: PwaUpdateState, event: PwaUpdateEvent) => void
}

export interface ServiceWorkerController {
  getUpdateState: () => PwaUpdateState
}

const hasEventTarget = (
  target: ServiceWorker | ServiceWorkerRegistration | null
): target is (ServiceWorker | ServiceWorkerRegistration) &
  ServiceWorkerEventTarget =>
  target !== null && typeof target.addEventListener === 'function'

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
  scriptUrl = '/sw.js',
  onUpdateStateChange
}: ServiceWorkerControllerOptions = {}): ServiceWorkerController | null => {
  if (!('serviceWorker' in navigatorLike)) return null

  const serviceWorker =
    navigatorLike.serviceWorker as ServiceWorkerRegistrationTarget
  let hadServiceWorkerController = serviceWorker.controller !== null
  let isReloadingForServiceWorker = false
  const updateState = createPwaUpdateStateStore({
    onStateChange: onUpdateStateChange
  })

  serviceWorker
    .register(scriptUrl)
    .then((registration) => {
      observeServiceWorkerRegistration(registration, updateState)
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
    getUpdateState: updateState.getState
  }
}
