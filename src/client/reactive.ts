export type Dispose = () => void

type DisposableLike = Dispose | {dispose: Dispose}
type ReactiveErrorReporter = (err: unknown) => void

export interface DisposalScope {
  add<T extends DisposableLike>(disposable: T): T
  effect(fn: () => void): Dispose
  computed<T>(fn: () => T): Computed<T>
  dispose: Dispose
}

interface Context {
  run: () => void
  deps: Set<Set<() => void>>
}

export interface ReadonlySignal<T> {
  readonly value: T
  peek(): T
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T
  update(fn: (value: T) => T): void
}

export interface Computed<T> extends ReadonlySignal<T> {
  dispose: Dispose
}

const getDispose = (disposable: DisposableLike): Dispose =>
  typeof disposable === 'function' ? disposable : disposable.dispose

let active: Context | null = null
let activeScope: DisposalScope | null = null
let ownerCleanups: Dispose[] | null = null
let batchDepth = 0

const pending = new Set<() => void>()

let reactiveErrorReporter: ReactiveErrorReporter = (err) => {
  console.error('[reactive] effect threw; subsequent effects preserved', err)
}

export const setReactiveErrorReporter = (
  reporter: ReactiveErrorReporter | null
): void => {
  reactiveErrorReporter =
    reporter ??
    ((err) => {
      console.error(
        '[reactive] effect threw; subsequent effects preserved',
        err
      )
    })
}

const reportReactiveError = (err: unknown): void => {
  try {
    reactiveErrorReporter(err)
  } catch {
    try {
      console.error('[reactive] error reporter threw', err)
    } catch {}
  }
}

export const withScope = <T>(scope: DisposalScope, fn: () => T): T => {
  const previous = activeScope
  activeScope = scope

  try {
    return fn()
  } finally {
    activeScope = previous
  }
}

export const getCurrentScope = (): DisposalScope | null => activeScope

export const registerDisposer = (dispose: Dispose): void => {
  if (ownerCleanups) {
    ownerCleanups.push(dispose)
    return
  }

  if (activeScope) {
    activeScope.add(dispose)
  }
}

export const signal = <T>(initial: T): Signal<T> => {
  let current = initial
  const subscribers = new Set<() => void>()

  return {
    get value() {
      if (active) {
        subscribers.add(active.run)
        active.deps.add(subscribers)
      }

      return current
    },

    set value(next: T) {
      if (Object.is(next, current)) return

      current = next

      if (batchDepth > 0) {
        for (const subscriber of subscribers) pending.add(subscriber)
        return
      }

      for (const subscriber of [...subscribers]) subscriber()
    },

    peek: () => current,

    update(fn) {
      this.value = fn(current)
    }
  }
}

export const createDisposalScope = (): DisposalScope => {
  const disposers: DisposableLike[] = []
  let disposed = false

  const scope: DisposalScope = {
    add(disposable) {
      if (disposed) {
        getDispose(disposable)()
        return disposable
      }

      disposers.push(disposable)
      return disposable
    },

    effect(fn) {
      return this.add(effect(fn))
    },

    computed(fn) {
      return this.add(computed(fn))
    },

    dispose() {
      if (disposed) return

      disposed = true

      while (disposers.length > 0) {
        const disposable = disposers.pop()
        if (disposable) getDispose(disposable)()
      }
    }
  }

  return scope
}

export const effect = (fn: () => void): Dispose => {
  const deps = new Set<Set<() => void>>()
  let cleanups: Dispose[] = []
  let disposed = false

  const cleanup = (): void => {
    for (const subscribers of deps) subscribers.delete(run)
    deps.clear()
    pending.delete(run)

    for (const cleanupFn of cleanups) cleanupFn()
    cleanups = []
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    cleanup()
  }

  const run = (): void => {
    if (disposed) return

    cleanup()

    const previousActive = active
    const previousOwner = ownerCleanups

    active = {run, deps}
    ownerCleanups = []

    try {
      fn()
    } catch (err) {
      reportReactiveError(err)
    } finally {
      active = previousActive
      cleanups = ownerCleanups
      ownerCleanups = previousOwner
    }
  }

  registerDisposer(dispose)
  run()

  return dispose
}

export const computed = <T>(fn: () => T): Computed<T> => {
  const output = signal(fn())
  const dispose = effect(() => {
    output.value = fn()
  })

  return {
    get value() {
      return output.value
    },
    peek: output.peek,
    dispose
  }
}

export const batch = (fn: () => void): void => {
  batchDepth++

  try {
    fn()
  } finally {
    batchDepth--

    if (batchDepth === 0) {
      const subscribers = [...pending]
      pending.clear()

      for (const subscriber of subscribers) {
        try {
          subscriber()
        } catch (err) {
          reportReactiveError(err)
        }
      }
    }
  }
}
