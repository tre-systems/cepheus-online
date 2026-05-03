import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import worker from './index'
import type { Env } from './env'

describe('Worker static client', () => {
  it('serves the browser shell from the Worker fallback', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/html; charset=utf-8'
    )
    assert.equal(body.includes('<canvas id="boardCanvas"'), true)
    assert.equal(body.includes('class="combat-rail"'), true)
    assert.equal(body.includes('id="characterSheet"'), true)
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
    assert.equal(body, 'import "/client/app/app.js";\n')
  })

  it('serves the dependency-free browser module', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/client/app/app.js'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    const compactBody = body.replace(/\s+/g, '')
    const includesCode = (code: string): boolean =>
      compactBody.includes(code.replace(/\s+/g, ''))

    assert.equal(body.includes('new WebSocket'), true)
    assert.equal(
      body.includes('socket.send(JSON.stringify(commandMessage'),
      false
    )
    assert.equal(body.includes('serviceWorker'), true)
    assert.equal(body.includes('controllerchange'), true)
    assert.equal(body.includes('beforeinstallprompt'), true)
    assert.equal(body.includes('appinstalled'), true)
    assert.equal(body.includes('INSTALL_DISMISSED_KEY'), true)
    assert.equal(body.includes('../dice.js'), true)
    assert.equal(body.includes('pieceImageCache'), true)
    assert.equal(body.includes('createCustomPiece'), true)
    assert.equal(body.includes('createCustomBoard'), true)
    assert.equal(body.includes('createCharacterCommand'), true)
    assert.equal(body.includes('createManualCharacterCommand'), true)
    assert.equal(body.includes('updateManualCharacterSheetCommand'), true)
    assert.equal(body.includes('updateScoutSheetCommand'), true)
    assert.equal(body.includes("characterId: 'scout'"), true)
    assert.equal(body.includes('i < 6'), true)
    assert.equal(body.includes("type: 'SelectBoard'"), true)
    assert.equal(body.includes('boardId: board.id'), true)
    assert.equal(
      body.includes(
        "const canSelectBoards = viewerRole.toLowerCase() === 'referee'"
      ),
      true
    )
    assert.equal(body.includes('SetPieceVisibility'), true)
    assert.equal(body.includes('SetPieceFreedom'), true)
    assert.equal(body.includes('freedomActions'), true)
    assert.equal(body.includes("sheetRow('Move', piece.freedom)"), true)
    assert.equal(body.includes('roll.revealAt'), true)
    assert.equal(body.includes('pieceImageFileInput'), true)
    assert.equal(body.includes('pieceCropInput'), true)
    assert.equal(body.includes('pieceCropXInput'), true)
    assert.equal(body.includes('pieceCropYInput'), true)
    assert.equal(body.includes('pieceCropWidthInput'), true)
    assert.equal(body.includes('pieceCropHeightInput'), true)
    assert.equal(body.includes('pieceWidthInput'), true)
    assert.equal(body.includes('pieceHeightInput'), true)
    assert.equal(body.includes('pieceScaleInput'), true)
    assert.equal(body.includes('boardImageFileInput'), true)
    assert.equal(body.includes('readSelectedImageFileAsDataUrl'), true)
    assert.equal(body.includes('readSelectedCroppedImageFileAsDataUrl'), true)
    assert.equal(body.includes('readImageDimensions'), true)
    assert.equal(body.includes('selectedPieceImageDataUrl'), true)
    assert.equal(body.includes('applyBoardFileDimensions'), true)
    assert.equal(body.includes('applyPieceFileDimensions'), true)
    assert.equal(body.includes('parseNonNegativeIntegerInput'), true)
    assert.equal(body.includes('parsePositiveNumberInput'), true)
    assert.equal(
      includesCode(
        'const width = parsePositiveIntegerInput(els.pieceWidthInput, 50)'
      ),
      true
    )
    assert.equal(
      includesCode(
        'const height = parsePositiveIntegerInput(els.pieceHeightInput, 50)'
      ),
      true
    )
    assert.equal(
      includesCode(
        'const scale = parsePositiveNumberInput(els.pieceScaleInput, 1)'
      ),
      true
    )
    assert.equal(
      includesCode('const imageAssetId = await selectedPieceImageDataUrl()'),
      true
    )
    assert.equal(
      body.includes('readSelectedImageFileAsDataUrl(els.boardImageFileInput)'),
      true
    )
    assert.equal(body.includes('els.boardImageInput.value.trim()'), true)
    assert.equal(body.includes('imageAssetId:'), true)
    assert.equal(body.includes('imageAssetId,'), true)
    assert.equal(body.includes('url: imageUrl'), true)
    assert.equal(includesCode('x, y, width, height, scale'), true)
    assert.equal(body.includes("els.pieceImageFileInput.value = ''"), true)
    assert.equal(body.includes('els.pieceCropInput.checked = false'), true)
    assert.equal(body.includes("els.pieceCropXInput.value = '0'"), true)
    assert.equal(body.includes("els.pieceCropYInput.value = '0'"), true)
    assert.equal(body.includes("els.pieceCropWidthInput.value = '150'"), true)
    assert.equal(body.includes("els.pieceCropHeightInput.value = '150'"), true)
    assert.equal(body.includes("els.pieceWidthInput.value = '50'"), true)
    assert.equal(body.includes("els.pieceHeightInput.value = '50'"), true)
    assert.equal(body.includes("els.pieceScaleInput.value = '1'"), true)
    assert.equal(body.includes("els.boardImageFileInput.value = ''"), true)
    assert.equal(body.includes('renderRail'), true)
    assert.equal(body.includes('DEFAULT_BOARD_CAMERA'), true)
    assert.equal(body.includes('./board-geometry.js'), true)
    assert.equal(
      includesCode('const screenToBoard = (screen, _board, transform)'),
      true
    )
    assert.equal(
      body.includes('ctx.scale(transform.scale, transform.scale)'),
      true
    )
    assert.equal(
      body.includes(
        'setCameraZoom(boardCamera.zoom * zoomFactor, screenPoint(event))'
      ),
      true
    )
    assert.equal(body.includes("kind: 'pan'"), true)
    assert.equal(body.includes("kind: 'piece'"), true)
    assert.equal(body.includes('setSheetOpen'), true)
    assert.equal(body.includes('activeSheetTab'), true)
    assert.equal(body.includes('selectedCharacter'), true)
    assert.equal(body.includes('piece?.characterId'), true)
    assert.equal(includesCode('state?.characters?.[piece.characterId]'), true)
    assert.equal(body.includes('character?.characteristics'), true)
    assert.equal(body.includes('characterSkills'), true)
    assert.equal(body.includes('character?.equipment'), true)
    assert.equal(body.includes('item?.Name || item?.name'), true)
    assert.equal(body.includes('item?.Quantity ?? item?.quantity'), true)
    assert.equal(body.includes('item?.Carried ?? item?.carried'), true)
    assert.equal(body.includes('renderNotesTab(body, piece, character)'), true)
    assert.equal(body.includes("textarea.value = character.notes || ''"), true)
    assert.equal(includesCode('characterId: piece.characterId'), true)
    assert.equal(body.includes('notes: textarea.value'), true)
    assert.equal(body.includes('editableDetailsForm(piece, character)'), true)
    assert.equal(body.includes('nullableNumberFromInput'), true)
    assert.equal(includesCode('age: nullableNumberFromInput(ageInput)'), true)
    assert.equal(body.includes('characteristics: {'), true)
    assert.equal(includesCode('str: nullableNumberFromInput(inputs.str)'), true)
    assert.equal(includesCode('soc: nullableNumberFromInput(inputs.soc)'), true)
    assert.equal(body.includes('skillListFromText'), true)
    assert.equal(body.includes('skillEditor(piece, character, skills)'), true)
    assert.equal(
      includesCode('skills: skillListFromText(textarea.value)'),
      true
    )
    assert.equal(body.includes('character?.credits'), true)
    assert.equal(body.includes('equipmentText'), true)
    assert.equal(body.includes('equipmentFromText'), true)
    assert.equal(body.includes('itemsEditor(character, equipment)'), true)
    assert.equal(
      includesCode('credits: nullableNumberFromInput(creditsInput) ?? 0'),
      true
    )
    assert.equal(
      includesCode('equipment: equipmentFromText(textarea.value)'),
      true
    )
    assert.equal(body.includes("expression: '2d6'"), true)
    assert.equal(body.includes("reason: name + ': ' + skill"), true)
    assert.equal(body.includes('tab.dataset.sheetTab'), true)
  })

  it('serves the dependency-free board geometry helper module', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/client/app/board-geometry.js'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('deriveBoardTransform'), true)
    assert.equal(body.includes('deriveCameraZoom'), true)
    assert.equal(body.includes('findHitPiece'), true)
  })

  it('serves the dependency-free image asset helper module', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/client/app/image-assets.js'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('URL.createObjectURL(file)'), true)
    assert.equal(body.includes('image.naturalWidth'), true)
    assert.equal(body.includes("document.createElement('canvas')"), true)
    assert.equal(body.includes("canvas.toDataURL('image/png')"), true)
    assert.equal(body.includes('new FileReader()'), true)
    assert.equal(body.includes('reader.readAsDataURL(file)'), true)
    assert.equal(body.includes("file.type.startsWith('image/')"), true)
    assert.equal(body.includes('data:image/'), true)
    assert.equal(body.includes('drawImage(image'), true)
    assert.equal(body.includes('browserImageUrl'), true)
  })

  it('serves the dependency-free room API helper module', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/client/app/room-api.js'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('buildRoomPath'), true)
    assert.equal(body.includes('fetchRoomState'), true)
    assert.equal(body.includes('postRoomCommand'), true)
  })

  it('serves the dependency-free dice helper module', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/client/dice.js'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('DICE_PIP_SLOTS'), true)
    assert.equal(body.includes('deriveDiceRollTiming'), true)
    assert.equal(body.includes('deriveDieFaces'), true)
  })

  it('serves cubical dice styling', async () => {
    const response = await worker.fetch(
      new Request('https://cepheus.test/styles.css'),
      {} as Env
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/css; charset=utf-8'
    )
    assert.equal(body.includes('transform-style: preserve-3d'), true)
    assert.equal(body.includes('.pip-top-left'), true)
    assert.equal(body.includes('--die-depth'), true)
    assert.equal(body.includes('translateZ(var(--die-depth))'), true)
    assert.equal(body.includes('.face.right'), true)
    assert.equal(body.includes('.combat-rail'), true)
    assert.equal(body.includes('.rail-status'), true)
    assert.equal(body.includes('.board-select'), true)
    assert.equal(body.includes('.board-hud #boardStatus'), true)
    assert.equal(body.includes('.camera-controls'), true)
    assert.equal(body.includes('.camera-button'), true)
    assert.equal(body.includes('.rail-tools'), true)
    assert.equal(body.includes('.character-sheet.open'), true)
    assert.equal(body.includes('.sheet-skill-actions'), true)
    assert.equal(body.includes('.sheet-skill-editor'), true)
    assert.equal(body.includes('.item-row'), true)
    assert.equal(body.includes('.sheet-items-editor'), true)
    assert.equal(body.includes('.sheet-empty'), true)
    assert.equal(body.includes('.sheet-notes-form'), true)
    assert.equal(body.includes('.sheet-edit-form'), true)
    assert.equal(body.includes('.sheet-stat-edit'), true)
    assert.equal(body.includes('textarea:focus'), true)
    assert.equal(body.includes('.dice-overlay.visible'), true)
    assert.equal(body.includes('.pwa-install-prompt'), true)
    assert.equal(body.includes('translateX(calc(-100%'), false)
    assert.equal(body.includes('100dvh'), true)
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
    assert.equal(sw.includes('event.request.mode === "navigate"'), true)
    assert.equal(sw.includes('fetch(event.request)'), true)
    assert.equal(sw.includes('/rooms/'), true)
    assert.equal(sw.includes('/api/'), true)
    assert.equal(sw.includes('/health'), true)
  })
})
