#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const DEFAULT_TARGET_URL = 'https://cepheus-online.rob-gilks.workers.dev'
const TARGET_URL =
  process.argv.slice(2).find((arg) => !arg.startsWith('-')) ??
  process.env.CEPHEUS_SMOKE_URL ??
  process.env.WORKER_URL ??
  DEFAULT_TARGET_URL
const REQUEST_TIMEOUT_MS = Number(process.env.CEPHEUS_SMOKE_TIMEOUT_MS ?? 15000)
const SMOKE_SESSION_COOKIE =
  process.env.CEPHEUS_SMOKE_SESSION_COOKIE ?? process.env.CEPHEUS_SMOKE_COOKIE
const AUTHENTICATED_SMOKE = Boolean(SMOKE_SESSION_COOKIE)
const AUTH_COOKIE_HEADER = SMOKE_SESSION_COOKIE?.includes('=')
  ? SMOKE_SESSION_COOKIE
  : SMOKE_SESSION_COOKIE
    ? `cepheus_session=${SMOKE_SESSION_COOKIE}`
    : ''
const RUN_ID = randomUUID().slice(0, 8)
const GAME_ID = `smoke-${Date.now().toString(36)}-${RUN_ID}`
let actorId = `smoke-ref-${RUN_ID}`
const ACTOR_SESSION = `smoke-session-${RUN_ID}-123456`
const BOARD_ID = `smoke-board-${RUN_ID}`
const PIECE_ID = `smoke-piece-${RUN_ID}`
const CHARACTER_ID = `smoke-character-${RUN_ID}`
const usage = `Cepheus deployed Worker smoke

Usage:
  npm run smoke:deployed
  npm run smoke:deployed -- https://example.workers.dev

Environment:
  CEPHEUS_SMOKE_URL          target Worker URL (default: ${DEFAULT_TARGET_URL})
  WORKER_URL                 fallback target Worker URL
  CEPHEUS_SMOKE_TIMEOUT_MS   per-request timeout (default: ${REQUEST_TIMEOUT_MS})
  CEPHEUS_SMOKE_SESSION_COOKIE
                             optional cepheus_session cookie for private-beta smoke
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage)
  process.exit(0)
}

const baseUrl = new URL(TARGET_URL)
baseUrl.pathname = '/'
baseUrl.search = ''
baseUrl.hash = ''

const step = async (label, action) => {
  process.stdout.write(`smoke: ${label}... `)
  await action()
  process.stdout.write('ok\n')
}

const target = (pathname) => new URL(pathname, baseUrl)

const fail = (message) => {
  throw new Error(message)
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const fetchText = async (pathname, init = {}) => {
  const { auth = true, headers: rawHeaders = {}, ...fetchInit } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const headers = {
    ...rawHeaders,
    ...(auth && AUTH_COOKIE_HEADER ? { cookie: AUTH_COOKIE_HEADER } : {})
  }

  try {
    const response = await fetch(target(pathname), {
      ...fetchInit,
      headers,
      signal: controller.signal
    })
    const body = await response.text()
    return { response, body }
  } finally {
    clearTimeout(timer)
  }
}

const fetchJson = async (pathname, init = {}) => {
  const { auth = true, headers: rawHeaders = {}, ...fetchInit } = init
  const { response, body } = await fetchText(pathname, {
    ...fetchInit,
    auth,
    headers: {
      accept: 'application/json',
      ...rawHeaders
    }
  })

  let json
  try {
    json = body ? JSON.parse(body) : null
  } catch {
    fail(`${pathname} returned non-JSON body: ${body.slice(0, 120)}`)
  }

  return { response, json }
}

const extractModuleImports = (body) => {
  const imports = new Set()
  const importPattern =
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of body.matchAll(importPattern)) {
    imports.add(match[1] ?? match[2])
  }

  return [...imports]
}

const smokeClientBundle = async () => {
  const { response, body } = await fetchText('/client/app/app.js')
  assert(response.ok, `/client/app/app.js returned HTTP ${response.status}`)
  assert(
    response.headers.get('content-type')?.includes('text/javascript'),
    '/client/app/app.js content-type mismatch'
  )
  assert(
    extractModuleImports(body).length === 0,
    '/client/app/app.js should be a self-contained bundle'
  )

  for (const marker of [
    'registerClientServiceWorker',
    'createRoomSocketController',
    'createCharacterCreationFlow',
    'deriveCharacterCreationFieldViewModels',
    'DICE_PIP_SLOTS',
    'deriveDoorToggleViewModels'
  ]) {
    assert(body.includes(marker), `/client/app/app.js missing marker ${marker}`)
  }
}

const postCommand = async (command, requestId) =>
  fetchJson(`/rooms/${GAME_ID}/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cepheus-actor-session': ACTOR_SESSION
    },
    body: JSON.stringify({
      type: 'command',
      requestId,
      command
    })
  })

const requireAccepted = async (command, requestId) => {
  const { response, json } = await postCommand(command, requestId)
  assert(
    response.ok,
    `${requestId} returned HTTP ${response.status}: ${JSON.stringify(json)}`
  )
  assert(json?.type === 'commandAccepted', `${requestId} was not accepted`)
  assert(
    typeof json.eventSeq === 'number',
    `${requestId} did not return eventSeq`
  )
  return json
}

const commandBase = (type, extra = {}) => ({
  type,
  gameId: GAME_ID,
  actorId,
  ...extra
})

const waitForLatestDiceReveal = async (state) => {
  const latestRoll = state?.diceLog?.at(-1)
  if (!latestRoll?.revealAt) return
  const waitMs = Date.parse(latestRoll.revealAt) - Date.now()
  if (waitMs > 0) await delay(waitMs + 150)
}

const openWebSocket = async () => {
  assert(
    typeof WebSocket === 'function',
    'Node built-in WebSocket is not available in this runtime'
  )

  const url = target(`/rooms/${GAME_ID}/ws?viewer=spectator`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(url)
  const messages = []
  const waiters = new Set()

  const settleWaiters = () => {
    for (const waiter of [...waiters]) {
      const message = messages.find(waiter.predicate)
      if (!message) continue
      waiters.delete(waiter)
      clearTimeout(waiter.timeout)
      waiter.resolve(message)
    }
  }

  socket.addEventListener('message', (event) => {
    try {
      messages.push(JSON.parse(event.data))
      settleWaiters()
    } catch {
      return
    }
  })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out opening WebSocket'))
    }, REQUEST_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(timeout)
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('error', onError)
    }

    const onOpen = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error('WebSocket open failed'))
    }

    socket.addEventListener('open', onOpen)
    socket.addEventListener('error', onError)
  })

  return {
    close: () => socket.close(),
    waitFor: (predicate, label) => {
      const message = messages.find(predicate)
      if (message) return Promise.resolve(message)

      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timeout: setTimeout(() => {
            waiters.delete(waiter)
            reject(new Error(`Timed out waiting for WebSocket ${label}`))
          }, REQUEST_TIMEOUT_MS)
        }
        waiters.add(waiter)
      })
    }
  }
}

let unauthenticatedRoomStatus = null

await step('health endpoints', async () => {
  for (const pathname of ['/health', '/api/health']) {
    const { response, json } = await fetchJson(pathname)
    assert(response.ok, `${pathname} returned HTTP ${response.status}`)
    assert(json?.ok === true, `${pathname} did not report ok: true`)
    assert(json?.service === 'cepheus-online', `${pathname} service mismatch`)
  }
})

await step('shell assets', async () => {
  const assets = [
    ['/', 'text/html', ['Cepheus Online', 'pwaUpdatePrompt']],
    ['/client.js', 'text/javascript', 'import "/client/app/app.js"'],
    ['/client/app/app.js', 'text/javascript', 'registerClientServiceWorker'],
    ['/styles.css', 'text/css', '.app-shell']
  ]

  for (const [pathname, contentType, markers] of assets) {
    const { response, body } = await fetchText(pathname)
    assert(response.ok, `${pathname} returned HTTP ${response.status}`)
    assert(
      response.headers.get('content-type')?.includes(contentType),
      `${pathname} content-type mismatch`
    )
    for (const marker of Array.isArray(markers) ? markers : [markers]) {
      assert(body.includes(marker), `${pathname} missing marker ${marker}`)
    }
  }

  await smokeClientBundle()
})

await step('manifest, icons, and service worker', async () => {
  const { response, json: manifest } = await fetchJson('/site.webmanifest')
  assert(response.ok, 'site.webmanifest did not load')
  assert(manifest?.name === 'Cepheus Online', 'manifest name mismatch')
  assert(manifest?.display === 'standalone', 'manifest display mismatch')
  assert(Array.isArray(manifest?.icons), 'manifest icons missing')
  assert(
    manifest.icons.some((icon) => icon.src === '/icon.svg'),
    'manifest missing icon.svg'
  )
  assert(
    manifest.icons.some((icon) => icon.src === '/icon-maskable.svg'),
    'manifest missing maskable SVG icon'
  )

  for (const pathname of [
    '/manifest.webmanifest',
    '/manifest.json',
    '/icon.svg',
    '/icon-maskable.svg',
    '/favicon.svg',
    '/apple-touch-icon.svg'
  ]) {
    const { response: assetResponse } = await fetchText(pathname)
    assert(
      assetResponse.ok,
      `${pathname} returned HTTP ${assetResponse.status}`
    )
  }

  const { response: swResponse, body: sw } = await fetchText('/sw.js')
  assert(swResponse.ok, 'sw.js did not load')
  assert(sw.includes('/rooms/'), 'service worker must bypass room routes')
  assert(sw.includes('/health'), 'service worker must bypass health routes')
  assert(
    sw.includes('SKIP_WAITING'),
    'service worker must support accepted updates'
  )
})

await step('unauthenticated private-beta failures', async () => {
  const { response: sessionResponse, json: session } = await fetchJson(
    '/api/session',
    { auth: false }
  )
  assert(
    sessionResponse.ok,
    `/api/session returned HTTP ${sessionResponse.status}`
  )
  assert(
    session?.authenticated === false,
    '/api/session should report unauthenticated without a cookie'
  )

  const { response: roomCreateResponse } = await fetchJson('/api/rooms', {
    auth: false,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId: GAME_ID, name: `Smoke ${RUN_ID}` })
  })
  assert(
    [401, 501].includes(roomCreateResponse.status),
    `/api/rooms unauthenticated status mismatch: ${roomCreateResponse.status}`
  )

  const { response: stateResponse } = await fetchJson(
    `/rooms/${GAME_ID}/state`,
    { auth: false }
  )
  unauthenticatedRoomStatus = stateResponse.status
  assert(
    [401, 501].includes(stateResponse.status),
    `/rooms/:id/state unauthenticated status mismatch: ${stateResponse.status}`
  )
})

if (!AUTHENTICATED_SMOKE) {
  fail(
    `Target requires private-beta authentication for room smoke (unauthenticated room state returned HTTP ${unauthenticatedRoomStatus}); set CEPHEUS_SMOKE_SESSION_COOKIE to a valid cepheus_session cookie.`
  )
}

if (AUTHENTICATED_SMOKE) {
  await step('private-beta smoke session', async () => {
    const { response: sessionResponse, json: session } =
      await fetchJson('/api/session')
    assert(
      sessionResponse.ok,
      `/api/session returned HTTP ${sessionResponse.status}`
    )
    assert(
      session?.authenticated === true && session.user?.id,
      '/api/session did not return an authenticated user'
    )
    actorId = session.user.id

    const { response: createRoomResponse, json: createRoom } = await fetchJson(
      '/api/rooms',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomId: GAME_ID,
          name: `Smoke ${RUN_ID}`
        })
      }
    )
    assert(
      createRoomResponse.status === 201,
      `/api/rooms returned HTTP ${createRoomResponse.status}: ${JSON.stringify(createRoom)}`
    )
    assert(createRoom?.room?.id === GAME_ID, 'created room id mismatch')
  })
}

let eventSeq = 0

await step('room command flow', async () => {
  const createGame = await requireAccepted(
    commandBase('CreateGame', {
      slug: GAME_ID,
      name: `Smoke ${RUN_ID}`
    }),
    'create-game'
  )
  eventSeq = createGame.eventSeq

  const createBoard = await requireAccepted(
    commandBase('CreateBoard', {
      expectedSeq: eventSeq,
      boardId: BOARD_ID,
      name: 'Smoke board',
      width: 600,
      height: 400,
      scale: 50
    }),
    'create-board'
  )
  eventSeq = createBoard.eventSeq

  const createPiece = await requireAccepted(
    commandBase('CreatePiece', {
      expectedSeq: eventSeq,
      pieceId: PIECE_ID,
      boardId: BOARD_ID,
      name: 'Smoke piece',
      x: 50,
      y: 60,
      width: 40,
      height: 40,
      scale: 1
    }),
    'create-piece'
  )
  eventSeq = createPiece.eventSeq

  assert(
    createPiece.state?.pieces?.[PIECE_ID]?.name === 'Smoke piece',
    'created piece missing from accepted state'
  )
})

await step('character creation lifecycle', async () => {
  const created = await requireAccepted(
    commandBase('CreateCharacter', {
      expectedSeq: eventSeq,
      characterId: CHARACTER_ID,
      characterType: 'PLAYER',
      name: 'Smoke traveller'
    }),
    'create-character'
  )
  eventSeq = created.eventSeq

  const started = await requireAccepted(
    commandBase('StartCharacterCreation', {
      expectedSeq: eventSeq,
      characterId: CHARACTER_ID
    }),
    'start-character-creation'
  )
  eventSeq = started.eventSeq
  assert(
    started.state?.characters?.[CHARACTER_ID]?.creation?.state?.status ===
      'CHARACTERISTICS',
    'character creation did not start at characteristics'
  )

  let latestCreationState = started.state
  for (const characteristic of ['str', 'dex', 'end', 'int', 'edu', 'soc']) {
    const rolled = await requireAccepted(
      commandBase('RollCharacterCreationCharacteristic', {
        expectedSeq: eventSeq,
        characterId: CHARACTER_ID,
        characteristic
      }),
      `roll-characteristic-${characteristic}`
    )
    eventSeq = rolled.eventSeq
    if (characteristic === 'str') {
      const latestRoll = rolled.state?.diceLog?.at(-1)
      assert(latestRoll?.revealAt, 'characteristic roll missing revealAt')
      assert(!('rolls' in latestRoll), 'pre-reveal command state leaked rolls')
      assert(!('total' in latestRoll), 'pre-reveal command state leaked total')
      assert(
        rolled.state?.characters?.[CHARACTER_ID]?.characteristics?.str == null,
        'pre-reveal command state leaked STR characteristic'
      )
    }
    latestCreationState = rolled.state
  }

  await waitForLatestDiceReveal(latestCreationState)
  const { json: revealedCreation } = await fetchJson(
    `/rooms/${GAME_ID}/state?viewer=referee&user=${actorId}`
  )
  assert(
    revealedCreation?.state?.characters?.[CHARACTER_ID]?.creation?.state
      ?.status === 'HOMEWORLD',
    'character creation did not advance to homeworld'
  )
})

await step('stale expectedSeq rejection', async () => {
  const { response, json } = await postCommand(
    commandBase('MovePiece', {
      expectedSeq: eventSeq - 1,
      pieceId: PIECE_ID,
      x: 70,
      y: 80
    }),
    'stale-move'
  )
  assert(response.status === 409, `stale move returned HTTP ${response.status}`)
  assert(json?.type === 'commandRejected', 'stale move was not rejected')
  assert(
    json.error?.code === 'stale_command',
    `stale move error mismatch: ${JSON.stringify(json?.error)}`
  )
})

await step('hidden-piece viewer filtering', async () => {
  const hidden = await requireAccepted(
    commandBase('SetPieceVisibility', {
      expectedSeq: eventSeq,
      pieceId: PIECE_ID,
      visibility: 'HIDDEN'
    }),
    'hide-piece'
  )
  eventSeq = hidden.eventSeq

  const { json: refereeState } = await fetchJson(
    `/rooms/${GAME_ID}/state?viewer=referee&user=${actorId}`
  )
  const { json: playerState } = await fetchJson(
    `/rooms/${GAME_ID}/state?viewer=player&user=smoke-player-${RUN_ID}`
  )
  const { json: spectatorState } = await fetchJson(
    `/rooms/${GAME_ID}/state?viewer=spectator`
  )

  assert(
    refereeState?.state?.pieces?.[PIECE_ID]?.visibility === 'HIDDEN',
    'referee cannot see hidden piece'
  )
  assert(
    !playerState?.state?.pieces?.[PIECE_ID],
    'player projection leaked hidden piece'
  )
  assert(
    !spectatorState?.state?.pieces?.[PIECE_ID],
    'spectator projection leaked hidden piece'
  )
})

await step('WebSocket broadcast', async () => {
  if (typeof WebSocket !== 'function') {
    process.stdout.write('skipped (Node built-in WebSocket unavailable) ')
    return
  }
  if (AUTHENTICATED_SMOKE) {
    process.stdout.write(
      'skipped (authenticated smoke requires browser-managed cookies) '
    )
    return
  }

  const client = await openWebSocket()
  try {
    await client.waitFor(
      (message) => message.type === 'roomState',
      'initial roomState'
    )

    const broadcastPromise = client.waitFor(
      (message) =>
        message.type === 'roomState' &&
        Array.isArray(message.state?.diceLog) &&
        message.state.diceLog.some((roll) => roll.reason === 'Smoke broadcast'),
      'dice broadcast'
    )

    const roll = await requireAccepted(
      commandBase('RollDice', {
        expectedSeq: eventSeq,
        expression: '2d6',
        reason: 'Smoke broadcast'
      }),
      'roll-dice'
    )
    eventSeq = roll.eventSeq
    await broadcastPromise
  } finally {
    client.close()
  }
})

process.stdout.write(
  `smoke: completed ${baseUrl.origin} room ${GAME_ID} at eventSeq ${eventSeq}\n`
)
