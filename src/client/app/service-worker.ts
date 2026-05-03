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
}

export const registerClientServiceWorker = ({
  navigatorLike = navigator,
  locationLike = location,
  scriptUrl = '/sw.js'
}: ServiceWorkerControllerOptions = {}): void => {
  if (!('serviceWorker' in navigatorLike)) return

  const serviceWorker =
    navigatorLike.serviceWorker as ServiceWorkerRegistrationTarget
  let hadServiceWorkerController = serviceWorker.controller !== null
  let isReloadingForServiceWorker = false

  serviceWorker.register(scriptUrl).catch(() => {})
  serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController) {
      hadServiceWorkerController = true
      return
    }

    if (isReloadingForServiceWorker) return
    isReloadingForServiceWorker = true
    locationLike.reload()
  })
}
