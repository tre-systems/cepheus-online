import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CharacterId, GameId, UserId } from '../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../shared/state'
import { deriveCharacterCreationActionPlan } from './character-creation-actions'

const identity = {
  gameId: 'demo-room' as GameId,
  actorId: 'local-user' as UserId
}

const creation = (
  status: CharacterCreationProjection['state']['status'],
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: {
    status,
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  ...overrides
})

const character = (
  characterCreation: CharacterCreationProjection | null
): CharacterState => ({
  id: 'mae' as CharacterId,
  ownerId: identity.actorId,
  type: 'PLAYER',
  name: 'Mae',
  active: true,
  notes: '',
  age: 30,
  characteristics: {
    str: 7,
    dex: 7,
    end: 7,
    int: 7,
    edu: 7,
    soc: 7
  },
  skills: ['Gun Combat-0'],
  equipment: [],
  credits: 0,
  creation: characterCreation
})

describe('character creation actions', () => {
  it('starts creation for an existing character without creation state', () => {
    const plan = deriveCharacterCreationActionPlan(identity, character(null))

    assert.equal(plan?.status, 'Not started')
    assert.equal(plan?.actions[0]?.label, 'Start creation')
    assert.equal(plan?.actions[0]?.command?.type, 'StartCharacterCreation')
  })

  it('starts a career term before selecting a career', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('CAREER_SELECTION'))
    )

    assert.equal(plan?.status, 'Career Selection')
    assert.equal(plan?.actions[0]?.command?.type, 'StartCharacterCareerTerm')
  })

  it('selects a career after a term has been started', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('CAREER_SELECTION', {
          terms: [
            {
              career: 'Scout',
              skills: [],
              skillsAndTraining: [],
              benefits: [],
              complete: false,
              canReenlist: false,
              completedBasicTraining: false,
              musteringOut: false,
              anagathics: false
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(plan?.actions[0]?.command?.type, 'AdvanceCharacterCreation')
    const command = plan?.actions[0]?.command
    if (command?.type !== 'AdvanceCharacterCreation') return
    assert.deepEqual(command.creationEvent, {
      type: 'SELECT_CAREER',
      isNewCareer: true
    })
  })

  it('offers a complete happy path from basic training to playable', () => {
    const expectations = [
      ['BASIC_TRAINING', 'COMPLETE_BASIC_TRAINING'],
      ['SURVIVAL', 'SURVIVAL_PASSED'],
      ['ADVANCEMENT', 'COMPLETE_ADVANCEMENT'],
      ['SKILLS_TRAINING', 'COMPLETE_SKILLS'],
      ['AGING', 'COMPLETE_AGING'],
      ['REENLISTMENT', 'LEAVE_CAREER'],
      ['MUSTERING_OUT', 'FINISH_MUSTERING'],
      ['ACTIVE', 'CREATION_COMPLETE']
    ] as const

    for (const [status, eventType] of expectations) {
      const plan = deriveCharacterCreationActionPlan(
        identity,
        character(creation(status))
      )
      const command = plan?.actions[0]?.command
      assert.equal(command?.type, 'AdvanceCharacterCreation')
      if (command?.type !== 'AdvanceCharacterCreation') continue
      assert.equal(command.creationEvent.type, eventType)
    }
  })

  it('has no action once creation is playable', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('PLAYABLE', { creationComplete: true }))
    )

    assert.equal(plan?.status, 'Playable')
    assert.deepEqual(plan?.actions, [])
  })
})
