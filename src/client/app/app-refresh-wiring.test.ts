import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAppRefreshWiring } from './app-refresh-wiring'

describe('app refresh wiring', () => {
  it('fetches state when the refresh button is clicked', async () => {
    const refreshButton = new EventTarget()
    const calls: string[] = []

    createAppRefreshWiring({
      refreshButton,
      fetchState: async () => {
        calls.push('fetch')
      },
      reportError: (message) => {
        calls.push(`error:${message}`)
      }
    })

    refreshButton.dispatchEvent(new Event('click'))
    await Promise.resolve()

    assert.deepEqual(calls, ['fetch'])
  })

  it('reports refresh failures from the fetch dependency', async () => {
    const refreshButton = new EventTarget()
    const errors: string[] = []

    createAppRefreshWiring({
      refreshButton,
      fetchState: async () => {
        throw new Error('refresh failed')
      },
      reportError: (message) => {
        errors.push(message)
      }
    })

    refreshButton.dispatchEvent(new Event('click'))
    await Promise.resolve()

    assert.deepEqual(errors, ['refresh failed'])
  })
})
