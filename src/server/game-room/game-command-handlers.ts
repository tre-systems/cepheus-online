import type { GameCommand } from '../../shared/commands'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import {
  commandError,
  type CommandContext
} from './command-helpers'

type CreateGameCommand = Extract<GameCommand, { type: 'CreateGame' }>

export const deriveGameCommandEvents = (
  command: CreateGameCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  if (context.state) {
    return err(commandError('game_exists', 'Game already exists'))
  }

  return ok([
    {
      type: 'GameCreated',
      slug: command.slug,
      name: command.name,
      ownerId: command.actorId
    }
  ])
}
