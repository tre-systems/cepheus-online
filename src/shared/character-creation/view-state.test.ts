import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asEventId, asUserId } from '../ids'
import type { CharacterCreationProjection, CharacterState } from '../state'
import { createCareerCreationState } from './state-machine'
import type { CareerTerm } from './types'
import {
  deriveCharacterCreationProjectionReadModel,
  deriveCharacterCreationReadModel
} from './view-state'

const creationContext = {
  canCommission: false,
  canAdvance: false
}

const projection = (
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: createCareerCreationState('HOMEWORLD', creationContext),
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  history: [],
  ...overrides
})

const character = (
  creation: CharacterCreationProjection | null
): CharacterState => ({
  id: asCharacterId('traveller-1'),
  ownerId: asUserId('owner-1'),
  type: 'PLAYER',
  name: 'Iona Vesh',
  active: true,
  notes: '',
  age: 22,
  characteristics: {
    str: 7,
    dex: null,
    end: 8,
    int: null,
    edu: 9,
    soc: null
  },
  skills: ['Admin-0'],
  equipment: [{ name: 'Blade', quantity: 1, notes: 'Issued' }],
  credits: 1000,
  creation
})

const completedTerm = (overrides: Partial<CareerTerm> = {}): CareerTerm => ({
  career: 'Scout',
  skills: ['Pilot-1'],
  skillsAndTraining: ['Pilot-1'],
  benefits: [],
  complete: true,
  canReenlist: true,
  completedBasicTraining: true,
  musteringOut: false,
  anagathics: false,
  survival: 8,
  reEnlistment: 7,
  ...overrides
})

describe('character creation shared view state', () => {
  it('derives canonical projection state, pending decisions, and legal actions', () => {
    const projected = projection({
      backgroundSkills: ['Admin-0'],
      backgroundSkillAllowance: 2,
      timeline: [
        {
          eventId: asEventId('event-1'),
          seq: 1,
          createdAt: '2026-05-14T10:00:00.000Z',
          eventType: 'CharacterCreationHomeworldSet'
        }
      ],
      history: [{ type: 'SET_CHARACTERISTICS' }]
    })
    const readModel = deriveCharacterCreationProjectionReadModel(projected)

    assert.equal(readModel.status, 'HOMEWORLD')
    assert.equal(readModel.statusLabel, 'Homeworld')
    assert.equal(readModel.step, 'homeworld')
    assert.equal(readModel.isActive, true)
    assert.equal(readModel.creationComplete, false)
    assert.equal(readModel.timelineCount, 1)
    assert.deepEqual(readModel.timeline, [
      {
        eventId: asEventId('event-1'),
        seq: 1,
        createdAt: '2026-05-14T10:00:00.000Z',
        eventType: 'CharacterCreationHomeworldSet'
      }
    ])
    assert.deepEqual(readModel.pendingDecisions, [])
    assert.deepEqual(
      readModel.actionPlan.legalActions.map((action) => action.key),
      []
    )
    assert.deepEqual(readModel.actionPlan, {
      status: 'HOMEWORLD',
      pendingDecisions: [],
      legalActions: []
    })
  })

  it('uses a materialized projection action plan when one is present', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        actionPlan: {
          status: 'HOMEWORLD',
          pendingDecisions: [],
          legalActions: [
            {
              key: 'completeHomeworld',
              status: 'HOMEWORLD',
              commandTypes: ['CompleteCharacterCreationHomeworld']
            }
          ]
        }
      })
    )

    assert.deepEqual(
      readModel.actionPlan.legalActions.map((action) => action.key),
      ['completeHomeworld']
    )
  })

  it('maps active creation state to the review step', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        state: createCareerCreationState('ACTIVE', creationContext)
      })
    )

    assert.equal(readModel.step, 'review')
  })

  it('derives cascade choices through the projection read model', () => {
    const cascadeSkillChoices = [
      {
        cascadeSkill: 'Gun Combat-0',
        label: 'Gun Combat',
        level: 0,
        options: [
          { value: 'Archery-0', label: 'Archery', cascade: false },
          { value: 'Energy Pistol-0', label: 'Energy Pistol', cascade: false },
          { value: 'Energy Rifle-0', label: 'Energy Rifle', cascade: false },
          { value: 'Shotgun-0', label: 'Shotgun', cascade: false },
          { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false },
          { value: 'Slug Rifle-0', label: 'Slug Rifle', cascade: false }
        ]
      }
    ]
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        pendingCascadeSkills: ['Gun Combat-0'],
        actionPlan: {
          status: 'HOMEWORLD',
          pendingDecisions: [{ key: 'cascadeSkillResolution' }],
          legalActions: [],
          cascadeSkillChoices
        }
      })
    )

    assert.deepEqual(
      readModel.actionPlan.cascadeSkillChoices,
      cascadeSkillChoices
    )
  })

  it('derives completed terms from semantic facts without legacy history', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        history: [],
        terms: [
          completedTerm({
            survival: 3,
            reEnlistment: 2,
            skillsAndTraining: ['Comms-0'],
            facts: {
              qualification: {
                career: 'Scout',
                passed: true,
                previousCareerCount: 0,
                failedQualificationOptions: ['Drifter'],
                qualification: {
                  expression: '2d6',
                  rolls: [4, 5],
                  total: 9,
                  characteristic: 'int',
                  modifier: 1,
                  target: 6,
                  success: true
                }
              },
              survival: {
                passed: true,
                canCommission: false,
                canAdvance: true,
                survival: {
                  expression: '2d6',
                  rolls: [5, 4],
                  total: 9,
                  characteristic: 'end',
                  modifier: 1,
                  target: 7,
                  success: true
                }
              },
              advancement: {
                skipped: false,
                passed: true,
                advancement: {
                  expression: '2d6',
                  rolls: [6, 4],
                  total: 10,
                  characteristic: 'edu',
                  modifier: 1,
                  target: 8,
                  success: true
                },
                rank: {
                  career: 'Scout',
                  previousRank: 0,
                  newRank: 1,
                  title: 'Courier',
                  bonusSkill: 'Pilot-1'
                }
              },
              anagathicsDecision: {
                useAnagathics: true,
                termIndex: 0,
                cost: 7500,
                costRoll: {
                  expression: '1d6',
                  rolls: [3],
                  total: 3
                }
              },
              termSkillRolls: [
                {
                  career: 'Scout',
                  table: 'serviceSkills',
                  roll: {
                    expression: '1d6',
                    rolls: [3],
                    total: 3
                  },
                  tableRoll: 3,
                  rawSkill: 'Pilot-1',
                  skill: 'Pilot-1',
                  characteristic: null,
                  pendingCascadeSkill: null
                }
              ],
              reenlistment: {
                outcome: 'allowed',
                reenlistment: {
                  expression: '2d6',
                  rolls: [4, 4],
                  total: 8,
                  characteristic: null,
                  modifier: 0,
                  target: 6,
                  success: true,
                  outcome: 'allowed'
                }
              }
            }
          })
        ]
      })
    )

    assert.deepEqual(readModel.completedTerms, [
      {
        career: 'Scout',
        drafted: false,
        anagathics: true,
        anagathicsCost: 7500,
        anagathicsCostRoll: 3,
        careerLifecycle: null,
        age: null,
        rank: 1,
        rankTitle: 'Courier',
        rankBonusSkill: 'Pilot-1',
        qualificationRoll: 9,
        survivalRoll: 9,
        survivalPassed: true,
        canCommission: false,
        canAdvance: true,
        commissionRoll: null,
        commissionPassed: null,
        advancementRoll: 10,
        advancementPassed: true,
        termSkillRolls: [
          {
            table: 'serviceSkills',
            roll: 3,
            skill: 'Pilot-1'
          }
        ],
        agingRoll: null,
        agingMessage: null,
        benefitForfeiture: null,
        reenlistmentRoll: 8,
        reenlistmentOutcome: 'allowed',
        legacyProjection: false
      }
    ])
  })

  it('derives legacy aggregate completed terms only when semantic facts are absent', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        terms: [
          completedTerm({
            facts: undefined,
            survival: 5,
            advancement: 9,
            reEnlistment: 4,
            canReenlist: false,
            skillsAndTraining: ['Comms-0']
          })
        ]
      })
    )

    assert.deepEqual(readModel.completedTerms, [
      {
        career: 'Scout',
        drafted: false,
        anagathics: false,
        anagathicsCost: null,
        anagathicsCostRoll: null,
        careerLifecycle: null,
        age: null,
        rank: null,
        rankTitle: null,
        rankBonusSkill: null,
        qualificationRoll: null,
        survivalRoll: 5,
        survivalPassed: true,
        canCommission: false,
        commissionRoll: null,
        commissionPassed: null,
        canAdvance: false,
        advancementRoll: 9,
        advancementPassed: null,
        termSkillRolls: [
          {
            table: 'serviceSkills',
            roll: 0,
            skill: 'Comms-0'
          }
        ],
        agingRoll: null,
        agingMessage: null,
        benefitForfeiture: null,
        reenlistmentRoll: 4,
        reenlistmentOutcome: 'blocked',
        legacyProjection: true
      }
    ])
  })

  it('derives compact follower state from timeline and semantic term facts', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        state: createCareerCreationState('MUSTERING_OUT', creationContext),
        timeline: [
          {
            eventId: asEventId('event-1'),
            seq: 11,
            createdAt: '2026-05-14T10:00:00.000Z',
            eventType: 'CharacterCreationSurvivalResolved',
            rollEventId: asEventId('roll-1')
          },
          {
            eventId: asEventId('event-2'),
            seq: 12,
            createdAt: '2026-05-14T10:00:04.000Z',
            eventType: 'CharacterCreationMusteringBenefitRolled',
            rollEventId: asEventId('roll-2')
          }
        ],
        terms: [
          completedTerm({
            facts: {
              survival: {
                passed: true,
                canCommission: false,
                canAdvance: true,
                survival: {
                  expression: '2d6',
                  rolls: [5, 4],
                  total: 9,
                  characteristic: 'end',
                  modifier: 1,
                  target: 7,
                  success: true
                }
              },
              advancement: {
                skipped: false,
                passed: true,
                advancement: {
                  expression: '2d6',
                  rolls: [6, 4],
                  total: 10,
                  characteristic: 'edu',
                  modifier: 1,
                  target: 8,
                  success: true
                },
                rank: {
                  career: 'Scout',
                  previousRank: 0,
                  newRank: 1,
                  title: 'Courier',
                  bonusSkill: 'Pilot-1'
                }
              },
              termSkillRolls: [
                {
                  career: 'Scout',
                  table: 'serviceSkills',
                  roll: {
                    expression: '1d6',
                    rolls: [3],
                    total: 3
                  },
                  tableRoll: 3,
                  rawSkill: 'Pilot-1',
                  skill: 'Pilot-1',
                  characteristic: null,
                  pendingCascadeSkill: null
                }
              ],
              musteringBenefits: [
                {
                  career: 'Scout',
                  kind: 'cash',
                  roll: {
                    expression: '1d6',
                    rolls: [4],
                    total: 4
                  },
                  modifier: 0,
                  tableRoll: 4,
                  value: '20000',
                  credits: 20000
                }
              ]
            }
          })
        ]
      })
    )

    assert.deepEqual(readModel.follower, {
      statusLabel: 'Mustering Out',
      progressLabel: 'Mustering Out; term 1: Scout',
      latestEvent: {
        eventType: 'CharacterCreationMusteringBenefitRolled',
        seq: 12,
        rollEventId: asEventId('roll-2')
      },
      activeCareer: 'Scout',
      term: {
        termNumber: 1,
        career: 'Scout',
        status: 'completed',
        survivalPassed: true,
        rankTitle: 'Courier',
        skillCount: 1,
        benefitCount: 1,
        legacyProjection: false
      },
      creationComplete: false,
      isPlayable: false,
      isDeceased: false
    })
  })

  it('derives sheet preview and progress counters from a character', () => {
    const readModel = deriveCharacterCreationReadModel(
      character(
        projection({
          state: createCareerCreationState('SKILLS_TRAINING', creationContext),
          terms: [
            {
              career: 'Scout',
              skills: ['Pilot-1'],
              skillsAndTraining: ['Pilot-1'],
              benefits: [],
              complete: false,
              canReenlist: false,
              completedBasicTraining: true,
              musteringOut: false,
              anagathics: false,
              survival: 8
            }
          ]
        })
      )
    )

    if (!readModel) throw new Error('Expected character creation read model')

    assert.equal(readModel.characterId, asCharacterId('traveller-1'))
    assert.equal(readModel.name, 'Iona Vesh')
    assert.equal(readModel.ownerId, asUserId('owner-1'))
    assert.equal(readModel.rolledCharacteristicCount, 3)
    assert.equal(readModel.termCount, 1)
    assert.equal(readModel.activeTerm?.career, 'Scout')
    assert.deepEqual(readModel.sheet, {
      age: 22,
      characteristics: {
        str: 7,
        dex: null,
        end: 8,
        int: null,
        edu: 9,
        soc: null
      },
      skills: ['Admin-0'],
      equipment: [{ name: 'Blade', quantity: 1, notes: 'Issued' }],
      credits: 1000
    })
  })
})
