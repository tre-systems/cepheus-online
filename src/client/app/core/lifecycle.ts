import {
  createAppBootstrap,
  type AppBootstrapController,
  type AppBootstrapOptions
} from './bootstrap.js'

export interface AppLifecycleWiring {
  appBootstrap: AppBootstrapController
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
  bootstrapButton.addEventListener('click', () => {
    bootstrapScene().catch((error) => reportError(error.message))
  })

  windowTarget.addEventListener('resize', render)

  return {
    appBootstrap: startAppBootstrap(appBootstrap)
  }
}
