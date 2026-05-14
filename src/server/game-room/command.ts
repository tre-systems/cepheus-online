import type { GameCommand } from '../../shared/commands'
import type { GameEvent } from '../../shared/events'
import { err, type Result } from '../../shared/result'
import type { CommandError } from '../../shared/protocol'
import { deriveBoardCommandEvents } from './board-command-handlers'
import { deriveCharacterCommandEvents } from './character-command-handlers'
import { deriveCharacterCreationCommandEvents } from './character-creation-command-handlers'
import {
  canMutateCharacter,
  commandError,
  notAllowed,
  type CommandContext,
  validateExpectedSeq
} from './command-helpers'
import { deriveDiceCommandEvents } from './dice-command-handlers'
import { deriveGameCommandEvents } from './game-command-handlers'

export type { CommandContext } from './command-helpers'

export const deriveEventsForCommand = (
  command: GameCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const expectedSeq = validateExpectedSeq(command, context.currentSeq)
  if (!expectedSeq.ok) return expectedSeq
  if (
    context.state &&
    'characterId' in command &&
    command.type !== 'CreateCharacter' &&
    command.characterId !== null &&
    command.characterId !== undefined
  ) {
    const character = context.state.characters[command.characterId]
    if (
      character &&
      !canMutateCharacter(context.state, character, command.actorId)
    ) {
      return notAllowed(
        'Only the character owner or referee can change this character'
      )
    }
  }

  switch (command.type) {
    case 'CreateGame': {
      return deriveGameCommandEvents(command, context)
    }

    case 'CreateCharacter': {
      return deriveCharacterCommandEvents(command, context)
    }

    case 'UpdateCharacterSheet': {
      return deriveCharacterCommandEvents(command, context)
    }

    case 'FinalizeCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'StartCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'AdvanceCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'RollCharacterCreationCharacteristic': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'CompleteCharacterCreationBasicTraining': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'CompleteCharacterCreationHomeworld': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationQualification':
    case 'ResolveCharacterCreationDraft':
    case 'EnterCharacterCreationDrifter': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationSurvival': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationCommission':
    case 'SkipCharacterCreationCommission':
    case 'ResolveCharacterCreationAdvancement':
    case 'SkipCharacterCreationAdvancement': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'ResolveCharacterCreationAging':
    case 'ResolveCharacterCreationAgingLosses':
    case 'ResolveCharacterCreationMishap':
    case 'ConfirmCharacterCreationDeath':
    case 'DecideCharacterCreationAnagathics':
    case 'ResolveCharacterCreationReenlistment':
    case 'ReenlistCharacterCreationCareer':
    case 'LeaveCharacterCreationCareer': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'RollCharacterCreationTermSkill':
    case 'CompleteCharacterCreationSkills':
    case 'ResolveCharacterCreationTermCascadeSkill':
    case 'RollCharacterCreationMusteringBenefit':
    case 'ContinueCharacterCreationAfterMustering':
    case 'CompleteCharacterCreationMustering': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'CompleteCharacterCreation': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'SetCharacterCreationHomeworld':
    case 'SelectCharacterCreationBackgroundSkill':
    case 'ResolveCharacterCreationCascadeSkill': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'StartCharacterCareerTerm': {
      return deriveCharacterCreationCommandEvents(command, context)
    }

    case 'CreateBoard': {
      return deriveBoardCommandEvents(command, context)
    }

    case 'SelectBoard':
    case 'SetDoorOpen':
    case 'CreatePiece':
    case 'MovePiece':
    case 'SetPieceVisibility':
    case 'SetPieceFreedom': {
      return deriveBoardCommandEvents(command, context)
    }

    case 'RollDice': {
      return deriveDiceCommandEvents(command, context)
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
