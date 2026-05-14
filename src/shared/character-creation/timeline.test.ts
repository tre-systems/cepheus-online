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
        name: 'commission skip',
        event: {
          type: 'CharacterCreationCommissionSkipped',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'SKIP_COMMISSION' }
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
        name: 'advancement skip',
        event: {
          type: 'CharacterCreationAdvancementSkipped',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'SKIP_ADVANCEMENT' }
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
        name: 'term cascade skill',
        event: {
          type: 'CharacterCreationTermCascadeSkillResolved',
          characterId,
          cascadeSkill: 'Gun Combat-1',
          selection: 'Slug Rifle-1',
          termSkills: ['Slug Rifle-1'],
          skillsAndTraining: ['Slug Rifle-1'],
          pendingCascadeSkills: []
        },
        expected: {
          type: 'RESOLVE_TERM_CASCADE_SKILL',
          cascadeSkill: 'Gun Combat-1',
          selection: 'Slug Rifle-1'
        }
      },
      {
        name: 'skills completed',
        event: {
          type: 'CharacterCreationSkillsCompleted',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'COMPLETE_SKILLS' }
      },
      {
        name: 'aging',
        event: {
          type: 'CharacterCreationAgingResolved',
          characterId,
          aging: {
            roll: { expression: '2d6', rolls: [3, 4], total: 7 },
            modifier: -1,
            age: 38,
            characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
          },
          state,
          creationComplete: false
        },
        expected: {
          type: 'COMPLETE_AGING',
          aging: {
            roll: { expression: '2d6', rolls: [3, 4], total: 7 },
            modifier: -1,
            age: 38,
            characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
          }
        }
      },
      {
        name: 'anagathics',
        event: {
          type: 'CharacterCreationAnagathicsDecided',
          characterId,
          useAnagathics: true,
          termIndex: 1,
          state,
          creationComplete: false
        },
        expected: {
          type: 'DECIDE_ANAGATHICS',
          useAnagathics: true,
          termIndex: 1
        }
      },
      {
        name: 'reenlistment',
        event: {
          type: 'CharacterCreationReenlistmentResolved',
          characterId,
          outcome: 'allowed',
          reenlistment: {
            ...check(true, 8),
            outcome: 'allowed'
          },
          state,
          creationComplete: false
        },
        expected: {
          type: 'RESOLVE_REENLISTMENT',
          reenlistment: {
            ...check(true, 8),
            outcome: 'allowed'
          }
        }
      },
      {
        name: 'forced reenlistment',
        event: {
          type: 'CharacterCreationCareerReenlisted',
          characterId,
          outcome: 'forced',
          career: 'Scout',
          forced: true,
          state,
          creationComplete: false
        },
        expected: { type: 'FORCED_REENLIST' }
      },
      {
        name: 'allowed reenlistment',
        event: {
          type: 'CharacterCreationCareerReenlisted',
          characterId,
          outcome: 'allowed',
          career: 'Scout',
          forced: false,
          state,
          creationComplete: false
        },
        expected: { type: 'REENLIST' }
      },
      {
        name: 'career leave',
        event: {
          type: 'CharacterCreationCareerLeft',
          characterId,
          outcome: 'allowed',
          retirement: false,
          state,
          creationComplete: false
        },
        expected: { type: 'LEAVE_CAREER' }
      },
      {
        name: 'career leave blocked',
        event: {
          type: 'CharacterCreationCareerLeft',
          characterId,
          outcome: 'blocked',
          retirement: false,
          state,
          creationComplete: false
        },
        expected: { type: 'REENLIST_BLOCKED' }
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
        name: 'continue career after mustering',
        event: {
          type: 'CharacterCreationAfterMusteringContinued',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'CONTINUE_CAREER' }
      },
      {
        name: 'mustering completed',
        event: {
          type: 'CharacterCreationMusteringCompleted',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'FINISH_MUSTERING' }
      },
      {
        name: 'mishap',
        event: {
          type: 'CharacterCreationMishapResolved',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'MISHAP_RESOLVED' }
      },
      {
        name: 'death',
        event: {
          type: 'CharacterCreationDeathConfirmed',
          characterId,
          state,
          creationComplete: false
        },
        expected: { type: 'DEATH_CONFIRMED' }
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
