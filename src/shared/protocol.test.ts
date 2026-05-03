import * as assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {decodeClientMessage} from './protocol'

describe('protocol validation', () => {
  it('accepts a command envelope with a typed command', () => {
    const result = decodeClientMessage({
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

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    assert.equal(result.value.command.type, 'CreateGame')
  })

  it('accepts optional piece image asset references', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'enemy-1',
        boardId: 'main-board',
        name: 'Enemy',
        imageAssetId: '/assets/counters/TroopsBlackOnGreen.png',
        x: 100,
        y: 150
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const {command} = result.value
    assert.equal(command.type, 'CreatePiece')
    if (command.type !== 'CreatePiece') return
    assert.equal(
      command.imageAssetId,
      '/assets/counters/TroopsBlackOnGreen.png'
    )
  })

  it('accepts optional board image URLs and asset references', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-3',
      command: {
        type: 'CreateBoard',
        gameId: 'game-1',
        actorId: 'user-1',
        boardId: 'main-board',
        name: 'Downport',
        imageAssetId: 'board-image-1',
        url: '/assets/boards/downport.png',
        width: 1200,
        height: 800,
        scale: 50
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const {command} = result.value
    assert.equal(command.type, 'CreateBoard')
    if (command.type !== 'CreateBoard') return
    assert.equal(command.imageAssetId, 'board-image-1')
    assert.equal(command.url, '/assets/boards/downport.png')
  })

  it('rejects unknown message types before command handling', () => {
    const result = decodeClientMessage({
      type: 'mutateEverything'
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_message')
  })
})
