import { buildRollDiceCommand, type ClientIdentity } from '../../game-commands'
import type { DiceCommand } from '../core/command-router'
import { createDisposer, type Disposable } from '../core/disposable'

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
