import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameEvent } from '../events'
import { asCharacterId } from '../ids'
import {
  deriveCharacterCreationHistoryEvent,
  type CareerCreationCheckFact,
  type CareerCreationEvent
} from './index'

const characterId = asCharacterId('char-1')

const state = {
  status: 'SKILLS_TRAINING',
  context: {
    canCommission: false,
    canAdvance: false
  }
} as const

const check = (
  success: boolean,
  total = success ? 8 : 4
): CareerCreationCheckFact => ({
  expression: '2d6',
  rolls: success ? [4, 4] : [2, 2],
  total,
  characteristic: 'end',
  modifier: 0,
  target: 7,
  success
})

describe('character creation timeline mapping', () => {
  it('maps semantic career creation events to legacy history entries', () => {
    const cases: {
      readonly name: string
      readonly event: GameEvent
      readonly context?: { readonly canEnterDraft?: boolean }
      readonly expected: CareerCreationEvent
    }[] = [
      {
        name: 'characteristics',
        event: {
          type: 'CharacterCreationCharacteristicsCompleted',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'SET_CHARACTERISTICS' }
      },
      {
        name: 'homeworld',
        event: {
          type: 'CharacterCreationHomeworldCompleted',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'COMPLETE_HOMEWORLD' }
      },
      {
        name: 'qualification pass',
        event: {
          type: 'CharacterCreationQualificationResolved',
          characterId,
          career: 'Scout',
          passed: true,
          qualification: check(true),
          previousCareerCount: 0,
          failedQualificationOptions: [],
          state,
          creationComplete: false
        },
        expected: {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          qualification: check(true)
        }
      },
      {
        name: 'qualification fail',
        event: {
          type: 'CharacterCreationQualificationResolved',
          characterId,
          career: 'Scout',
          passed: false,
          qualification: check(false),
          previousCareerCount: 0,
          failedQualificationOptions: ['Drifter', 'Draft'],
          state,
          creationComplete: false
        },
        context: { canEnterDraft: true },
        expected: {
          type: 'SELECT_CAREER',
          isNewCareer: false,
          qualification: check(false),
          failedQualificationOptions: ['Drifter', 'Draft'],
          canEnterDraft: true
        }
      },
      {
        name: 'draft',
        event: {
          type: 'CharacterCreationDraftResolved',
          characterId,
          draft: {
            roll: { expression: '1d6', rolls: [3], total: 3 },
            tableRoll: 3,
            acceptedCareer: 'Navy'
          },
          state,
          creationComplete: false
        },
        expected: {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          drafted: true
        }
      },
      {
        name: 'survival pass',
        event: {
          type: 'CharacterCreationSurvivalResolved',
          characterId,
          passed: true,
          survival: check(true),
          canCommission: false,
          canAdvance: true,
          state,
          creationComplete: false
        },
        expected: {
          type: 'SURVIVAL_PASSED',
          canCommission: false,
          canAdvance: true,
          survival: check(true)
        }
      },
      {
        name: 'survival fail',
        event: {
          type: 'CharacterCreationSurvivalResolved',
          characterId,
          passed: false,
          survival: check(false),
          canCommission: false,
          canAdvance: false,
          state,
          creationComplete: false
        },
        expected: { type: 'SURVIVAL_FAILED', survival: check(false) }
      },
      {
        name: 'commission',
        event: {
          type: 'CharacterCreationCommissionResolved',
          characterId,
          passed: true,
          commission: check(true),
          state,
          creationComplete: false
        },
        expected: { type: 'COMPLETE_COMMISSION', commission: check(true) }
      },
      {
        name: 'advancement',
        event: {
          type: 'CharacterCreationAdvancementResolved',
          characterId,
          passed: true,
          advancement: check(true),
          rank: {
            career: 'Scout',
            previousRank: 0,
            newRank: 1,
            title: 'Courier',
            bonusSkill: 'Pilot-0'
          },
          state,
          creationComplete: false
        },
        expected: {
          type: 'COMPLETE_ADVANCEMENT',
          advancement: check(true),
          rank: {
            career: 'Scout',
            previousRank: 0,
            newRank: 1,
            title: 'Courier',
            bonusSkill: 'Pilot-0'
          }
        }
      },
      {
        name: 'term skill',
        event: {
          type: 'CharacterCreationTermSkillRolled',
          characterId,
          termSkill: {
            career: 'Scout',
            table: 'serviceSkills',
            roll: { expression: '1d6', rolls: [2], total: 2 },
            tableRoll: 2,
            rawSkill: 'Pilot',
            skill: 'Pilot-1',
            characteristic: null,
            pendingCascadeSkill: null
          },
          termSkills: ['Pilot-1'],
          skillsAndTraining: ['Pilot-1'],
          pendingCascadeSkills: [],
          state,
          creationComplete: false
        },
        expected: {
          type: 'ROLL_TERM_SKILL',
          termSkill: {
            career: 'Scout',
            table: 'serviceSkills',
            roll: { expression: '1d6', rolls: [2], total: 2 },
            tableRoll: 2,
            rawSkill: 'Pilot',
            skill: 'Pilot-1',
            characteristic: null,
            pendingCascadeSkill: null
          }
        }
      },
      {
        name: 'mustering benefit',
        event: {
          type: 'CharacterCreationMusteringBenefitRolled',
          characterId,
          musteringBenefit: {
            career: 'Scout',
            kind: 'cash',
            roll: { expression: '2d6', rolls: [4, 5], total: 9 },
            modifier: 1,
            tableRoll: 10,
            value: '10000',
            credits: 10000
          },
          state,
          creationComplete: false
        },
        expected: {
          type: 'FINISH_MUSTERING',
          musteringBenefit: {
            career: 'Scout',
            kind: 'cash',
            roll: { expression: '2d6', rolls: [4, 5], total: 9 },
            modifier: 1,
            tableRoll: 10,
            value: '10000',
            credits: 10000
          }
        }
      },
      {
        name: 'completion',
        event: {
          type: 'CharacterCreationCompleted',
          characterId,
          state: {
            status: 'PLAYABLE',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          creationComplete: true
        },
        expected: { type: 'CREATION_COMPLETE' }
      }
    ]

    for (const { event, expected, context } of cases) {
      assert.deepEqual(
        deriveCharacterCreationHistoryEvent(event, context),
        expected
      )
    }
  })

  it('returns null for semantic events that do not append legacy history', () => {
    assert.equal(
      deriveCharacterCreationHistoryEvent({
        type: 'CharacterCreationFinalized',
        characterId,
        notes: '',
        age: 34,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Pilot-1'],
        equipment: [],
        credits: 1200
      }),
      null
    )
  })
})
