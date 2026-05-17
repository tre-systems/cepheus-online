export interface Disposable {
  dispose(): void
}

export interface Disposer extends Disposable {
  add(dispose: () => void): void
  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): void
}

export const createDisposer = (): Disposer => {
  const cleanups: Array<() => void> = []

  return {
    add(dispose) {
      cleanups.push(dispose)
    },
    listen(target, type, listener, options) {
      target.addEventListener(type, listener, options)
      cleanups.push(() => target.removeEventListener(type, listener, options))
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup()
      }
    }
  }
}
