import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CareerCreationEvent } from '../../shared/character-creation/types'
import { asCharacterId, asUserId } from '../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../shared/state'
import {
  deriveCharacterCreationAnagathicsDecision,
  deriveNextCharacterCreationAgingRoll
} from './character-creation-flow'
import { flowFromProjectedCharacter } from './character-creation-projection'

const characterId = asCharacterId('character-1')

const agingProjection = (
  history: CharacterCreationProjection['history'] = []
): CharacterCreationProjection => ({
  state: {
    status: 'AGING',
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [
    {
      career: 'Scout',
      skills: ['Pilot-1', 'Survival-0'],
      skillsAndTraining: ['Pilot-1', 'Survival-0'],
      benefits: [],
      complete: false,
      canReenlist: true,
      completedBasicTraining: true,
      musteringOut: false,
      anagathics: false,
      survival: 8
    }
  ],
  careers: [{ name: 'Scout', rank: 0 }],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  history
})

const termSkillEvent = (skill: string): CareerCreationEvent => ({
  type: 'ROLL_TERM_SKILL',
  termSkill: {
    career: 'Scout',
    table: 'serviceSkills',
    roll: { expression: '1d6', rolls: [1], total: 1 },
    tableRoll: 1,
    rawSkill: skill.replace(/-\d+$/, ''),
    skill,
    characteristic: null,
    pendingCascadeSkill: null
  }
})

const resolvedTermSkillHistory: CharacterCreationProjection['history'] = [
  {
    type: 'SELECT_CAREER',
    isNewCareer: true,
    qualification: {
      expression: '2d6',
      rolls: [4, 4],
      total: 8,
      characteristic: 'int',
      modifier: 1,
      target: 6,
      success: true
    }
  },
  {
    type: 'SURVIVAL_PASSED',
    canCommission: false,
    canAdvance: false,
    survival: {
      expression: '2d6',
      rolls: [4, 4],
      total: 8,
      characteristic: 'end',
      modifier: 0,
      target: 7,
      success: true
    }
  },
  termSkillEvent('Pilot-1'),
  termSkillEvent('Survival-0')
]

const character = (creation: CharacterCreationProjection): CharacterState => ({
  id: characterId,
  ownerId: asUserId('local-user'),
  type: 'PLAYER',
  name: 'Iona Vesh',
  active: true,
  notes: '',
  age: 18,
  characteristics: {
    str: 7,
    dex: 8,
    end: 7,
    int: 9,
    edu: 8,
    soc: 6
  },
  skills: [],
  equipment: [],
  credits: 0,
  creation
})

describe('character creation projection helpers', () => {
  it('keeps projected aging blocked until anagathics is explicitly decided', () => {
    const flow = flowFromProjectedCharacter(
      character(agingProjection(resolvedTermSkillHistory))
    )
    if (!flow) throw new Error('Expected projected flow')

    assert.deepEqual(deriveCharacterCreationAnagathicsDecision(flow), {
      label: 'Decide anagathics',
      reason: 'Iona Vesh Scout anagathics'
    })
    assert.equal(deriveNextCharacterCreationAgingRoll(flow), null)
  })

  it('allows projected aging after the active term has an anagathics decision', () => {
    const flow = flowFromProjectedCharacter(
      character(
        agingProjection([
          ...resolvedTermSkillHistory,
          {
            type: 'DECIDE_ANAGATHICS',
            useAnagathics: false,
            termIndex: 0
          }
        ])
      )
    )
    if (!flow) throw new Error('Expected projected flow')

    assert.equal(deriveCharacterCreationAnagathicsDecision(flow), null)
    assert.deepEqual(deriveNextCharacterCreationAgingRoll(flow), {
      label: 'Roll aging',
      reason: 'Iona Vesh aging',
      modifier: -1
    })
  })
})
