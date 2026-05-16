import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameEvent } from '../../shared/events'
import { asGameId, asUserId } from '../../shared/ids'
import { LIVE_DICE_RESULT_REVEAL_DELAY_MS } from '../../shared/live-activity'
import type { DurableObjectState } from '../cloudflare'
import type { Env } from '../env'
import { GameRoomDO } from './game-room-do'
import type { PublicationTelemetryEvent } from './publication-telemetry'
import { createMemoryStorage } from './test-support'
import { appendEvents, gameSeedKey, readEventStream } from './storage'

type TestSocket = WebSocket & {
  sent: string[]
}

const createSocket = (): TestSocket => {
  const socket = {
    sent: [] as string[],
    send(message: string) {
      socket.sent.push(message)
    }
  }

  return socket as unknown as TestSocket
}

const parseMessages = (socket: TestSocket) =>
  socket.sent.map((message) => JSON.parse(message))

const asRecord = (value: unknown): Record<string, unknown> => {
  assert.equal(typeof value, 'object')
  assert.equal(value !== null, true)

  return value as Record<string, unknown>
}

const assertPreRevealDiceDetailsHidden = (rawMessage: unknown) => {
  const message = asRecord(rawMessage)
  assert.equal(
    message.type === 'commandAccepted' || message.type === 'roomState',
    true
  )
  const state = asRecord(message.state)
  const diceLog = state.diceLog

  assert.equal(Array.isArray(diceLog), true)
  const roll = asRecord((diceLog as unknown[])[0])

  assert.equal(typeof roll?.createdAt, 'string')
  assert.equal(typeof roll?.revealAt, 'string')
  assert.equal(
    Date.parse(roll.revealAt as string) > Date.parse(roll.createdAt as string),
    true
  )
  assert.equal('rolls' in roll, false, 'pre-reveal dice log omits rolls')
  assert.equal('total' in roll, false, 'pre-reveal dice log omits total')

  const liveActivities = message.liveActivities

  assert.equal(Array.isArray(liveActivities), true)
  const activity = asRecord((liveActivities as unknown[])[0])
  assert.equal(activity?.type, 'diceRoll')
  assert.equal(typeof activity.createdAt, 'string')
  const reveal = asRecord(activity.reveal)

  assert.equal(typeof reveal.revealAt, 'string')
  assert.equal(
    Date.parse(reveal.revealAt as string) >
      Date.parse(activity.createdAt as string),
    true
  )
  assert.equal('rolls' in activity, false, 'pre-reveal activity omits rolls')
  assert.equal('total' in activity, false, 'pre-reveal activity omits total')
}

const assertRoomStateDiceDetailsHidden = (rawMessage: unknown) => {
  const message = asRecord(rawMessage)
  assert.equal(message.type, 'roomState')
  const state = asRecord(message.state)
  const diceLog = state.diceLog

  assert.equal(Array.isArray(diceLog), true)
  const roll = asRecord((diceLog as unknown[])[0])

  assert.equal(roll.reason, 'Refresh roll')
  assert.equal('rolls' in roll, false, 'pre-reveal dice log omits rolls')
  assert.equal('total' in roll, false, 'pre-reveal dice log omits total')
}

const assertRoomStateDiceDetailsVisible = (rawMessage: unknown) => {
  const message = asRecord(rawMessage)
  assert.equal(message.type, 'roomState')
  const state = asRecord(message.state)
  const diceLog = state.diceLog

  assert.equal(Array.isArray(diceLog), true)
  const roll = asRecord((diceLog as unknown[])[0])

  assert.equal(roll.reason, 'Refresh roll')
  assert.deepEqual(roll.rolls, [4, 3])
  assert.equal(roll.total, 7)
}

const createRoom = (
  webSockets: TestSocket[] = [],
  tags = new Map<WebSocket, string[]>(),
  storage = createMemoryStorage(),
  telemetry: PublicationTelemetryEvent[] = []
) =>
  new GameRoomDO(
    {
      storage,
      getWebSockets: () => webSockets,
      getTags: (socket) => tags.get(socket) ?? []
    } satisfies DurableObjectState,
    {} as Env,
    {
      recordPublication: (event) => telemetry.push(event)
    }
  )

const roomSocketTags = (
  viewer: string,
  user: string,
  session = 'test-session-token-123456'
) => ['game:game-1', `viewer:${viewer}`, `user:${user}`, `session:${session}`]

const postCommand = (room: GameRoomDO, body: unknown) =>
  room.fetch(
    new Request('https://cepheus.test/rooms/game-1/command', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': 'test-session-token-123456'
      },
      body: JSON.stringify(body)
    })
  )

const postRawCommand = (room: GameRoomDO, body: string) =>
  room.fetch(
    new Request('https://cepheus.test/rooms/game-1/command', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': 'test-session-token-123456'
      },
      body
    })
  )

const postTestSeed = (room: GameRoomDO, seed: unknown, host = 'cepheus.test') =>
  room.fetch(
    new Request(`https://${host}/rooms/game-1/test/seed`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ seed })
    })
  )

const postCommandWithSession = (
  room: GameRoomDO,
  body: unknown,
  actorSession: string | null
) =>
  room.fetch(
    new Request('https://cepheus.test/rooms/game-1/command', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(actorSession === null
          ? {}
          : { 'x-cepheus-actor-session': actorSession })
      },
      body: JSON.stringify(body)
    })
  )

const commandBody = (requestId: string, command: Record<string, unknown>) => ({
  type: 'command',
  requestId,
  command: {
    gameId: 'game-1',
    actorId: 'user-1',
    ...command
  }
})

const createGameBody = () =>
  commandBody('create-game', {
    type: 'CreateGame',
    slug: 'game-1',
    name: 'Spinward Test'
  })

const createBoardBody = () =>
  commandBody('create-board', {
    type: 'CreateBoard',
    boardId: 'main-board',
    name: 'Downport',
    width: 1200,
    height: 800,
    scale: 50
  })

const createPieceBody = () =>
  commandBody('create-piece', {
    type: 'CreatePiece',
    pieceId: 'scout-1',
    boardId: 'main-board',
    name: 'Scout',
    imageAssetId: '/assets/counters/TroopsBlackOnGreen.png',
    x: 100,
    y: 150
  })

const createCharacterBody = () =>
  commandBody('create-character', {
    type: 'CreateCharacter',
    characterId: 'scout',
    characterType: 'PLAYER',
    name: 'Scout'
  })

const startCharacterCreationBody = () =>
  commandBody('start-character-creation', {
    type: 'StartCharacterCreation',
    characterId: 'scout',
    expectedSeq: 2
  })

const createRefreshDiceEvents = (): GameEvent[] => [
  {
    type: 'GameCreated',
    slug: 'game-1',
    name: 'Spinward Test',
    ownerId: asUserId('user-1')
  },
  {
    type: 'DiceRolled',
    expression: '2d6',
    reason: 'Refresh roll',
    rolls: [4, 3],
    total: 7
  }
]

describe('GameRoomDO HTTP skeleton', () => {
  it('accepts a local test seed for deterministic browser journeys', async () => {
    const storage = createMemoryStorage()
    const room = createRoom([], new Map(), storage)

    const response = await postTestSeed(room, 12345)
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.ok, true)
    assert.equal(message.gameId, 'game-1')
    assert.equal(message.seed, 12345)
    assert.equal(await storage.get(gameSeedKey(asGameId('game-1'))), 12345)
  })

  it('rejects the test seed route on production hosts', async () => {
    const storage = createMemoryStorage()
    const room = createRoom([], new Map(), storage)

    const response = await postTestSeed(
      room,
      12345,
      'cepheus-online.rob-gilks.workers.dev'
    )
    const message = await response.json()

    assert.equal(response.status, 403)
    assert.equal(message.error.code, 'not_allowed')
    assert.equal(await storage.get(gameSeedKey(asGameId('game-1'))), undefined)
  })

  it('validates local test seed values', async () => {
    const room = createRoom()

    const response = await postTestSeed(room, '12345')
    const message = await response.json()

    assert.equal(response.status, 400)
    assert.equal(message.error.code, 'invalid_message')
    assert.equal(
      message.error.message,
      'seed must be an integer between 0 and 4294967295'
    )
  })

  it('serves an empty room state before creation', async () => {
    const room = createRoom()

    const response = await room.fetch(
      new Request('https://cepheus.test/rooms/game-1/state')
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'roomState')
    assert.equal(message.state, null)
    assert.equal(message.eventSeq, 0)
  })

  it('accepts a command envelope and returns a state-bearing response', async () => {
    const room = createRoom()

    const response = await postCommand(room, createGameBody())
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'commandAccepted')
    assert.equal(message.eventSeq, 1)
    assert.equal(message.state.name, 'Spinward Test')
  })

  it('requires an actor session token for command mutation', async () => {
    const room = createRoom()

    const response = await postCommandWithSession(room, createGameBody(), null)
    const message = await response.json()

    assert.equal(response.status, 403)
    assert.equal(message.type, 'commandRejected')
    assert.equal(message.error.code, 'not_allowed')
    assert.equal(
      message.error.message,
      'Actor session token is required for commands'
    )
    assert.equal(message.eventSeq, 0)
  })

  it('binds actor ids to the first browser session token per room', async () => {
    const room = createRoom()

    const accepted = await postCommandWithSession(
      room,
      createGameBody(),
      'first-session-token-123456'
    )
    const rejected = await postCommandWithSession(
      room,
      createBoardBody(),
      'second-session-token-123456'
    )
    const message = await rejected.json()

    assert.equal(accepted.status, 200)
    assert.equal(rejected.status, 403)
    assert.equal(message.type, 'commandRejected')
    assert.equal(message.error.code, 'not_allowed')
    assert.equal(
      message.error.message,
      'Actor id is already bound to another browser session'
    )
    assert.equal(message.eventSeq, 1)
  })

  it('records accepted publication telemetry through the room boundary', async () => {
    const telemetry: PublicationTelemetryEvent[] = []
    const room = createRoom([], new Map(), createMemoryStorage(), telemetry)

    const response = await postCommand(room, createGameBody())

    assert.equal(response.status, 200)
    assert.deepEqual(telemetry, [
      {
        type: 'publicationAccepted',
        gameId: asGameId('game-1'),
        requestId: 'create-game',
        commandType: 'CreateGame',
        actorId: 'user-1',
        eventSeq: 1,
        eventCount: 1
      }
    ])
  })

  it('returns user validation failures as commandRejected', async () => {
    const room = createRoom()

    const response = await postCommand(room, createBoardBody())
    const message = await response.json()

    assert.equal(response.status, 404)
    assert.equal(message.type, 'commandRejected')
    assert.equal(message.requestId, 'create-board')
    assert.equal(message.error.code, 'game_not_found')
    assert.equal(message.eventSeq, 0)
  })

  it('rejects oversized command bodies before JSON decoding', async () => {
    const room = createRoom()

    const response = await postRawCommand(room, ' '.repeat(70 * 1024))
    const message = await response.json()

    assert.equal(response.status, 413)
    assert.equal(message.type, 'error')
    assert.equal(message.error.code, 'invalid_message')
    assert.equal(message.error.message, 'Command body is too large')
  })

  it('records commandRejected publication telemetry through the room boundary', async () => {
    const telemetry: PublicationTelemetryEvent[] = []
    const room = createRoom([], new Map(), createMemoryStorage(), telemetry)
    await postCommand(room, createGameBody())
    telemetry.length = 0

    const response = await postCommand(
      room,
      commandBody('create-invalid-board', {
        type: 'CreateBoard',
        boardId: 'main-board',
        name: 'Downport',
        width: -1,
        height: 800,
        scale: 50
      })
    )
    const message = await response.json()

    assert.equal(response.status, 400)
    assert.equal(message.type, 'commandRejected')
    assert.equal(message.error.code, 'invalid_command')
    assert.deepEqual(telemetry, [
      {
        type: 'publicationRejected',
        gameId: asGameId('game-1'),
        requestId: 'create-invalid-board',
        commandType: 'CreateBoard',
        actorId: 'user-1',
        code: 'invalid_command',
        message: 'width must be positive',
        currentSeq: 1
      }
    ])
  })

  it('returns internal publication failures as HTTP 500 errors', async () => {
    const storage = createMemoryStorage()
    const telemetry: PublicationTelemetryEvent[] = []
    const get = storage.get.bind(storage)
    storage.get = async <T = unknown>(key: string): Promise<T | undefined> => {
      const value = await get<T>(key)

      if (key === 'checkpoint:game-1' && value) {
        const checkpoint = value as unknown as {
          state: {
            name: string
          }
        }

        return {
          ...checkpoint,
          state: {
            ...checkpoint.state,
            name: `${checkpoint.state.name} (corrupt)`
          }
        } as T
      }

      return value
    }
    const room = createRoom([], new Map(), storage, telemetry)

    const response = await postCommand(room, createGameBody())
    const message = await response.json()

    assert.equal(response.status, 500)
    assert.equal(message.type, 'error')
    assert.equal(message.error.code, 'projection_mismatch')
    assert.equal(
      message.error.message,
      'Stored event stream does not match live projection'
    )
    assert.equal((await readEventStream(storage, asGameId('game-1'))).length, 1)
    assert.deepEqual(telemetry, [
      {
        type: 'publicationInternalError',
        gameId: asGameId('game-1'),
        requestId: 'create-game',
        commandType: 'CreateGame',
        actorId: 'user-1',
        code: 'projection_mismatch',
        message: 'Stored event stream does not match live projection',
        currentSeq: 0,
        eventSeq: 1
      }
    ])
  })

  it('serves the current room projection', async () => {
    const room = createRoom()
    await postCommand(room, createGameBody())

    const response = await room.fetch(
      new Request('https://cepheus.test/rooms/game-1/state')
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'roomState')
    assert.equal(message.eventSeq, 1)
    assert.equal(message.state.name, 'Spinward Test')
  })

  it('moves a piece through expected sequence commands', async () => {
    const room = createRoom()
    await postCommand(room, createGameBody())
    await postCommand(room, createBoardBody())
    await postCommand(room, createPieceBody())

    const response = await postCommand(
      room,
      commandBody('move-piece', {
        type: 'MovePiece',
        pieceId: 'scout-1',
        x: 300,
        y: 260,
        expectedSeq: 3
      })
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'commandAccepted')
    assert.equal(message.eventSeq, 4)
    assert.equal(message.state.pieces['scout-1'].x, 300)
    assert.equal(message.state.pieces['scout-1'].y, 260)
    assert.equal(
      message.state.pieces['scout-1'].imageAssetId,
      '/assets/counters/TroopsBlackOnGreen.png'
    )
  })

  it('selects the active board through HTTP commands', async () => {
    const room = createRoom()
    await postCommand(room, createGameBody())
    await postCommand(room, createBoardBody())
    await postCommand(
      room,
      commandBody('create-board-2', {
        type: 'CreateBoard',
        boardId: 'upper-deck',
        name: 'Upper Deck',
        width: 1200,
        height: 800,
        scale: 50
      })
    )

    const response = await postCommand(
      room,
      commandBody('select-board', {
        type: 'SelectBoard',
        boardId: 'upper-deck'
      })
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'commandAccepted')
    assert.equal(message.eventSeq, 4)
    assert.equal(message.state.selectedBoardId, 'upper-deck')
  })

  it('records board door state through HTTP commands', async () => {
    const room = createRoom()
    await postCommand(room, createGameBody())
    await postCommand(room, createBoardBody())

    const response = await postCommand(
      room,
      commandBody('open-door', {
        type: 'SetDoorOpen',
        boardId: 'main-board',
        doorId: 'iris-1',
        open: true,
        expectedSeq: 2
      })
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'commandAccepted')
    assert.equal(message.eventSeq, 3)
    assert.deepEqual(message.state.boards['main-board'].doors['iris-1'], {
      id: 'iris-1',
      open: true
    })
  })

  it('filters hidden pieces out of player projections', async () => {
    const room = createRoom()
    await postCommand(room, createGameBody())
    await postCommand(room, createBoardBody())
    await postCommand(room, createPieceBody())
    await postCommand(
      room,
      commandBody('hide-piece', {
        type: 'SetPieceVisibility',
        pieceId: 'scout-1',
        visibility: 'HIDDEN'
      })
    )

    const response = await room.fetch(
      new Request(
        'https://cepheus.test/rooms/game-1/state?viewer=player&user=player-2'
      )
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(message.state.pieces, {})
  })

  it('keeps pre-reveal dice details out of player and spectator room state refreshes', async () => {
    const storage = createMemoryStorage()
    const createdAt = new Date(Date.now() + 1000).toISOString()
    await appendEvents(
      storage,
      asGameId('game-1'),
      asUserId('user-1'),
      createRefreshDiceEvents(),
      createdAt
    )
    const room = createRoom([], new Map(), storage)

    for (const url of [
      'https://cepheus.test/rooms/game-1/state?viewer=player&user=user-2',
      'https://cepheus.test/rooms/game-1/state?viewer=spectator&user=user-3'
    ]) {
      const response = await room.fetch(new Request(url))
      const message = await response.json()

      assert.equal(response.status, 200)
      assertRoomStateDiceDetailsHidden(message)
    }
  })

  it('reveals dice details in player and spectator room state refreshes after reveal time', async () => {
    const storage = createMemoryStorage()
    const createdAt = new Date(
      Date.now() - LIVE_DICE_RESULT_REVEAL_DELAY_MS - 1000
    ).toISOString()
    await appendEvents(
      storage,
      asGameId('game-1'),
      asUserId('user-1'),
      createRefreshDiceEvents(),
      createdAt
    )
    const room = createRoom([], new Map(), storage)

    for (const url of [
      'https://cepheus.test/rooms/game-1/state?viewer=player&user=user-2',
      'https://cepheus.test/rooms/game-1/state?viewer=spectator&user=user-3'
    ]) {
      const response = await room.fetch(new Request(url))
      const message = await response.json()

      assert.equal(response.status, 200)
      assertRoomStateDiceDetailsVisible(message)
    }
  })

  it('broadcasts HTTP dice rolls to connected sockets', async () => {
    const referee = createSocket()
    const player = createSocket()
    const tags = new Map<WebSocket, string[]>([
      [referee, roomSocketTags('referee', 'user-1')],
      [player, roomSocketTags('player', 'user-2')]
    ])
    const room = createRoom([referee, player], tags)
    await postCommand(room, createGameBody())
    referee.sent.length = 0
    player.sent.length = 0

    const response = await postCommand(
      room,
      commandBody('roll-dice', {
        type: 'RollDice',
        expression: '2d6',
        reason: 'Table roll'
      })
    )
    const responseMessage = await response.json()

    assert.equal(response.status, 200)
    assert.equal(responseMessage.type, 'commandAccepted')
    assert.equal(responseMessage.liveActivities.length, 1)
    assert.equal(responseMessage.liveActivities[0].type, 'diceRoll')
    assert.equal(responseMessage.liveActivities[0].reason, 'Table roll')
    for (const message of [
      ...parseMessages(referee),
      ...parseMessages(player)
    ]) {
      assert.equal(message.type, 'roomState')
      assert.equal(message.eventSeq, 2)
      assert.equal(message.state.diceLog.length, 1)
      assert.equal(message.state.diceLog[0].reason, 'Table roll')
      assert.equal(message.liveActivities.length, 1)
      assert.equal(message.liveActivities[0].type, 'diceRoll')
      assert.equal(message.liveActivities[0].reason, 'Table roll')
    }
  })

  it('keeps pre-reveal dice details out of player and spectator state-bearing messages', async () => {
    const player = createSocket()
    const spectator = createSocket()
    const tags = new Map<WebSocket, string[]>([
      [player, roomSocketTags('player', 'user-2')],
      [spectator, roomSocketTags('spectator', 'user-3')]
    ])
    const room = createRoom([player, spectator], tags)
    await postCommand(room, createGameBody())
    player.sent.length = 0
    spectator.sent.length = 0

    const response = await postCommand(
      room,
      commandBody('roll-dice-player', {
        type: 'RollDice',
        actorId: 'user-2',
        expression: '2d6',
        reason: 'Table roll'
      })
    )
    const responseMessage = await response.json()

    assert.equal(response.status, 200)
    assertPreRevealDiceDetailsHidden(responseMessage)
    for (const message of [
      ...parseMessages(player),
      ...parseMessages(spectator)
    ]) {
      assertPreRevealDiceDetailsHidden(message)
    }
  })

  it('keeps pre-reveal dice details out of owner and referee activity messages', async () => {
    const referee = createSocket()
    const tags = new Map<WebSocket, string[]>([
      [referee, roomSocketTags('referee', 'user-4')]
    ])
    const room = createRoom([referee], tags)
    await postCommand(room, createGameBody())
    referee.sent.length = 0

    const response = await postCommand(
      room,
      commandBody('roll-dice-owner', {
        type: 'RollDice',
        actorId: 'user-1',
        expression: '2d6',
        reason: 'Table roll'
      })
    )
    const responseMessage = await response.json()

    assert.equal(response.status, 200)
    assertPreRevealDiceDetailsHidden(responseMessage)
    for (const message of parseMessages(referee)) {
      assertPreRevealDiceDetailsHidden(message)
    }
  })

  it('rebroadcasts socket state with dice details after the server reveal time', async () => {
    const originalSetTimeout = globalThis.setTimeout
    const originalDateNow = Date.now
    const scheduledCallbacks: (() => void)[] = []
    const nowMs = Date.parse('2026-05-16T10:00:00.000Z')

    globalThis.setTimeout = ((callback: TimerHandler) => {
      scheduledCallbacks.push(() => {
        if (typeof callback === 'function') {
          callback()
        }
      })
      return { unref() {} } as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout
    Date.now = () => nowMs

    try {
      const player = createSocket()
      const tags = new Map<WebSocket, string[]>([
        [player, roomSocketTags('player', 'user-2')]
      ])
      const room = createRoom([player], tags)
      await postCommand(room, createGameBody())
      player.sent.length = 0

      const response = await postCommand(
        room,
        commandBody('roll-dice-player', {
          type: 'RollDice',
          actorId: 'user-2',
          expression: '2d6',
          reason: 'Table roll'
        })
      )

      assert.equal(response.status, 200)
      assert.equal(player.sent.length, 1)
      assertPreRevealDiceDetailsHidden(parseMessages(player)[0])
      assert.equal(scheduledCallbacks.length, 1)

      Date.now = () => nowMs + LIVE_DICE_RESULT_REVEAL_DELAY_MS + 100
      scheduledCallbacks[0]?.()
      await new Promise<void>((resolve) => originalSetTimeout(resolve, 0))

      const messages = parseMessages(player)
      assert.equal(messages.length, 2)
      const revealed = asRecord(messages[1])
      assert.equal(revealed.type, 'roomState')
      const state = asRecord(revealed.state)
      const roll = asRecord((state.diceLog as unknown[])[0])
      assert.equal(roll.reason, 'Table roll')
      assert.equal(Array.isArray(roll.rolls), true)
      assert.equal(typeof roll.total, 'number')
      const activities = revealed.liveActivities
      assert.equal(Array.isArray(activities), true)
      const activity = asRecord((activities as unknown[])[0])
      assert.equal(activity.type, 'diceRoll')
      assert.deepEqual(activity.rolls, roll.rolls)
      assert.equal(activity.total, roll.total)
    } finally {
      globalThis.setTimeout = originalSetTimeout
      Date.now = originalDateNow
    }
  })

  it('returns character creation activity from HTTP commands', async () => {
    const room = createRoom()
    await postCommand(room, createGameBody())
    await postCommand(room, createCharacterBody())

    const response = await postCommand(room, startCharacterCreationBody())
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'commandAccepted')
    assert.equal(message.eventSeq, 3)
    assert.equal(message.liveActivities.length, 1)
    assert.deepEqual(message.liveActivities[0], {
      id: 'game-1:3',
      eventId: 'game-1:3',
      gameId: 'game-1',
      seq: 3,
      actorId: 'user-1',
      createdAt: message.liveActivities[0].createdAt,
      type: 'characterCreation',
      characterId: 'scout',
      transition: 'STARTED',
      details: 'Started character creation',
      status: 'CHARACTERISTICS',
      creationComplete: false
    })
  })

  it('broadcasts HTTP character creation activity to connected sockets', async () => {
    const referee = createSocket()
    const player = createSocket()
    const tags = new Map<WebSocket, string[]>([
      [referee, roomSocketTags('referee', 'user-1')],
      [player, roomSocketTags('player', 'user-2')]
    ])
    const room = createRoom([referee, player], tags)
    await postCommand(room, createGameBody())
    await postCommand(room, createCharacterBody())
    referee.sent.length = 0
    player.sent.length = 0

    const response = await postCommand(room, startCharacterCreationBody())
    const responseMessage = await response.json()

    assert.equal(response.status, 200)
    assert.equal(responseMessage.type, 'commandAccepted')
    for (const message of [
      ...parseMessages(referee),
      ...parseMessages(player)
    ]) {
      assert.equal(message.type, 'roomState')
      assert.equal(message.eventSeq, 3)
      assert.equal(message.liveActivities.length, 1)
      assert.equal(message.liveActivities[0].type, 'characterCreation')
      assert.equal(message.liveActivities[0].transition, 'STARTED')
      assert.equal(
        message.liveActivities[0].details,
        'Started character creation'
      )
    }
  })

  it('broadcasts WebSocket dice rolls to the sender and peers', async () => {
    const sender = createSocket()
    const peer = createSocket()
    const tags = new Map<WebSocket, string[]>([
      [sender, roomSocketTags('player', 'user-1')],
      [peer, roomSocketTags('player', 'user-2')]
    ])
    const room = createRoom([sender, peer], tags)
    await postCommand(room, createGameBody())
    sender.sent.length = 0
    peer.sent.length = 0

    await room.webSocketMessage(
      sender,
      JSON.stringify(
        commandBody('roll-dice', {
          type: 'RollDice',
          expression: '2d6',
          reason: 'Table roll'
        })
      )
    )

    const senderMessages = parseMessages(sender)
    const peerMessages = parseMessages(peer)
    assert.deepEqual(
      senderMessages.map((message) => message.type),
      ['commandAccepted']
    )
    assert.deepEqual(
      peerMessages.map((message) => message.type),
      ['roomState']
    )
    assert.equal(senderMessages[0].requestId, 'roll-dice')
    assert.equal(senderMessages[0].liveActivities.length, 1)
    assert.equal(senderMessages[0].liveActivities[0].type, 'diceRoll')
    assert.equal(senderMessages[0].liveActivities[0].reason, 'Table roll')
    assert.equal(senderMessages[0].eventSeq, 2)
    assert.equal(senderMessages[0].state.diceLog.length, 1)
    assert.equal(senderMessages[0].state.diceLog[0].reason, 'Table roll')
    assert.equal(peerMessages[0].eventSeq, 2)
    assert.equal(peerMessages[0].state.diceLog.length, 1)
    assert.equal(peerMessages[0].state.diceLog[0].reason, 'Table roll')
    assert.equal(peerMessages[0].liveActivities.length, 1)
    assert.equal(peerMessages[0].liveActivities[0].type, 'diceRoll')
    assert.equal(peerMessages[0].liveActivities[0].reason, 'Table roll')
  })
})
