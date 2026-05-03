import type { Command } from '../../shared/commands'
import type { CharacterState } from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'

export interface CharacterCreationActionViewModel {
  key: string
  label: string
  command: Command | null
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
  command: Command,
  variant: CharacterCreationActionViewModel['variant'] = 'primary'
): CharacterCreationActionViewModel => ({
  key,
  label,
  command,
  variant
})

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
    case 'CHARACTERISTICS':
      return plan([
        action(
          'set-characteristics',
          'Confirm characteristics',
          advanceCommand(identity, character, { type: 'SET_CHARACTERISTICS' })
        )
      ])
    case 'HOMEWORLD':
      return plan([
        action(
          'complete-homeworld',
          'Confirm homeworld',
          advanceCommand(identity, character, { type: 'COMPLETE_HOMEWORLD' })
        )
      ])
    case 'CAREER_SELECTION':
      if (character.creation.terms.length === 0) {
        return plan([
          action('start-scout-term', 'Start Scout term', {
            type: 'StartCharacterCareerTerm',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id,
            career: 'Scout'
          })
        ])
      }
      return plan([
        action(
          'select-career',
          'Select career',
          advanceCommand(identity, character, {
            type: 'SELECT_CAREER',
            isNewCareer: true
          })
        )
      ])
    case 'BASIC_TRAINING':
      return plan([
        action(
          'complete-basic-training',
          'Complete basic training',
          advanceCommand(identity, character, {
            type: 'COMPLETE_BASIC_TRAINING'
          })
        )
      ])
    case 'SURVIVAL':
      return plan([
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
      ])
    case 'MISHAP':
      return plan([
        action(
          'resolve-mishap',
          'Resolve mishap',
          advanceCommand(identity, character, { type: 'MISHAP_RESOLVED' })
        ),
        action(
          'death-confirmed',
          'Confirm death',
          advanceCommand(identity, character, { type: 'DEATH_CONFIRMED' }),
          'secondary'
        )
      ])
    case 'COMMISSION':
      return plan([
        action(
          'skip-commission',
          'Skip commission',
          advanceCommand(identity, character, { type: 'SKIP_COMMISSION' })
        ),
        action(
          'complete-commission',
          'Complete commission',
          advanceCommand(identity, character, { type: 'COMPLETE_COMMISSION' }),
          'secondary'
        )
      ])
    case 'ADVANCEMENT':
      return plan([
        action(
          'complete-advancement',
          'Complete advancement',
          advanceCommand(identity, character, { type: 'COMPLETE_ADVANCEMENT' })
        ),
        action(
          'skip-advancement',
          'Skip advancement',
          advanceCommand(identity, character, { type: 'SKIP_ADVANCEMENT' }),
          'secondary'
        )
      ])
    case 'SKILLS_TRAINING':
      return plan([
        action(
          'complete-skills',
          'Complete skills',
          advanceCommand(identity, character, { type: 'COMPLETE_SKILLS' })
        )
      ])
    case 'AGING':
      return plan([
        action(
          'complete-aging',
          'Complete aging',
          advanceCommand(identity, character, { type: 'COMPLETE_AGING' })
        )
      ])
    case 'REENLISTMENT':
      return plan([
        action(
          'leave-career',
          'Leave career',
          advanceCommand(identity, character, { type: 'LEAVE_CAREER' })
        ),
        action(
          'reenlist',
          'Re-enlist',
          advanceCommand(identity, character, { type: 'REENLIST' }),
          'secondary'
        )
      ])
    case 'MUSTERING_OUT':
      return plan([
        action(
          'finish-mustering',
          'Finish mustering out',
          advanceCommand(identity, character, { type: 'FINISH_MUSTERING' })
        ),
        action(
          'continue-career',
          'Continue career',
          advanceCommand(identity, character, { type: 'CONTINUE_CAREER' }),
          'secondary'
        )
      ])
    case 'ACTIVE':
      return plan([
        action(
          'creation-complete',
          'Make playable',
          advanceCommand(identity, character, { type: 'CREATION_COMPLETE' })
        )
      ])
    case 'PLAYABLE':
      return plan([])
    case 'DECEASED':
      return {
        title: 'Creation',
        status: 'Deceased',
        summary: 'Creation ended with this character deceased.',
        actions: []
      }
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
