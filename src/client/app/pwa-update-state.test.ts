import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  controllerChange,
  initialPwaUpdateState,
  pwaUpdateFailure,
  registrationUpdateFound,
  transitionPwaUpdateState,
  userAcceptedRefresh,
  waitingWorkerAvailable,
  type PwaUpdateState
} from './pwa-update-state'

describe('PWA update state', () => {
  it('models the normal update and refresh lifecycle', () => {
    const installing = registrationUpdateFound(initialPwaUpdateState)
    assert.deepEqual(installing, { status: 'installing' })

    const installedWaiting = waitingWorkerAvailable(installing)
    assert.deepEqual(installedWaiting, { status: 'installedWaiting' })

    const refreshing = userAcceptedRefresh(installedWaiting)
    assert.deepEqual(refreshing, { status: 'refreshing' })

    assert.deepEqual(controllerChange(), { status: 'idle' })
  })

  it('models the same lifecycle through event transitions', () => {
    const events = [
      { type: 'registrationUpdateFound' },
      { type: 'waitingWorkerAvailable' },
      { type: 'userAcceptedRefresh' },
      { type: 'controllerChange' }
    ] as const

    const state = events.reduce<PwaUpdateState>(
      transitionPwaUpdateState,
      initialPwaUpdateState
    )

    assert.deepEqual(state, { status: 'idle' })
  })

  it('keeps an already waiting worker visible if another update is found', () => {
    const waiting = waitingWorkerAvailable(
      registrationUpdateFound(initialPwaUpdateState)
    )

    assert.deepEqual(registrationUpdateFound(waiting), {
      status: 'installedWaiting'
    })
  })

  it('does not refresh until the user accepts a waiting update', () => {
    assert.deepEqual(userAcceptedRefresh(initialPwaUpdateState), {
      status: 'idle'
    })
    assert.deepEqual(userAcceptedRefresh({ status: 'installing' }), {
      status: 'installing'
    })
  })

  it('records install failures with the failed lifecycle state', () => {
    const failed = pwaUpdateFailure(
      registrationUpdateFound(initialPwaUpdateState),
      'install failed'
    )

    assert.deepEqual(failed, {
      status: 'refreshFailed',
      failedFrom: 'installing',
      message: 'install failed'
    })
  })

  it('records refresh failures and can retry from a failed state', () => {
    const failed = transitionPwaUpdateState(
      { status: 'refreshing' },
      { type: 'failure' }
    )

    assert.deepEqual(failed, {
      status: 'refreshFailed',
      failedFrom: 'refreshing'
    })

    assert.deepEqual(registrationUpdateFound(failed), { status: 'installing' })
  })
})
