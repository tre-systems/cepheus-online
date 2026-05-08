import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import worker from './index'
import type { Env } from './env'

const fetchStaticClient = async (pathname: string): Promise<Response> =>
  worker.fetch(new Request(`https://cepheus.test${pathname}`), {} as Env)

const extractModuleImports = (body: string): string[] => {
  const imports = new Set<string>()
  const importPattern =
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of body.matchAll(importPattern)) {
    imports.add(match[1] ?? match[2])
  }

  return [...imports]
}

describe('Worker static client', () => {
  it('serves the browser shell from the Worker fallback', async () => {
    const response = await fetchStaticClient('/')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/html; charset=utf-8'
    )
    assert.equal(body.includes('<canvas id="boardCanvas"'), true)
    assert.equal(body.includes('class="combat-rail"'), true)
    assert.equal(body.includes('id="characterSheet"'), true)
    assert.equal(body.includes('id="createCharacterRailButton"'), true)
    assert.equal(body.includes('id="characterCreator"'), true)
    assert.equal(body.includes('id="characterCreatorCloseButton"'), true)
    assert.equal(body.includes('id="characterCreationWizard"'), true)
    assert.equal(body.includes('id="diceOverlay"'), true)
    assert.equal(body.includes('id="roomDialog"'), true)
    assert.equal(body.includes('id="boardSelect"'), true)
    assert.equal(body.includes('id="boardStatus"'), true)
    assert.equal(body.includes('class="camera-controls"'), true)
    assert.equal(body.includes('id="zoomOutButton"'), true)
    assert.equal(body.includes('id="zoomResetButton"'), true)
    assert.equal(body.includes('id="zoomInButton"'), true)
    assert.equal(body.includes('data-sheet-tab="details"'), true)
    assert.equal(body.includes('data-sheet-tab="action"'), true)
    assert.equal(body.includes('data-sheet-tab="items"'), true)
    assert.equal(body.includes('data-sheet-tab="notes"'), true)
    assert.equal(body.includes('id="pieceNameInput"'), true)
    assert.equal(body.includes('id="pieceImageInput"'), true)
    assert.equal(body.includes('id="pieceImageFileInput"'), true)
    assert.equal(body.includes('id="pieceCropInput"'), true)
    assert.equal(body.includes('id="pieceCropXInput"'), true)
    assert.equal(body.includes('id="pieceCropYInput"'), true)
    assert.equal(body.includes('id="pieceCropWidthInput"'), true)
    assert.equal(body.includes('id="pieceCropHeightInput"'), true)
    assert.equal(body.includes('id="pieceWidthInput"'), true)
    assert.equal(body.includes('id="pieceHeightInput"'), true)
    assert.equal(body.includes('id="pieceScaleInput"'), true)
    assert.equal(
      body.includes('name="pieceImageFile" type="file" accept="image/*"'),
      true
    )
    assert.equal(body.includes('id="pieceSheetInput"'), true)
    assert.equal(body.includes('id="createPieceButton"'), true)
    assert.equal(body.includes('id="boardNameInput"'), true)
    assert.equal(body.includes('id="boardImageInput"'), true)
    assert.equal(body.includes('id="boardImageFileInput"'), true)
    assert.equal(
      body.includes('name="boardImageFile" type="file" accept="image/*"'),
      true
    )
    assert.equal(body.includes('id="createBoardButton"'), true)
    assert.equal(body.includes('id="diceLog"'), false)
    assert.equal(body.includes('viewport-fit=cover'), true)
    assert.equal(body.includes('site.webmanifest'), true)
    assert.equal(body.includes('mobile-web-app-capable'), true)
    assert.equal(body.includes('apple-mobile-web-app-capable'), true)
    assert.equal(body.includes('apple-touch-icon'), true)
    assert.equal(body.includes('id="pwaInstallPrompt"'), true)
    assert.equal(body.includes('src="/client/app/app.js"'), true)
  })

  it('serves the legacy browser module shim', async () => {
    const response = await fetchStaticClient('/client.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body, 'import "/client/app/app.js";\n')
  })

  it('serves the bundled dependency-free browser client', async () => {
    const response = await fetchStaticClient('/client/app/app.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(extractModuleImports(body).length, 0)
    assert.equal(body.includes('registerClientServiceWorker'), true)
    assert.equal(body.includes('createRoomSocketController'), true)
    assert.equal(body.includes('createCharacterCreationFlow'), true)
    assert.equal(body.includes('deriveCharacterCreationFieldViewModels'), true)
    assert.equal(body.includes('DICE_PIP_SLOTS'), true)
    assert.equal(body.includes('deriveDoorToggleViewModels'), true)
  })

  it('serves cubical dice styling', async () => {
    const response = await fetchStaticClient('/styles.css')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/css; charset=utf-8'
    )
    assert.equal(body.includes('.combat-rail'), true)
    assert.equal(body.includes('.camera-controls'), true)
    assert.equal(body.includes('.character-sheet.open'), true)
    assert.equal(body.includes('.dice-overlay.visible'), true)
    assert.equal(body.includes('.pwa-install-prompt'), true)
  })

  it('serves PWA manifest, icon, and service worker assets', async () => {
    const manifestResponse = await worker.fetch(
      new Request('https://cepheus.test/manifest.webmanifest'),
      {} as Env
    )
    const manifest = await manifestResponse.json()
    const siteManifestResponse = await worker.fetch(
      new Request('https://cepheus.test/site.webmanifest'),
      {} as Env
    )
    const legacyManifestResponse = await worker.fetch(
      new Request('https://cepheus.test/manifest.json'),
      {} as Env
    )
    const iconResponse = await worker.fetch(
      new Request('https://cepheus.test/icon.svg'),
      {} as Env
    )
    const maskableIconResponse = await worker.fetch(
      new Request('https://cepheus.test/icon-maskable.svg'),
      {} as Env
    )
    const faviconResponse = await worker.fetch(
      new Request('https://cepheus.test/favicon.ico'),
      {} as Env
    )
    const touchIconResponse = await worker.fetch(
      new Request('https://cepheus.test/apple-touch-icon.svg'),
      {} as Env
    )
    const swResponse = await worker.fetch(
      new Request('https://cepheus.test/sw.js'),
      {} as Env
    )
    const sw = await swResponse.text()

    assert.equal(manifestResponse.status, 200)
    assert.equal(manifest.display, 'standalone')
    assert.deepEqual(manifest.display_override, [
      'window-controls-overlay',
      'standalone',
      'browser'
    ])
    assert.equal(manifest.theme_color, '#020504')
    assert.deepEqual(manifest.categories, ['games', 'entertainment'])
    assert.equal(manifest.launch_handler.client_mode, 'navigate-existing')
    assert.equal(
      manifest.icons.some(
        (icon: { src?: string; purpose?: string }) =>
          icon.src === '/icon-maskable.svg' && icon.purpose === 'maskable'
      ),
      true
    )
    assert.equal(siteManifestResponse.status, 200)
    assert.equal(legacyManifestResponse.status, 200)
    assert.equal(iconResponse.headers.get('content-type'), 'image/svg+xml')
    assert.equal(
      maskableIconResponse.headers.get('content-type'),
      'image/svg+xml'
    )
    assert.equal(faviconResponse.headers.get('content-type'), 'image/svg+xml')
    assert.equal(touchIconResponse.headers.get('content-type'), 'image/svg+xml')
    assert.equal(sw.includes('cepheus-online-__BUILD_HASH__'), false)
    assert.equal(sw.includes('cepheus-online-'), true)
    assert.equal(sw.includes('SW_UPDATED'), true)
    assert.equal(/event\.request\.mode\s*===\s*['"]navigate['"]/.test(sw), true)
    assert.equal(sw.includes('fetch(event.request)'), true)
    assert.equal(sw.includes('/rooms/'), true)
    assert.equal(sw.includes('/api/'), true)
    assert.equal(sw.includes('/health'), true)
  })
})
