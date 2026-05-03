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

describe('GameRoomDO HTTP skeleton', () => {
  it('accepts a command envelope and returns a state-bearing response', async () => {
    const room = createRoom()

    const response = await postCommand(room, {
      type: 'command',
      requestId: 'req-1',
      command: {
        type: 'CreateGame',
        gameId: 'game-1',
        actorId: 'user-1',
        slug: 'game-1',
        name: 'Spinward Test'
      }
    })
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'commandAccepted')
    assert.equal(message.eventSeq, 1)
    assert.equal(message.state.name, 'Spinward Test')
  })

  it('serves the current room projection', async () => {
    const room = createRoom()
    await postCommand(room, {
      type: 'command',
      requestId: 'req-1',
      command: {
        type: 'CreateGame',
        gameId: 'game-1',
        actorId: 'user-1',
        slug: 'game-1',
        name: 'Spinward Test'
      }
    })

    const response = await room.fetch(
      new Request('https://cepheus.test/rooms/game-1/state')
    )
    const message = await response.json()

    assert.equal(response.status, 200)
    assert.equal(message.type, 'roomState')
    assert.equal(message.eventSeq, 1)
    assert.equal(message.state.name, 'Spinward Test')
  })
})
