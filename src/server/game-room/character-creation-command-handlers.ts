import type { GameCommand } from '../../shared/commands'
import type { CommandTypeForHandlerDomain } from '../../shared/command-metadata'
import type { GameEvent } from '../../shared/events'
import { asEventId } from '../../shared/ids'
import type { CommandError } from '../../shared/protocol'
import { err, type Result } from '../../shared/result'
import { deriveBasicTrainingCommandEvents } from './character-creation/basic-training'
import { commandError, type CommandContext } from './command-helpers'
import { deriveCareerEntryCommandEvents } from './character-creation/career-entry'
import { deriveHomeworldCommandEvents } from './character-creation/homeworld'
import { deriveSkillCommandEvents } from './character-creation/term-skills'
import { deriveLifecycleCommandEvents } from './character-creation/lifecycle'
import { deriveMusteringCommandEvents } from './character-creation/mustering'
import { derivePromotionCommandEvents } from './character-creation/promotion'
import { deriveSurvivalCommandEvents } from './character-creation/survival'
import { deriveDeprecatedCharacterCreationCommandEvents } from './character-creation/legacy'
import {
  deriveCreationFinalizationCommandEvents,
  deriveCreationSetupCommandEvents
} from './character-creation/setup'

type CharacterCreationCommand = Extract<
  GameCommand,
  {
    type:
      | CommandTypeForHandlerDomain<'characterCreation'>
      | 'AdvanceCharacterCreation'
  }
>

export { GENERIC_CHARACTER_CREATION_DEPRECATED_MESSAGE } from './character-creation/legacy'

export const deriveCharacterCreationCommandEvents = (
  command: CharacterCreationCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const rollEventId = asEventId(`${command.gameId}:${context.nextSeq}`)

  switch (command.type) {
    case 'StartCharacterCreation':
    case 'RollCharacterCreationCharacteristic':
      return deriveCreationSetupCommandEvents(command, context, rollEventId)

    case 'FinalizeCharacterCreation':
    case 'CompleteCharacterCreation':
      return deriveCreationFinalizationCommandEvents(command, context)

    case 'SetCharacterCreationHomeworld':
    case 'SelectCharacterCreationBackgroundSkill':
    case 'ResolveCharacterCreationCascadeSkill':
    case 'CompleteCharacterCreationHomeworld':
      return deriveHomeworldCommandEvents(command, context)

    case 'CompleteCharacterCreationBasicTraining':
      return deriveBasicTrainingCommandEvents(command, context)

    case 'ResolveCharacterCreationQualification':
    case 'ResolveCharacterCreationDraft':
    case 'EnterCharacterCreationDrifter':
    case 'StartCharacterCareerTerm':
      return deriveCareerEntryCommandEvents(command, context, rollEventId)

    case 'ResolveCharacterCreationSurvival':
      return deriveSurvivalCommandEvents(command, context, rollEventId)

    case 'ResolveCharacterCreationCommission':
    case 'SkipCharacterCreationCommission':
    case 'ResolveCharacterCreationAdvancement':
    case 'SkipCharacterCreationAdvancement':
      return derivePromotionCommandEvents(command, context, rollEventId)

    case 'ResolveCharacterCreationAging':
    case 'ResolveCharacterCreationAgingLosses':
    case 'DecideCharacterCreationAnagathics':
    case 'ResolveCharacterCreationReenlistment':
    case 'ReenlistCharacterCreationCareer':
    case 'LeaveCharacterCreationCareer':
      return deriveLifecycleCommandEvents(command, context, rollEventId)

    case 'RollCharacterCreationTermSkill':
    case 'CompleteCharacterCreationSkills':
    case 'ResolveCharacterCreationTermCascadeSkill':
      return deriveSkillCommandEvents(command, context, rollEventId)

    case 'RollCharacterCreationMusteringBenefit':
    case 'ContinueCharacterCreationAfterMustering':
    case 'CompleteCharacterCreationMustering':
      return deriveMusteringCommandEvents(command, context, rollEventId)

    case 'ResolveCharacterCreationMishap':
    case 'ResolveCharacterCreationInjury':
    case 'ConfirmCharacterCreationDeath':
      return deriveSurvivalCommandEvents(command, context, rollEventId)

    case 'AdvanceCharacterCreation':
      return deriveDeprecatedCharacterCreationCommandEvents(command, context)

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled character creation command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
