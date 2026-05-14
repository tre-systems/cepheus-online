import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId, asUserId } from '../../../shared/ids'
import type { DiceCommand } from '../core/command-router'
import { createDiceCommandWiring } from './commands'

const gameId = asGameId('room-1')
const actorId = asUserId('actor-1')

describe('dice command wiring', () => {
  it('maps the roll button and expression input to a dice command', async () => {
    const rollButton = new EventTarget()
    const diceExpression = { value: ' 3d6 ' }
    const postedCommands: DiceCommand[] = []
    const errors: string[] = []

    createDiceCommandWiring({
      rollButton,
      diceExpression,
      getClientIdentity: () => ({ gameId, actorId }),
      postDiceCommand: async (command) => {
        postedCommands.push(command)
      },
      reportError: (message) => {
        errors.push(message)
      }
    })

    rollButton.dispatchEvent(new Event('click'))
    await Promise.resolve()

    assert.deepEqual(postedCommands, [
      {
        type: 'RollDice',
        gameId,
        actorId,
        expression: '3d6',
        reason: 'Table roll'
      }
    ])
    assert.deepEqual(errors, [])
  })

  it('uses the default dice expression and reports command failures', async () => {
    const rollButton = new EventTarget()
    const diceExpression = { value: '   ' }
    const postedCommands: DiceCommand[] = []
    const errors: string[] = []

    createDiceCommandWiring({
      rollButton,
      diceExpression,
      getClientIdentity: () => ({ gameId, actorId }),
      postDiceCommand: async (command) => {
        postedCommands.push(command)
        throw new Error('roll rejected')
      },
      reportError: (message) => {
        errors.push(message)
      }
    })

    rollButton.dispatchEvent(new Event('click'))
    await Promise.resolve()
    await Promise.resolve()

    assert.deepEqual(postedCommands, [
      {
        type: 'RollDice',
        gameId,
        actorId,
        expression: '2d6',
        reason: 'Table roll'
      }
    ])
    assert.deepEqual(errors, ['roll rejected'])
  })
})
