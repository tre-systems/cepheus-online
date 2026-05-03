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
const RUN_ID = randomUUID().slice(0, 8)
const GAME_ID = `smoke-${Date.now().toString(36)}-${RUN_ID}`
const ACTOR_ID = `smoke-ref-${RUN_ID}`
const BOARD_ID = `smoke-board-${RUN_ID}`
const PIECE_ID = `smoke-piece-${RUN_ID}`

const usage = `Cepheus deployed Worker smoke

Usage:
  npm run smoke:deployed
  npm run smoke:deployed -- https://example.workers.dev

Environment:
  CEPHEUS_SMOKE_URL          target Worker URL (default: ${DEFAULT_TARGET_URL})
  WORKER_URL                 fallback target Worker URL
  CEPHEUS_SMOKE_TIMEOUT_MS   per-request timeout (default: ${REQUEST_TIMEOUT_MS})
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

const fetchText = async (pathname, init = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(target(pathname), {
      ...init,
      signal: controller.signal
    })
    const body = await response.text()
    return { response, body }
  } finally {
    clearTimeout(timer)
  }
}

const fetchJson = async (pathname, init = {}) => {
  const { response, body } = await fetchText(pathname, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers ?? {})
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

const postCommand = async (command, requestId) =>
  fetchJson(`/rooms/${GAME_ID}/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
  actorId: ACTOR_ID,
  ...extra
})

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
    ['/', 'text/html', 'Cepheus Online'],
    ['/client.js', 'text/javascript', 'import "/client/app/app.js"'],
    ['/client/app/app.js', 'text/javascript', 'new WebSocket'],
    ['/client/dice.js', 'text/javascript', 'DICE_PIP_SLOTS'],
    ['/styles.css', 'text/css', '.app-shell']
  ]

  for (const [pathname, contentType, marker] of assets) {
    const { response, body } = await fetchText(pathname)
    assert(response.ok, `${pathname} returned HTTP ${response.status}`)
    assert(
      response.headers.get('content-type')?.includes(contentType),
      `${pathname} content-type mismatch`
    )
    assert(body.includes(marker), `${pathname} missing marker ${marker}`)
  }
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
})

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
    `/rooms/${GAME_ID}/state?viewer=referee&user=${ACTOR_ID}`
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
