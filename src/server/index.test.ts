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
    assert.equal(body.includes('class="combat-rail"'), true)
    assert.equal(body.includes('id="characterSheet"'), true)
    assert.equal(body.includes('id="diceOverlay"'), true)
    assert.equal(body.includes('id="roomDialog"'), true)
    assert.equal(body.includes('id="diceLog"'), false)
    assert.equal(body.includes('viewport-fit=cover'), true)
    assert.equal(body.includes('manifest.webmanifest'), true)
    assert.equal(body.includes('apple-mobile-web-app-capable'), true)
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
    assert.equal(body.includes('serviceWorker'), true)
    assert.equal(body.includes('PIP_SLOTS'), true)
    assert.equal(body.includes('renderRail'), true)
    assert.equal(body.includes('setSheetOpen'), true)
  })

  it('serves cubical dice styling', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/styles.css'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/css; charset=utf-8')
    assert.equal(body.includes('transform-style: preserve-3d'), true)
    assert.equal(body.includes('.pip-top-left'), true)
    assert.equal(body.includes('translateZ(32px)'), true)
    assert.equal(body.includes('.face.right'), true)
    assert.equal(body.includes('.combat-rail'), true)
    assert.equal(body.includes('.character-sheet.open'), true)
    assert.equal(body.includes('.dice-overlay.visible'), true)
    assert.equal(body.includes('100dvh'), true)
  })

  it('serves PWA manifest, icon, and service worker assets', async () => {
    const manifestResponse = await worker.fetch(
      new Request('https://cepheus.test/manifest.webmanifest'),
      {} as Env
    )
    const manifest = await manifestResponse.json()
    const iconResponse = await worker.fetch(
      new Request('https://cepheus.test/icon.svg'),
      {} as Env
    )
    const swResponse = await worker.fetch(
      new Request('https://cepheus.test/sw.js'),
      {} as Env
    )
    const sw = await swResponse.text()

    assert.equal(manifestResponse.status, 200)
    assert.equal(manifest.display, 'standalone')
    assert.equal(manifest.theme_color, '#020504')
    assert.equal(iconResponse.headers.get('content-type'), 'image/svg+xml')
    assert.equal(sw.includes('cepheus-online-shell-v1'), true)
    assert.equal(sw.includes('/rooms/'), true)
  })
})
