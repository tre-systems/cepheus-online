import { buildRollDiceCommand, type ClientIdentity } from '../game-commands.js'
import type { DiceCommand } from './app-command-router.js'

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
}: DiceCommandWiringOptions): void => {
  rollButton.addEventListener('click', () => {
    postDiceCommand(
      buildRollDiceCommand({
        identity: getClientIdentity(),
        expression: diceExpression.value.trim() || '2d6',
        reason: 'Table roll'
      }) as DiceCommand
    ).catch((error) => reportError(error.message))
  })
}
