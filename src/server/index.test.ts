import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import worker from './index'
import type { Env } from './env'

const clientModules = new Map<
  string,
  { markers: readonly string[]; imports?: readonly string[] }
>([
  [
    '/client/app/app.js',
    {
      markers: ['createRoomSocketController', 'registerClientServiceWorker'],
      imports: [
        '/client/app/board-view.js',
        '/client/app/app-elements.js',
        '/client/app/app-location.js',
        '/client/app/app-command-router.js',
        '/client/app/app-bootstrap.js',
        '/client/app/app-session.js',
        '/client/app/actor-session.js',
        '/client/app/board-controller.js',
        '/client/app/bootstrap-flow.js',
        '/client/app/character-creation-actions.js',
        '/client/app/character-creation-panel.js',
        '/client/app/character-creation-flow.js',
        '/client/app/character-creation-view.js',
        '/client/app/creation-activity-view.js',
        '/client/app/character-sheet-controller.js',
        '/client/app/connectivity-controller.js',
        '/client/app/dice-overlay.js',
        '/client/app/dice-reveal-state.js',
        '/client/app/door-los-view.js',
        '/client/app/image-assets.js',
        '/client/app/live-activity-client.js',
        '/client/app/piece-command-plan.js',
        '/client/app/pwa-install.js',
        '/client/app/request-id.js',
        '/client/app/room-api.js',
        '/client/app/room-menu-controller.js',
        '/client/app/room-socket-controller.js',
        '/client/app/service-worker.js',
        '/client/game-commands.js',
        '/shared/ids'
      ]
    }
  ],
  ['/client/app/app-elements.js', { markers: ['getAppElements'] }],
  [
    '/client/app/app-location.js',
    {
      markers: ['resolveAppLocationIdentity', 'buildRoomWebSocketUrl'],
      imports: ['/client/app/room-api.js']
    }
  ],
  [
    '/client/app/app-command-router.js',
    { markers: ['createAppCommandRouter', 'sequenceCommand'] }
  ],
  ['/client/app/app-bootstrap.js', { markers: ['createAppBootstrap'] }],
  ['/client/app/app-session.js', { markers: ['createAppSession'] }],
  ['/client/app/actor-session.js', { markers: ['resolveActorSessionSecret'] }],
  ['/client/app/board-geometry.js', { markers: ['deriveBoardTransform'] }],
  ['/client/app/board-view.js', { markers: ['selectedBoardPieces'] }],
  [
    '/client/app/board-controller.js',
    {
      markers: ['createBoardController'],
      imports: [
        '/client/app/board-geometry.js',
        '/client/game-commands.js',
        '/client/app/board-view.js',
        '/client/app/image-assets.js'
      ]
    }
  ],
  ['/client/app/bootstrap-flow.js', { markers: ['nextBootstrapCommand'] }],
  [
    '/client/app/character-creation-actions.js',
    {
      markers: ['deriveCharacterCreationActionPlan'],
      imports: [
        '/shared/character-creation/benefits.js',
        '/shared/character-creation/legal-actions.js'
      ]
    }
  ],
  [
    '/client/app/character-creation-panel.js',
    { markers: ['createCharacterCreationPanel'] }
  ],
  [
    '/shared/character-creation/career-rules.js',
    { markers: ['evaluateCareerCheck', 'parseCareerCheck'] }
  ],
  [
    '/shared/character-creation/career-rules',
    { markers: ['evaluateCareerCheck', 'parseCareerCheck'] }
  ],
  [
    '/shared/character-creation/cepheus-srd-ruleset.js',
    { markers: ['CEPHEUS_SRD_CAREERS', 'Scout', 'Merchant'] }
  ],
  [
    '/shared/character-creation/skills.js',
    { markers: ['normalizeCareerSkill', 'tallyCareerSkills'] }
  ],
  [
    '/shared/character-creation/background-skills.js',
    {
      markers: [
        'deriveBackgroundSkillPlan',
        'deriveTotalBackgroundSkillAllowance'
      ]
    }
  ],
  [
    '/shared/character-creation/benefits.js',
    { markers: ['resolveCareerBenefit', 'deriveRemainingCareerBenefits'] }
  ],
  [
    '/shared/character-creation/benefits',
    { markers: ['resolveCareerBenefit', 'deriveRemainingCareerBenefits'] }
  ],
  [
    '/shared/character-creation/term-lifecycle',
    {
      markers: ['canCompleteCreation', 'canOfferNewCareer'],
      imports: ['/shared/character-creation/career-rules']
    }
  ],
  [
    '/shared/character-creation/term-lifecycle.js',
    {
      markers: ['canCompleteCreation', 'canOfferNewCareer'],
      imports: ['/shared/character-creation/career-rules']
    }
  ],
  [
    '/shared/character-creation/aging.js',
    { markers: ['resolveAging', 'selectAgingEffect'] }
  ],
  [
    '/shared/character-creation/legal-actions.js',
    {
      markers: ['deriveLegalCareerCreationActionKeys'],
      imports: [
        '/shared/character-creation/benefits',
        '/shared/character-creation/term-lifecycle'
      ]
    }
  ],
  [
    '/client/app/character-creation-flow.js',
    {
      markers: ['deriveCharacterCreationCommands'],
      imports: [
        '/shared/character-creation/aging.js',
        '/shared/character-creation/background-skills.js',
        '/shared/character-creation/benefits.js',
        '/shared/character-creation/career-rules.js',
        '/shared/character-creation/cepheus-srd-ruleset.js',
        '/shared/character-creation/term-lifecycle.js',
        '/shared/character-creation/skills.js',
        '/client/game-commands.js',
        '/client/app/bootstrap-flow.js'
      ]
    }
  ],
  [
    '/client/app/character-creation-view.js',
    {
      markers: [
        'deriveCharacterCreationFieldViewModels',
        'parseCharacterCreationDraftPatch'
      ],
      imports: [
        '/client/app/character-creation-flow.js',
        '/shared/character-creation/background-skills.js',
        '/shared/character-creation/career-rules.js',
        '/shared/character-creation/cepheus-srd-ruleset.js',
        '/shared/character-creation/skills.js'
      ]
    }
  ],
  [
    '/client/app/creation-activity-view.js',
    { markers: ['deriveCreationActivityCardsFromApplication'] }
  ],
  [
    '/client/app/character-sheet-controller.js',
    {
      markers: ['createCharacterSheetController'],
      imports: ['/client/app/character-sheet-view.js']
    }
  ],
  [
    '/client/app/character-sheet-view.js',
    { markers: ['characteristicRows', 'equipmentDisplayItems'] }
  ],
  [
    '/client/app/connectivity-controller.js',
    {
      markers: ['createConnectivityController'],
      imports: ['/client/app/connectivity.js']
    }
  ],
  ['/client/app/connectivity.js', { markers: ['createConnectivityState'] }],
  [
    '/client/app/room-socket-controller.js',
    {
      markers: ['createRoomSocketController'],
      imports: ['/client/app/app-location.js']
    }
  ],
  [
    '/client/app/dice-overlay.js',
    {
      markers: ['appendFaceValue', 'buildDie', 'animateRoll'],
      imports: ['/client/dice.js']
    }
  ],
  ['/client/app/dice-reveal-state.js', { markers: ['createDiceRevealState'] }],
  [
    '/client/app/door-los-view.js',
    {
      markers: ['deriveDoorToggleViewModels', 'deriveVisiblePieceIds'],
      imports: ['/shared/mapAssets.js']
    }
  ],
  ['/client/app/image-assets.js', { markers: ['browserImageUrl'] }],
  [
    '/client/app/live-activity-client.js',
    {
      markers: [
        'filterPendingDiceRollActivities',
        'prepareLiveActivityApplication'
      ]
    }
  ],
  [
    '/client/app/piece-command-plan.js',
    {
      markers: ['planCreatePieceCommands'],
      imports: [
        '/client/app/bootstrap-flow.js',
        '/client/app/character-creation-flow.js'
      ]
    }
  ],
  ['/client/app/pwa-install.js', { markers: ['createPwaInstallController'] }],
  ['/client/app/pwa-update-state', { markers: ['createPwaUpdateStateStore'] }],
  ['/client/app/request-id.js', { markers: ['createRequestIdFactory'] }],
  ['/client/app/room-api.js', { markers: ['postRoomCommand'] }],
  [
    '/client/app/room-menu-controller.js',
    {
      markers: ['createRoomMenuController'],
      imports: ['/client/app/app-location.js']
    }
  ],
  [
    '/client/app/service-worker.js',
    {
      markers: ['registerClientServiceWorker'],
      imports: ['/client/app/pwa-update-state']
    }
  ],
  [
    '/client/game-commands.js',
    {
      markers: ['buildSequencedCommand', 'applyServerMessage'],
      imports: ['/shared/ids', '/shared/live-activity.js']
    }
  ],
  ['/client/dice.js', { markers: ['DICE_PIP_SLOTS'] }],
  ['/shared/ids', { markers: ['asGameId', 'asUserId'] }],
  ['/shared/live-activity.js', { markers: ['deriveLiveDiceRollRevealTarget'] }],
  [
    '/shared/mapAssets.js',
    {
      markers: ['filterVisibleMapTargets', 'validateMapLosSidecar'],
      imports: ['/shared/result', '/shared/util']
    }
  ],
  ['/shared/result', { markers: ['ok', 'err'] }],
  ['/shared/util', { markers: ['isObject', 'clamp'] }]
])

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

const resolveModulePath = (fromPathname: string, specifier: string): string => {
  assert.equal(
    specifier.startsWith('./') ||
      specifier.startsWith('../') ||
      specifier.startsWith('/'),
    true,
    `${fromPathname} imports non-runtime module ${specifier}`
  )

  return new URL(specifier, `https://cepheus.test${fromPathname}`).pathname
}

const assertSameMembers = (
  actual: Iterable<string>,
  expected: Iterable<string>,
  label: string
) => {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const missing = [...expectedSet].filter((value) => !actualSet.has(value))
  const extra = [...actualSet].filter((value) => !expectedSet.has(value))

  assert.deepEqual(
    { missing, extra },
    { missing: [], extra: [] },
    `${label} mismatch`
  )
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

  it('serves the full dependency-free browser module graph', async () => {
    const queued = ['/client/app/app.js']
    const seen = new Set<string>()

    while (queued.length > 0) {
      const pathname = queued.shift()
      if (pathname === undefined) {
        throw new Error('module queue ended unexpectedly')
      }
      if (seen.has(pathname)) continue
      seen.add(pathname)

      const expected = clientModules.get(pathname)
      if (expected === undefined) {
        throw new Error(`unexpected module ${pathname}`)
      }

      const response = await fetchStaticClient(pathname)
      const body = await response.text()

      assert.equal(response.status, 200)
      assert.equal(
        response.headers.get('content-type'),
        'text/javascript; charset=utf-8'
      )

      for (const marker of expected.markers) {
        assert.equal(body.includes(marker), true)
      }

      const imports = extractModuleImports(body).map((specifier) =>
        resolveModulePath(pathname, specifier)
      )

      if (expected.imports) {
        assertSameMembers(imports, expected.imports, `${pathname} imports`)
      }

      for (const importedPathname of imports) {
        queued.push(importedPathname)
      }
    }

    assertSameMembers(seen, clientModules.keys(), 'served module graph')
  })

  it('serves the dependency-free board geometry helper module', async () => {
    const response = await fetchStaticClient('/client/app/board-geometry.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('deriveBoardTransform'), true)
    assert.equal(body.includes('deriveCameraZoom'), true)
  })

  it('serves the dependency-free image asset helper module', async () => {
    const response = await fetchStaticClient('/client/app/image-assets.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('browserImageUrl'), true)
    assert.equal(body.includes('readSelectedImageFileAsDataUrl'), true)
  })

  it('serves the dependency-free room API helper module', async () => {
    const response = await fetchStaticClient('/client/app/room-api.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('buildRoomPath'), true)
    assert.equal(body.includes('postRoomCommand'), true)
  })

  it('serves the dependency-free dice helper module', async () => {
    const response = await fetchStaticClient('/client/dice.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('DICE_PIP_SLOTS'), true)
    assert.equal(body.includes('deriveDieFaces'), true)
  })

  it('serves the client command helper module', async () => {
    const response = await fetchStaticClient('/client/game-commands.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('buildSequencedCommand'), true)
    assert.equal(body.includes('applyServerMessage'), true)
  })

  it('serves the browser dice overlay helper module', async () => {
    const response = await fetchStaticClient('/client/app/dice-overlay.js')
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('appendFaceValue'), true)
    assert.equal(body.includes('buildDie'), true)
    assert.equal(body.includes('animateRoll'), true)
  })

  it('serves the character sheet view helper module', async () => {
    const response = await fetchStaticClient(
      '/client/app/character-sheet-view.js'
    )
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(body.includes('characteristicRows'), true)
    assert.equal(body.includes('equipmentDisplayItems'), true)
    assert.equal(body.includes('skillsFromText'), true)
  })

  it('serves the character creation helper modules', async () => {
    const flowResponse = await fetchStaticClient(
      '/client/app/character-creation-flow.js'
    )
    const flowBody = await flowResponse.text()
    const viewResponse = await fetchStaticClient(
      '/client/app/character-creation-view.js'
    )
    const viewBody = await viewResponse.text()

    assert.equal(flowResponse.status, 200)
    assert.equal(
      flowResponse.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(flowBody.includes('createCharacterCreationFlow'), true)
    assert.equal(flowBody.includes('deriveCharacterCreationCommands'), true)
    assert.equal(viewResponse.status, 200)
    assert.equal(
      viewResponse.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(
      viewBody.includes('deriveCharacterCreationFieldViewModels'),
      true
    )
    assert.equal(viewBody.includes('parseCharacterCreationDraftPatch'), true)
  })

  it('serves the map asset picker helper modules', async () => {
    const libraryResponse = await fetchStaticClient(
      '/client/app/map-asset-library.js'
    )
    const libraryBody = await libraryResponse.text()
    const pickerResponse = await fetchStaticClient(
      '/client/app/map-asset-picker-view.js'
    )
    const pickerBody = await pickerResponse.text()

    assert.equal(libraryResponse.status, 200)
    assert.equal(
      libraryResponse.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(libraryBody.includes('validateMapAssetCandidates'), true)
    assert.equal(libraryBody.includes('deriveMapAssetLabel'), true)
    assert.equal(pickerResponse.status, 200)
    assert.equal(
      pickerResponse.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(pickerBody.includes('deriveMapAssetPickerViewModel'), true)
    assert.equal(pickerBody.includes('deriveCounterPieceCommandDefaults'), true)
  })

  it('serves the door LOS view and shared map helper modules', async () => {
    const doorResponse = await fetchStaticClient('/client/app/door-los-view.js')
    const doorBody = await doorResponse.text()
    const mapResponse = await fetchStaticClient('/shared/mapAssets.js')
    const mapBody = await mapResponse.text()

    assert.equal(doorResponse.status, 200)
    assert.equal(
      doorResponse.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(doorBody.includes('deriveDoorToggleViewModels'), true)
    assert.equal(doorBody.includes('deriveVisiblePieceIds'), true)
    assert.equal(mapResponse.status, 200)
    assert.equal(
      mapResponse.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    )
    assert.equal(mapBody.includes('filterVisibleMapTargets'), true)
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
