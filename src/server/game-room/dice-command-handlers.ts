import type { GameCommand } from '../../shared/commands'
import { rollDiceExpression } from '../../shared/dice'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { deriveEventRng } from '../../shared/prng'
import { err, ok, type Result } from '../../shared/result'
import {
  commandError,
  type CommandContext,
  requireGame
} from './command-helpers'

type RollDiceCommand = Extract<GameCommand, { type: 'RollDice' }>

export const deriveDiceCommandEvents = (
  command: RollDiceCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const state = requireGame(context.state)
  if (!state.ok) return state

  const rolled = rollDiceExpression(
    command.expression,
    deriveEventRng(context.gameSeed, context.nextSeq)
  )
  if (!rolled.ok) {
    return err(commandError('invalid_command', rolled.error))
  }

  return ok([
    {
      type: 'DiceRolled',
      expression: rolled.value.expression,
      reason: command.reason,
      total: rolled.value.total,
      rolls: rolled.value.rolls
    }
  ])
}
