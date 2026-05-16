import type { GameCommand } from '../../shared/commands'
import {
  DEFAULT_RULESET_ID,
  resolveRulesetReference
} from '../../shared/character-creation/cepheus-srd-ruleset'
import type { CommandTypeForHandlerDomain } from '../../shared/command-metadata'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import { commandError, type CommandContext } from './command-helpers'

type GameOnlyCommand = Extract<
  GameCommand,
  { type: CommandTypeForHandlerDomain<'game'> }
>

export const deriveGameCommandEvents = (
  command: GameOnlyCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  if (context.state) {
    return err(commandError('game_exists', 'Game already exists'))
  }
  const rulesetId = command.rulesetId ?? DEFAULT_RULESET_ID
  const ruleset = resolveRulesetReference(rulesetId)
  if (!ruleset.ok) {
    return err(commandError('invalid_command', ruleset.error.join('; ')))
  }

  return ok([
    {
      type: 'GameCreated',
      slug: command.slug,
      name: command.name,
      ownerId: command.actorId,
      rulesetId
    }
  ])
}
