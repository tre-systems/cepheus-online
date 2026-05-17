import {
  createAppBootstrap,
  type AppBootstrapController,
  type AppBootstrapOptions
} from './bootstrap.js'
import { createDisposer, type Disposable } from './disposable.js'

export interface AppLifecycleWiring {
  appBootstrap: AppBootstrapController
  dispose(): void
}

export interface AppLifecycleWiringOptions {
  windowTarget: EventTarget
  bootstrapButton: EventTarget
  render: () => void
  bootstrapScene: () => Promise<unknown>
  reportError: (message: string) => void
  appBootstrap: AppBootstrapOptions
  startAppBootstrap?: (options: AppBootstrapOptions) => AppBootstrapController
}

export const createAppLifecycleWiring = ({
  windowTarget,
  bootstrapButton,
  render,
  bootstrapScene,
  reportError,
  appBootstrap,
  startAppBootstrap = createAppBootstrap
}: AppLifecycleWiringOptions): AppLifecycleWiring => {
  const disposer = createDisposer()
  const handleBootstrapClick = () => {
    bootstrapScene().catch((error) => reportError(error.message))
  }

  disposer.listen(bootstrapButton, 'click', handleBootstrapClick)
  disposer.listen(windowTarget, 'resize', render)
  const appBootstrapController = startAppBootstrap(appBootstrap)
  disposer.add(appBootstrapController.dispose)

  return {
    appBootstrap: appBootstrapController,
    dispose: disposer.dispose
  } satisfies AppLifecycleWiring & Disposable
}
