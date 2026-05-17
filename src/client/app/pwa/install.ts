import { createDisposer } from '../core/disposable.js'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PwaInstallElements {
  prompt: HTMLElement | null
  installButton: HTMLElement | null
  dismissButton: HTMLElement | null
}

export interface PwaInstallControllerOptions {
  elements: PwaInstallElements
  windowTarget?: EventTarget & Pick<Window, 'matchMedia'>
  localStorage?: Pick<Storage, 'getItem' | 'setItem'>
  navigatorLike?: Navigator & { standalone?: boolean }
}

export interface PwaInstallController {
  refresh: () => void
  hide: () => void
  dispose: () => void
}

export const INSTALL_DISMISSED_KEY = 'cepheus-online-pwa-install-dismissed'
export const INSTALL_ACCEPTED_KEY = 'cepheus-online-pwa-install-accepted'

const isStandaloneDisplay = (
  windowTarget: Pick<Window, 'matchMedia'>,
  navigatorLike: Navigator & { standalone?: boolean }
): boolean =>
  windowTarget.matchMedia('(display-mode: standalone)').matches ||
  navigatorLike.standalone === true

export const createPwaInstallController = ({
  elements,
  windowTarget = window,
  localStorage: storage = globalThis.localStorage,
  navigatorLike = navigator
}: PwaInstallControllerOptions): PwaInstallController => {
  const disposer = createDisposer()
  let deferredInstallPrompt: BeforeInstallPromptEvent | null = null

  const hide = (): void => {
    if (elements.prompt) elements.prompt.hidden = true
  }

  const refresh = (): void => {
    if (
      !elements.prompt ||
      !elements.installButton ||
      !deferredInstallPrompt ||
      isStandaloneDisplay(windowTarget, navigatorLike) ||
      storage.getItem(INSTALL_DISMISSED_KEY) === '1' ||
      storage.getItem(INSTALL_ACCEPTED_KEY) === '1'
    ) {
      hide()
      return
    }

    elements.prompt.hidden = false
  }

  disposer.listen(windowTarget, 'beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event as BeforeInstallPromptEvent
    refresh()
  })

  disposer.listen(windowTarget, 'appinstalled', () => {
    storage.setItem(INSTALL_ACCEPTED_KEY, '1')
    deferredInstallPrompt = null
    hide()
  })

  if (elements.installButton) {
    disposer.listen(elements.installButton, 'click', async () => {
      if (!deferredInstallPrompt) return
      const promptEvent = deferredInstallPrompt
      deferredInstallPrompt = null
      hide()
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') {
        storage.setItem(INSTALL_ACCEPTED_KEY, '1')
      }
    })
  }

  if (elements.dismissButton)
    disposer.listen(elements.dismissButton, 'click', () => {
      storage.setItem(INSTALL_DISMISSED_KEY, '1')
      hide()
    })

  return { refresh, hide, dispose: disposer.dispose }
}
