import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AppBootstrapController, AppBootstrapOptions } from './bootstrap'
import { createAppLifecycleWiring } from './lifecycle'

const appBootstrapOptions = (): AppBootstrapOptions => ({
  connectivityStatus: 'online',
  connect: () => {},
  fetchState: async () => {},
  setStatus: () => {},
  setError: () => {}
})

const appBootstrapController: AppBootstrapController = {
  dispose: () => {}
}

describe('app lifecycle wiring', () => {
  it('renders when the window target resizes', () => {
    const windowTarget = new EventTarget()
    const bootstrapButton = new EventTarget()
    const calls: string[] = []

    createAppLifecycleWiring({
      windowTarget,
      bootstrapButton,
      render: () => {
        calls.push('render')
      },
      bootstrapScene: async () => {
        calls.push('bootstrapScene')
      },
      reportError: (message) => {
        calls.push(`error:${message}`)
      },
      appBootstrap: appBootstrapOptions(),
      startAppBootstrap: () => appBootstrapController
    })

    windowTarget.dispatchEvent(new Event('resize'))

    assert.deepEqual(calls, ['render'])
  })

  it('runs bootstrap scene when the bootstrap button is clicked', async () => {
    const windowTarget = new EventTarget()
    const bootstrapButton = new EventTarget()
    const calls: string[] = []

    createAppLifecycleWiring({
      windowTarget,
      bootstrapButton,
      render: () => {
        calls.push('render')
      },
      bootstrapScene: async () => {
        calls.push('bootstrapScene')
      },
      reportError: (message) => {
        calls.push(`error:${message}`)
      },
      appBootstrap: appBootstrapOptions(),
      startAppBootstrap: () => appBootstrapController
    })

    bootstrapButton.dispatchEvent(new Event('click'))
    await Promise.resolve()

    assert.deepEqual(calls, ['bootstrapScene'])
  })

  it('reports bootstrap scene failures', async () => {
    const windowTarget = new EventTarget()
    const bootstrapButton = new EventTarget()
    const errors: string[] = []

    createAppLifecycleWiring({
      windowTarget,
      bootstrapButton,
      render: () => {},
      bootstrapScene: async () => {
        throw new Error('bootstrap failed')
      },
      reportError: (message) => {
        errors.push(message)
      },
      appBootstrap: appBootstrapOptions(),
      startAppBootstrap: () => appBootstrapController
    })

    bootstrapButton.dispatchEvent(new Event('click'))
    await Promise.resolve()

    assert.deepEqual(errors, ['bootstrap failed'])
  })

  it('starts app bootstrap and exposes its controller', () => {
    const windowTarget = new EventTarget()
    const bootstrapButton = new EventTarget()
    const startedWith: AppBootstrapOptions[] = []
    const options = appBootstrapOptions()

    const wiring = createAppLifecycleWiring({
      windowTarget,
      bootstrapButton,
      render: () => {},
      bootstrapScene: async () => {},
      reportError: () => {},
      appBootstrap: options,
      startAppBootstrap: (bootstrapOptions) => {
        startedWith.push(bootstrapOptions)
        return appBootstrapController
      }
    })

    assert.deepEqual(startedWith, [options])
    assert.equal(wiring.appBootstrap, appBootstrapController)
  })
})
