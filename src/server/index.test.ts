import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import worker from './index'
import type {Env} from './env'

describe('Worker static client', () => {
  it('serves the browser shell from the Worker fallback', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.equal(body.includes('<canvas id="boardCanvas"'), true)
  })

  it('serves the dependency-free browser module', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/client.js'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('new WebSocket'), true)
  })
})
