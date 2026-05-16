import type {
  CareerCreationActionKey,
  CareerCreationPendingDecisionKey,
  CareerCreationStatus
} from '../../shared/characterCreation'
import {
  deriveCareerCreationActionContext,
  deriveLegalCareerCreationActionKeysForProjection
} from '../../shared/characterCreation'
import type { CepheusRuleset } from '../../shared/character-creation/cepheus-srd-ruleset'
import type { CharacterId } from '../../shared/ids'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import type {
  CharacterCreationProjection,
  CharacterState,
  GameState
} from '../../shared/state'

export interface CharacterCreationCommandContext {
  state: GameState
  character: CharacterState & { creation: CharacterCreationProjection }
  creation: CharacterCreationProjection
}

const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

const hasCharacterCreation = (
  character: CharacterState
): character is CharacterState & { creation: CharacterCreationProjection } =>
  character.creation !== null

export const loadCharacterCreationCommandContext = (
  state: GameState | null,
  characterId: CharacterId
): Result<CharacterCreationCommandContext, CommandError> => {
  if (!state) {
    return err(commandError('game_not_found', 'Game has not been created'))
  }

  const character = state.characters[characterId]
  if (!character) {
    return err(commandError('missing_entity', 'Character does not exist'))
  }
  if (!hasCharacterCreation(character)) {
    return err(
      commandError('missing_entity', 'Character creation has not been started')
    )
  }

  return ok({ state, character, creation: character.creation })
}

export const requireCharacterCreationStatus = (
  creation: CharacterCreationProjection,
  status: CareerCreationStatus,
  commandName: string
): Result<void, CommandError> => {
  if (creation.state.status !== status) {
    return err(
      commandError(
        'invalid_command',
        `${commandName} is not valid from ${creation.state.status}`
      )
    )
  }

  return ok(undefined)
}

export const requireLegalCharacterCreationAction = (
  creation: CharacterCreationProjection,
  actionKeys: readonly CareerCreationActionKey[],
  blockedMessage: string,
  ruleset: CepheusRuleset
): Result<void, CommandError> => {
  const legalActions = deriveLegalCareerCreationActionKeysForProjection(
    creation,
    ruleset
  )
  if (!actionKeys.some((actionKey) => legalActions.includes(actionKey))) {
    return err(commandError('invalid_command', blockedMessage))
  }

  return ok(undefined)
}

export const requireNoBlockingCharacterCreationDecisions = (
  creation: CharacterCreationProjection,
  allowedDecisionKey: CareerCreationPendingDecisionKey,
  blockedMessage: string,
  ruleset: CepheusRuleset
): Result<void, CommandError> => {
  const actionContext = deriveCareerCreationActionContext(creation, ruleset)
  const blockingDecision = actionContext.pendingDecisions?.find(
    (decision) => decision.key !== allowedDecisionKey
  )
  if (blockingDecision) {
    return err(commandError('invalid_command', blockedMessage))
  }

  return ok(undefined)
}

export const requireNoPendingCharacterCreationDecisions = (
  creation: CharacterCreationProjection,
  blockedMessage: string,
  ruleset: CepheusRuleset
): Result<void, CommandError> => {
  const actionContext = deriveCareerCreationActionContext(creation, ruleset)
  if ((actionContext.pendingDecisions?.length ?? 0) > 0) {
    return err(commandError('invalid_command', blockedMessage))
  }

  return ok(undefined)
}
