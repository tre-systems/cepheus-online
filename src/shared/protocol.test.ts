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

  it('accepts linked piece character references', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2b',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'enemy-1',
        boardId: 'main-board',
        characterId: 'enemy-character-1',
        name: 'Enemy',
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
    assert.equal(command.characterId, 'enemy-character-1')
  })

  it('accepts optional custom piece dimensions', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2c',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'door-1',
        boardId: 'main-board',
        name: 'Door',
        x: 100,
        y: 150,
        width: 50,
        height: 100,
        scale: 1.5
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const {command} = result.value
    assert.equal(command.type, 'CreatePiece')
    if (command.type !== 'CreatePiece') return
    assert.equal(command.width, 50)
    assert.equal(command.height, 100)
    assert.equal(command.scale, 1.5)
  })

  it('rejects non-positive custom piece dimensions', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2d',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'door-1',
        boardId: 'main-board',
        name: 'Door',
        x: 100,
        y: 150,
        width: 0
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'width must be positive')
  })

  it('accepts partial manual character sheet updates', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-sheet',
      command: {
        type: 'UpdateCharacterSheet',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        age: 34,
        characteristics: {
          str: 7,
          dex: null
        },
        skills: ['Pilot 1', 'Gun Combat 0'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1
          }
        ],
        credits: 1200
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const {command} = result.value
    assert.equal(command.type, 'UpdateCharacterSheet')
    if (command.type !== 'UpdateCharacterSheet') return
    assert.equal(command.age, 34)
    assert.deepEqual(command.characteristics, {str: 7, dex: null})
    assert.deepEqual(command.skills, ['Pilot 1', 'Gun Combat 0'])
    assert.deepEqual(command.equipment, [
      {name: 'Vacc suit', quantity: 1, notes: ''}
    ])
    assert.equal(command.credits, 1200)
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

  it('accepts board selection commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-4',
      command: {
        type: 'SelectBoard',
        gameId: 'game-1',
        actorId: 'user-1',
        boardId: 'main-board'
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const {command} = result.value
    assert.equal(command.type, 'SelectBoard')
    if (command.type !== 'SelectBoard') return
    assert.equal(command.boardId, 'main-board')
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
