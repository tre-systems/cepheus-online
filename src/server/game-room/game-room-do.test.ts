import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { DurableObjectState } from '../cloudflare'
import type { Env } from '../env'
import { GameRoomDO } from './game-room-do'
import { createMemoryStorage } from './test-support'

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

const createRoom = (
  webSockets: TestSocket[] = [],
  tags = new Map<WebSocket, string[]>()
) =>
  new GameRoomDO(
    {
      storage: createMemoryStorage(),
      getWebSockets: () => webSockets,
      getTags: (socket) => tags.get(socket) ?? []
    } satisfies DurableObjectState,
    {} as Env
  )

const roomSocketTags = (viewer: string, user: string) => [
  'game:game-1',
  `viewer:${viewer}`,
  `user:${user}`
]

const postCommand = (room: GameRoomDO, body: unknown) =>
  room.fetch(
    new Request('https://cepheus.test/rooms/game-1/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

describe('GameRoomDO HTTP skeleton', () => {
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
      status: 'CHARACTERISTICS',
      creationComplete: false
    })
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
