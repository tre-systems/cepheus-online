import {
  buildRollDiceCommand,
  type ClientIdentity
} from '../../game-commands.js'
import type { DiceCommand } from '../core/command-router.js'
import { createDisposer, type Disposable } from '../core/disposable.js'

export interface DiceCommandWiringOptions {
  rollButton: EventTarget
  diceExpression: Pick<HTMLInputElement, 'value'>
  getClientIdentity: () => ClientIdentity
  postDiceCommand: (command: DiceCommand) => Promise<unknown>
  reportError: (message: string) => void
}

export const createDiceCommandWiring = ({
  rollButton,
  diceExpression,
  getClientIdentity,
  postDiceCommand,
  reportError
}: DiceCommandWiringOptions): Disposable => {
  const disposer = createDisposer()
  disposer.listen(rollButton, 'click', () => {
    postDiceCommand(
      buildRollDiceCommand({
        identity: getClientIdentity(),
        expression: diceExpression.value.trim() || '2d6',
        reason: 'Table roll'
      }) as DiceCommand
    ).catch((error) => reportError(error.message))
  })

  return disposer
}
