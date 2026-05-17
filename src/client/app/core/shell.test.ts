import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAppShell, registerAppShellServiceWorker } from './shell'
import type { PwaInstallController } from '../pwa/install'
import type { ServiceWorkerController } from '../pwa/service-worker'
import type { PwaUpdatePromptController } from '../pwa/update-prompt'

describe('app shell composition', () => {
  it('delegates service worker registration with options', () => {
    const serviceWorker: ServiceWorkerController = {
      getUpdateState: () => ({ status: 'idle' })
    }
    const onUpdateStateChange = () => {}

    const controller = registerAppShellServiceWorker(
      { onUpdateStateChange },
      (options) => {
        assert.equal(options?.onUpdateStateChange, onUpdateStateChange)
        return serviceWorker
      }
    )

    assert.equal(controller, serviceWorker)
  })

  it('wires PWA install and update prompt elements', () => {
    const pwaInstall: PwaInstallController = {
      refresh: () => {},
      hide: () => {},
      dispose: () => {}
    }
    const pwaUpdate: PwaUpdatePromptController = {
      render: () => {},
      setServiceWorker: () => {},
      hide: () => {},
      dispose: () => {}
    }
    const prompt = {} as HTMLElement
    const installButton = {} as HTMLButtonElement
    const dismissButton = {} as HTMLButtonElement
    const updatePrompt = {} as HTMLElement
    const updateButton = {} as HTMLButtonElement
    const updateDismissButton = {} as HTMLButtonElement

    const controllers = createAppShell({
      elements: {
        pwaInstallPrompt: prompt,
        pwaInstallButton: installButton,
        pwaInstallDismissButton: dismissButton,
        pwaUpdatePrompt: updatePrompt,
        pwaUpdateButton: updateButton,
        pwaUpdateDismissButton: updateDismissButton
      },
      createPwaInstall: (options) => {
        assert.deepEqual(options.elements, {
          prompt,
          installButton,
          dismissButton
        })
        return pwaInstall
      },
      createPwaUpdate: (options) => {
        assert.deepEqual(options.elements, {
          prompt: updatePrompt,
          updateButton,
          dismissButton: updateDismissButton
        })
        return pwaUpdate
      }
    })

    assert.equal(controllers.pwaInstall, pwaInstall)
    assert.equal(controllers.pwaUpdate, pwaUpdate)
  })
})
