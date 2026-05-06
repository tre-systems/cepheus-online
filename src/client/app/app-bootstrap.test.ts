import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAppBootstrap } from './app-bootstrap'

const createDeferred = (): {
  promise: Promise<void>
  reject: (error: unknown) => void
} => {
  let rejectPromise: (error: unknown) => void = () => {}
  const promise = new Promise<void>((_resolve, reject) => {
    rejectPromise = reject
  })
  return {
    promise,
    reject: rejectPromise
  }
}

describe('app bootstrap', () => {
  it('connects and fetches room state when online', () => {
    const calls: string[] = []

    createAppBootstrap({
      connectivityStatus: 'online',
      connect: () => {
        calls.push('connect')
      },
      fetchState: async () => {
        calls.push('fetchState')
      },
      setStatus: (status) => {
        calls.push(`status:${status}`)
      },
      setError: (error) => {
        calls.push(`error:${error}`)
      }
    })

    assert.deepEqual(calls, ['connect', 'fetchState'])
  })

  it('sets offline status without connecting or fetching when offline', () => {
    const calls: string[] = []

    createAppBootstrap({
      connectivityStatus: 'offline',
      connect: () => {
        calls.push('connect')
      },
      fetchState: async () => {
        calls.push('fetchState')
      },
      setStatus: (status) => {
        calls.push(`status:${status}`)
      },
      setError: (error) => {
        calls.push(`error:${error}`)
      }
    })

    assert.deepEqual(calls, ['status:Offline'])
  })

  it('reports fetch failures through the app error callback', async () => {
    const errors: string[] = []

    createAppBootstrap({
      connectivityStatus: 'online',
      connect: () => {},
      fetchState: async () => {
        throw new Error('Network unavailable')
      },
      setStatus: () => {},
      setError: (error) => {
        errors.push(error)
      }
    })

    await Promise.resolve()

    assert.deepEqual(errors, ['Network unavailable'])
  })

  it('does not report async fetch failures after disposal', async () => {
    const deferred = createDeferred()
    const errors: string[] = []

    const bootstrap = createAppBootstrap({
      connectivityStatus: 'online',
      connect: () => {},
      fetchState: () => deferred.promise,
      setStatus: () => {},
      setError: (error) => {
        errors.push(error)
      }
    })

    bootstrap.dispose()
    deferred.reject(new Error('Late failure'))
    await Promise.resolve()

    assert.deepEqual(errors, [])
  })
})
