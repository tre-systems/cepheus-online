import {
  deriveCareerCreationActionContext,
  deriveLegalCareerCreationActionKeys
} from '../../shared/character-creation/legal-actions.js'
import type { CareerCreationActionKey } from '../../shared/character-creation/types.js'
import type { Command, GameCommand } from '../../shared/commands'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'

export interface CharacterCreationActionViewModel {
  key: string
  label: string
  command: GameCommand | null
  variant: 'primary' | 'secondary'
}

export interface CharacterCreationActionPlan {
  title: string
  status: string
  summary: string
  actions: CharacterCreationActionViewModel[]
}

const statusLabel = (status: string): string =>
  status
    .toLowerCase()
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')

const advanceCommand = (
  identity: ClientIdentity,
  character: CharacterState,
  creationEvent: Extract<
    Command,
    { type: 'AdvanceCharacterCreation' }
  >['creationEvent']
): Command => ({
  type: 'AdvanceCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId: character.id,
  creationEvent
})

const action = (
  key: string,
  label: string,
  command: GameCommand,
  variant: CharacterCreationActionViewModel['variant'] = 'primary'
): CharacterCreationActionViewModel => ({
  key,
  label,
  command,
  variant
})

const actionsForLegalKey = (
  key: CareerCreationActionKey,
  identity: ClientIdentity,
  character: CharacterState
): CharacterCreationActionViewModel[] => {
  switch (key) {
    case 'setCharacteristics':
      return [
        action(
          'set-characteristics',
          'Confirm characteristics',
          advanceCommand(identity, character, { type: 'SET_CHARACTERISTICS' })
        )
      ]
    case 'completeHomeworld':
      return [
        action('complete-homeworld', 'Confirm homeworld', {
          type: 'CompleteCharacterCreationHomeworld',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'selectCareer':
      if (character.creation?.terms.length === 0) {
        return [
          action('start-scout-term', 'Start Scout term', {
            type: 'StartCharacterCareerTerm',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id,
            career: 'Scout'
          })
        ]
      }
      return [
        action(
          'select-career',
          'Select career',
          advanceCommand(identity, character, {
            type: 'SELECT_CAREER',
            isNewCareer: true
          })
        )
      ]
    case 'completeBasicTraining':
      return [
        action('complete-basic-training', 'Complete basic training', {
          type: 'CompleteCharacterCreationBasicTraining',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'rollSurvival':
      return [
        action(
          'survival-passed',
          'Pass survival',
          advanceCommand(identity, character, {
            type: 'SURVIVAL_PASSED',
            canCommission: false,
            canAdvance: true
          })
        ),
        action(
          'survival-failed',
          'Fail survival',
          advanceCommand(identity, character, { type: 'SURVIVAL_FAILED' }),
          'secondary'
        )
      ]
    case 'resolveMishap':
      return [
        action(
          'resolve-mishap',
          'Resolve mishap',
          advanceCommand(identity, character, { type: 'MISHAP_RESOLVED' })
        )
      ]
    case 'confirmDeath':
      return [
        action(
          'death-confirmed',
          'Confirm death',
          advanceCommand(identity, character, { type: 'DEATH_CONFIRMED' }),
          'secondary'
        )
      ]
    case 'rollCommission':
      return [
        action(
          'complete-commission',
          'Complete commission',
          advanceCommand(identity, character, { type: 'COMPLETE_COMMISSION' }),
          'secondary'
        )
      ]
    case 'skipCommission':
      return [
        action(
          'skip-commission',
          'Skip commission',
          advanceCommand(identity, character, { type: 'SKIP_COMMISSION' })
        )
      ]
    case 'rollAdvancement':
      return [
        action(
          'complete-advancement',
          'Complete advancement',
          advanceCommand(identity, character, { type: 'COMPLETE_ADVANCEMENT' })
        )
      ]
    case 'skipAdvancement':
      return [
        action(
          'skip-advancement',
          'Skip advancement',
          advanceCommand(identity, character, { type: 'SKIP_ADVANCEMENT' }),
          'secondary'
        )
      ]
    case 'completeSkills':
      return [
        action(
          'complete-skills',
          'Complete skills',
          advanceCommand(identity, character, { type: 'COMPLETE_SKILLS' })
        )
      ]
    case 'resolveAging':
      return [
        action(
          'complete-aging',
          'Complete aging',
          advanceCommand(identity, character, { type: 'COMPLETE_AGING' })
        )
      ]
    case 'reenlist':
      return [
        action(
          'reenlist',
          'Re-enlist',
          advanceCommand(identity, character, { type: 'REENLIST' }),
          'secondary'
        )
      ]
    case 'leaveCareer':
      return [
        action(
          'leave-career',
          'Leave career',
          advanceCommand(identity, character, { type: 'LEAVE_CAREER' })
        )
      ]
    case 'continueCareer':
      return [
        action(
          'continue-career',
          'Continue career',
          advanceCommand(identity, character, { type: 'CONTINUE_CAREER' }),
          'secondary'
        )
      ]
    case 'finishMustering':
      return [
        action(
          'finish-mustering',
          'Finish mustering out',
          advanceCommand(identity, character, { type: 'FINISH_MUSTERING' })
        )
      ]
    case 'completeCreation':
      return [
        action(
          'creation-complete',
          'Make playable',
          advanceCommand(identity, character, { type: 'CREATION_COMPLETE' })
        )
      ]
    case 'rollReenlistment':
    case 'forcedReenlist':
    case 'resolveMusteringBenefit':
      return []
    default: {
      const exhaustive: never = key
      return exhaustive
    }
  }
}

const actionKeyOrder: readonly CareerCreationActionKey[] = [
  'setCharacteristics',
  'completeHomeworld',
  'selectCareer',
  'completeBasicTraining',
  'rollSurvival',
  'resolveMishap',
  'confirmDeath',
  'skipCommission',
  'rollCommission',
  'rollAdvancement',
  'skipAdvancement',
  'completeSkills',
  'resolveAging',
  'leaveCareer',
  'reenlist',
  'finishMustering',
  'continueCareer',
  'completeCreation',
  'rollReenlistment',
  'forcedReenlist',
  'resolveMusteringBenefit'
]

const deriveActions = (
  identity: ClientIdentity,
  character: CharacterState,
  creation: CharacterCreationProjection
): CharacterCreationActionViewModel[] => {
  const legalKeys = new Set(
    deriveLegalCareerCreationActionKeys(
      creation.state,
      deriveCareerCreationActionContext(creation)
    )
  )

  return actionKeyOrder
    .filter((key) => legalKeys.has(key))
    .flatMap((key) => actionsForLegalKey(key, identity, character))
}

export const deriveCharacterCreationActionPlan = (
  identity: ClientIdentity,
  character: CharacterState | null
): CharacterCreationActionPlan | null => {
  if (!character) return null

  if (!character.creation) {
    return {
      title: 'Creation',
      status: 'Not started',
      summary: 'Start the character creation lifecycle for this sheet.',
      actions: [
        action('start', 'Start creation', {
          type: 'StartCharacterCreation',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    }
  }

  const { status } = character.creation.state
  const summary = character.creation.creationComplete
    ? 'Creation is complete and the character is playable.'
    : 'Advance the server-backed character creation state.'
  const plan = (actions: CharacterCreationActionViewModel[]) => ({
    title: 'Creation',
    status: statusLabel(status),
    summary,
    actions
  })

  switch (status) {
    case 'PLAYABLE':
      return plan([])
    case 'DECEASED':
      return {
        title: 'Creation',
        status: 'Deceased',
        summary: 'Creation ended with this character deceased.',
        actions: []
      }
    case 'CHARACTERISTICS':
    case 'HOMEWORLD':
    case 'CAREER_SELECTION':
    case 'BASIC_TRAINING':
    case 'SURVIVAL':
    case 'MISHAP':
    case 'COMMISSION':
    case 'ADVANCEMENT':
    case 'SKILLS_TRAINING':
    case 'AGING':
    case 'REENLISTMENT':
    case 'MUSTERING_OUT':
    case 'ACTIVE':
      return plan(deriveActions(identity, character, character.creation))
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
