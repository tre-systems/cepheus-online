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

  it('rejects unknown message types before command handling', () => {
    const result = decodeClientMessage({
      type: 'mutateEverything'
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_message')
  })
})
