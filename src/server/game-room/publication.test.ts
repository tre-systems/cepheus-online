import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {Command} from '../../shared/commands'
import {asBoardId, asGameId, asPieceId, asUserId} from '../../shared/ids'
import {getProjectedGameState} from './projection'
import {runCommandPublication} from './publication'
import {gameSeedKey, readCheckpoint, readEventStream} from './storage'
import {createMemoryStorage} from './test-support'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const publish = (
  storage: ReturnType<typeof createMemoryStorage>,
  command: Command,
  requestId = `req-${command.type}`
) =>
  runCommandPublication(storage, gameId, {
    type: 'command',
    requestId,
    command
  })

const createGameCommand = (): Command => ({
  type: 'CreateGame',
  gameId,
  actorId,
  slug: 'game-1',
  name: 'Spinward Test'
})

const createBoardCommand = (boardId = asBoardId('board-1')): Command => ({
  type: 'CreateBoard',
  gameId,
  actorId,
  boardId,
  name: 'Downport',
  width: 1000,
  height: 800,
  scale: 50
})

describe('room publication flow', () => {
  it('rejects invalid commands without writing an event stream', async () => {
    const storage = createMemoryStorage()

    const rejected = await publish(storage, {
      type: 'CreateBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      name: 'Downport',
      width: 1000,
      height: 800,
      scale: 50
    })

    assert.equal(rejected.ok, false)
    assert.equal(storage.records.size, 0)
  })

  it('creates a game, checkpoints it, and projects tail events from storage', async () => {
    const storage = createMemoryStorage()

    const created = await publish(storage, createGameCommand())

    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.value.state.eventSeq, 1)
    assert.equal((await readCheckpoint(storage, gameId))?.seq, 1)

    const board = await publish(storage, {
      type: 'CreateBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      name: 'Downport',
      imageAssetId: 'board-image-1',
      url: '/assets/boards/downport.png',
      width: 1000,
      height: 800,
      scale: 50
    })

    assert.equal(board.ok, true)
    const projected = await getProjectedGameState(storage, gameId)
    assert.equal(projected?.eventSeq, 2)
    assert.equal(projected?.boards[asBoardId('board-1')]?.name, 'Downport')
    assert.equal(
      projected?.boards[asBoardId('board-1')]?.imageAssetId,
      'board-image-1'
    )
    assert.equal(
      projected?.boards[asBoardId('board-1')]?.url,
      '/assets/boards/downport.png'
    )
  })

  it('rejects stale expected sequence numbers before mutating storage', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())
    await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      name: 'Scout',
      x: 10,
      y: 10
    })

    const stale = await publish(storage, {
      type: 'MovePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      x: 20,
      y: 20,
      expectedSeq: 1
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('selects an existing board and publishes the projected board selection', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand(asBoardId('board-1')))
    await publish(storage, createBoardCommand(asBoardId('board-2')))

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-2')
    })

    assert.equal(selected.ok, true)
    if (!selected.ok) return
    assert.equal(selected.value.state.selectedBoardId, asBoardId('board-2'))
    assert.equal(selected.value.state.eventSeq, 4)

    const storedEvent = (await readEventStream(storage, gameId))[3]?.event
    assert.deepEqual(storedEvent, {
      type: 'BoardSelected',
      boardId: asBoardId('board-2')
    })
  })

  it('rejects board selection when the board does not exist', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('missing-board')
    })

    assert.equal(selected.ok, false)
    if (selected.ok) return
    assert.equal(selected.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('rejects board selection when the game has not been created', async () => {
    const storage = createMemoryStorage()

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1')
    })

    assert.equal(selected.ok, false)
    if (selected.ok) return
    assert.equal(selected.error.code, 'game_not_found')
    assert.equal(storage.records.size, 0)
  })

  it('uses the stored room seed and event sequence for deterministic dice events', async () => {
    const first = createMemoryStorage()
    const second = createMemoryStorage()
    await first.put(gameSeedKey(gameId), 12345)
    await second.put(gameSeedKey(gameId), 12345)

    for (const storage of [first, second]) {
      await publish(storage, createGameCommand())
      await publish(storage, {
        type: 'RollDice',
        gameId,
        actorId,
        expression: '2d6+1',
        reason: 'skill check'
      })
    }

    const firstDice = (await readEventStream(first, gameId))[1]?.event
    const secondDice = (await readEventStream(second, gameId))[1]?.event

    assert.equal(firstDice?.type, 'DiceRolled')
    assert.deepEqual(firstDice, secondDice)
  })
})
