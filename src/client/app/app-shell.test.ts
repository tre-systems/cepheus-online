import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAppShell, registerAppShellServiceWorker } from './app-shell'
import type { PwaInstallController } from './pwa-install'
import type { ServiceWorkerController } from './service-worker'

describe('app shell composition', () => {
  it('delegates service worker registration', () => {
    const serviceWorker: ServiceWorkerController = {
      getUpdateState: () => ({ status: 'idle' })
    }

    const controller = registerAppShellServiceWorker(() => serviceWorker)

    assert.equal(controller, serviceWorker)
  })

  it('wires PWA install prompt elements', () => {
    const pwaInstall: PwaInstallController = {
      refresh: () => {},
      hide: () => {}
    }
    const prompt = {} as HTMLElement
    const installButton = {} as HTMLButtonElement
    const dismissButton = {} as HTMLButtonElement

    const controllers = createAppShell({
      elements: {
        pwaInstallPrompt: prompt,
        pwaInstallButton: installButton,
        pwaInstallDismissButton: dismissButton
      },
      createPwaInstall: (options) => {
        assert.deepEqual(options.elements, {
          prompt,
          installButton,
          dismissButton
        })
        return pwaInstall
      }
    })

    assert.equal(controllers.pwaInstall, pwaInstall)
  })
})
