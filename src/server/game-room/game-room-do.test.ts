import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {Env} from '../env'
import {GameRoomDO} from './game-room-do'
import {createMemoryStorage} from './test-support'

const createRoom = () =>
  new GameRoomDO(
    {
      storage: createMemoryStorage()
    },
    {} as Env
  )

const postCommand = (room: GameRoomDO, body: unknown) =>
  room.fetch(
    new Request('https://cepheus.test/rooms/game-1/command', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
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
    x: 100,
    y: 150
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
})
