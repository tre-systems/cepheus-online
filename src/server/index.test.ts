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
    assert.equal(body.includes('id="boardSelect"'), true)
    assert.equal(body.includes('id="boardStatus"'), true)
    assert.equal(body.includes('data-sheet-tab="details"'), true)
    assert.equal(body.includes('data-sheet-tab="action"'), true)
    assert.equal(body.includes('data-sheet-tab="items"'), true)
    assert.equal(body.includes('data-sheet-tab="notes"'), true)
    assert.equal(body.includes('id="pieceNameInput"'), true)
    assert.equal(body.includes('id="pieceImageInput"'), true)
    assert.equal(body.includes('id="pieceImageFileInput"'), true)
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
    assert.equal(body.includes('pieceImageCache'), true)
    assert.equal(body.includes('createCustomPiece'), true)
    assert.equal(body.includes('createCustomBoard'), true)
    assert.equal(body.includes('createCharacterCommand'), true)
    assert.equal(body.includes('createManualCharacterCommand'), true)
    assert.equal(body.includes('updateManualCharacterSheetCommand'), true)
    assert.equal(body.includes('updateScoutSheetCommand'), true)
    assert.equal(body.includes('characterId: "scout"'), true)
    assert.equal(body.includes('i < 6'), true)
    assert.equal(body.includes('type: "SelectBoard"'), true)
    assert.equal(body.includes('boardId: board.id'), true)
    assert.equal(body.includes('const canSelectBoards = viewerRole.toLowerCase() === "referee"'), true)
    assert.equal(body.includes('SetPieceVisibility'), true)
    assert.equal(body.includes('roll.revealAt'), true)
    assert.equal(
      body.includes(
        'pieceImageFileInput: document.getElementById("pieceImageFileInput")'
      ),
      true
    )
    assert.equal(
      body.includes(
        'boardImageFileInput: document.getElementById("boardImageFileInput")'
      ),
      true
    )
    assert.equal(body.includes('readSelectedImageFileAsDataUrl'), true)
    assert.equal(body.includes('new FileReader()'), true)
    assert.equal(body.includes('reader.readAsDataURL(file)'), true)
    assert.equal(body.includes('file.type.startsWith("image/")'), true)
    assert.equal(
      body.includes(
        'const imageAssetId = await readSelectedImageFileAsDataUrl(els.pieceImageFileInput) || els.pieceImageInput.value.trim() || null'
      ),
      true
    )
    assert.equal(
      body.includes(
        'const imageUrl = await readSelectedImageFileAsDataUrl(els.boardImageFileInput) || els.boardImageInput.value.trim() || null'
      ),
      true
    )
    assert.equal(body.includes('imageAssetId:'), true)
    assert.equal(body.includes('imageAssetId,'), true)
    assert.equal(body.includes('url: imageUrl'), true)
    assert.equal(body.includes('els.pieceImageFileInput.value = ""'), true)
    assert.equal(body.includes('els.boardImageFileInput.value = ""'), true)
    assert.equal(body.includes('data:image/'), true)
    assert.equal(body.includes('drawImage(image'), true)
    assert.equal(body.includes('renderRail'), true)
    assert.equal(body.includes('setSheetOpen'), true)
    assert.equal(body.includes('activeSheetTab'), true)
    assert.equal(body.includes('selectedCharacter'), true)
    assert.equal(body.includes('piece?.characterId'), true)
    assert.equal(body.includes('state?.characters?.[piece.characterId]'), true)
    assert.equal(body.includes('character?.characteristics'), true)
    assert.equal(body.includes('characterSkills'), true)
    assert.equal(body.includes('character?.equipment'), true)
    assert.equal(body.includes('item?.Name || item?.name'), true)
    assert.equal(body.includes('item?.Quantity ?? item?.quantity'), true)
    assert.equal(body.includes('item?.Carried ?? item?.carried'), true)
    assert.equal(body.includes('character?.credits'), true)
    assert.equal(body.includes('expression: "2d6"'), true)
    assert.equal(body.includes('reason: name + ": " + skill'), true)
    assert.equal(body.includes('tab.dataset.sheetTab'), true)
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
    assert.equal(body.includes('--die-depth'), true)
    assert.equal(body.includes('translateZ(var(--die-depth))'), true)
    assert.equal(body.includes('.face.right'), true)
    assert.equal(body.includes('.combat-rail'), true)
    assert.equal(body.includes('.rail-status'), true)
    assert.equal(body.includes('.board-select'), true)
    assert.equal(body.includes('.board-hud #boardStatus'), true)
    assert.equal(body.includes('.rail-tools'), true)
    assert.equal(body.includes('.character-sheet.open'), true)
    assert.equal(body.includes('.sheet-skill-actions'), true)
    assert.equal(body.includes('.item-row'), true)
    assert.equal(body.includes('.sheet-empty'), true)
    assert.equal(body.includes('.dice-overlay.visible'), true)
    assert.equal(body.includes('translateX(calc(-100%'), false)
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
    assert.equal(sw.includes('cepheus-online-shell-v2'), true)
    assert.equal(sw.includes('fetch(event.request)'), true)
    assert.equal(sw.includes('/rooms/'), true)
  })
})
