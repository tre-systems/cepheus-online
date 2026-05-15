import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  CareerCreationEvent,
  CareerTerm
} from '../../../../shared/character-creation/types'
import { asCharacterId, asUserId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import {
  deriveCharacterCreationAnagathicsDecision,
  deriveNextCharacterCreationAgingRoll,
  deriveCharacterCreationTermSkillTableActions
} from './flow'
import {
  completedTermFromProjection,
  flowFromProjectedCharacter,
  musteringBenefitsFromProjection
} from './projection'

const characterId = asCharacterId('character-1')

const factsFromHistory = (
  history: readonly CareerCreationEvent[]
): CareerTerm['facts'] => {
  const facts: NonNullable<CareerTerm['facts']> = {}

  for (const event of history) {
    switch (event.type) {
      case 'SELECT_CAREER':
        if (event.qualification) {
          facts.qualification = {
            career: 'Scout',
            passed: event.qualification.success,
            qualification: event.qualification,
            previousCareerCount: 0,
            failedQualificationOptions: event.failedQualificationOptions ?? []
          }
        }
        break
      case 'SURVIVAL_PASSED':
        if (event.survival) {
          facts.survival = {
            passed: true,
            survival: event.survival,
            canCommission: event.canCommission,
            canAdvance: event.canAdvance
          }
        }
        break
      case 'SURVIVAL_FAILED':
        if (event.survival) {
          facts.survival = {
            passed: false,
            survival: event.survival,
            canCommission: false,
            canAdvance: false
          }
        }
        break
      case 'COMPLETE_COMMISSION':
        if (event.commission) {
          facts.commission = {
            skipped: false,
            passed: event.commission.success,
            commission: event.commission
          }
        }
        break
      case 'SKIP_COMMISSION':
        facts.commission = { skipped: true }
        break
      case 'COMPLETE_ADVANCEMENT':
        if (event.advancement) {
          facts.advancement = {
            skipped: false,
            passed: event.advancement.success,
            advancement: event.advancement,
            rank: event.rank ?? null
          }
        }
        break
      case 'SKIP_ADVANCEMENT':
        facts.advancement = { skipped: true }
        break
      case 'ROLL_TERM_SKILL':
        facts.termSkillRolls = [
          ...(facts.termSkillRolls ?? []),
          event.termSkill
        ]
        break
      case 'COMPLETE_AGING':
        if (event.aging) facts.aging = event.aging
        break
      case 'DECIDE_ANAGATHICS':
        facts.anagathicsDecision = {
          useAnagathics: event.useAnagathics,
          termIndex: event.termIndex
        }
        break
      case 'RESOLVE_REENLISTMENT':
        facts.reenlistment = {
          outcome: event.reenlistment.outcome,
          reenlistment: event.reenlistment
        }
        break
      case 'FINISH_MUSTERING':
        if (event.musteringBenefit) {
          facts.musteringBenefits = [
            ...(facts.musteringBenefits ?? []),
            event.musteringBenefit
          ]
        }
        break
    }
  }

  return facts
}

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
      survival: 8,
      facts: factsFromHistory(history)
    }
  ],
  careers: [{ name: 'Scout', rank: 0 }],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  history: []
})

const termSkillEvent = (
  skill: string
): Extract<CareerCreationEvent, { type: 'ROLL_TERM_SKILL' }> => ({
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

  it('hydrates editable skills from projected term training', () => {
    const flow = flowFromProjectedCharacter(
      character(agingProjection(resolvedTermSkillHistory))
    )
    if (!flow) throw new Error('Expected projected flow')

    assert.deepEqual(flow.draft.skills, ['Pilot-1', 'Survival-0'])
  })

  it('keeps anagathics cost on completed projected terms', () => {
    assert.equal(
      completedTermFromProjection({
        ...agingProjection().terms[0],
        complete: true,
        anagathics: true,
        anagathicsCost: 20000
      }).anagathicsCost,
      20000
    )
  })

  it('hydrates completed terms from semantic facts before legacy aggregates', () => {
    assert.deepEqual(
      completedTermFromProjection({
        ...agingProjection().terms[0],
        skillsAndTraining: ['Legacy Training-0'],
        complete: true,
        survival: 2,
        advancement: 2,
        reEnlistment: 2,
        facts: {
          survival: {
            passed: true,
            canCommission: false,
            canAdvance: true,
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
          advancement: {
            skipped: false,
            passed: true,
            advancement: {
              expression: '2d6',
              rolls: [5, 5],
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
              bonusSkill: null
            }
          },
          termSkillRolls: [termSkillEvent('Pilot-1').termSkill],
          reenlistment: {
            outcome: 'allowed',
            reenlistment: {
              expression: '2d6',
              rolls: [5, 4],
              total: 9,
              characteristic: null,
              modifier: 0,
              target: 6,
              success: true,
              outcome: 'allowed'
            }
          }
        }
      }),
      {
        career: 'Scout',
        drafted: false,
        anagathics: false,
        anagathicsCost: null,
        age: null,
        rank: 1,
        qualificationRoll: null,
        survivalRoll: 8,
        survivalPassed: true,
        canCommission: false,
        commissionRoll: null,
        commissionPassed: null,
        canAdvance: true,
        advancementRoll: 10,
        advancementPassed: true,
        termSkillRolls: [
          {
            table: 'serviceSkills',
            roll: 1,
            skill: 'Pilot-1'
          }
        ],
        reenlistmentRoll: 9,
        reenlistmentOutcome: 'allowed'
      }
    )
  })

  it('starts a fresh active plan after reenlisting for another term', () => {
    const flow = flowFromProjectedCharacter(
      character({
        ...agingProjection([
          ...resolvedTermSkillHistory,
          {
            type: 'COMPLETE_AGING',
            aging: {
              roll: {
                expression: '2d6',
                rolls: [5, 5],
                total: 10
              },
              age: 22,
              modifier: 0,
              characteristicChanges: []
            }
          },
          {
            type: 'RESOLVE_REENLISTMENT',
            reenlistment: {
              expression: '2d6',
              rolls: [4, 4],
              total: 8,
              characteristic: null,
              modifier: 0,
              target: 0,
              success: true,
              outcome: 'allowed'
            }
          },
          { type: 'REENLIST' },
          {
            type: 'SURVIVAL_PASSED',
            canCommission: true,
            canAdvance: false,
            survival: {
              expression: '2d6',
              rolls: [3, 3],
              total: 6,
              characteristic: 'end',
              modifier: 0,
              target: 5,
              success: true
            }
          }
        ]),
        state: {
          status: 'COMMISSION',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        terms: [
          {
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
            reEnlistment: 8
          },
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 6,
            facts: {
              survival: {
                passed: true,
                survival: {
                  expression: '2d6',
                  rolls: [3, 3],
                  total: 6,
                  characteristic: 'end',
                  modifier: 0,
                  target: 5,
                  success: true
                },
                canCommission: true,
                canAdvance: false
              }
            }
          }
        ]
      })
    )
    if (!flow) throw new Error('Expected projected flow')

    assert.equal(flow.step, 'career')
    assert.equal(flow.draft.completedTerms.length, 1)
    assert.equal(flow.draft.careerPlan?.career, 'Scout')
    assert.equal(flow.draft.careerPlan?.survivalRoll, 6)
    assert.equal(flow.draft.careerPlan?.commissionRoll, null)
    assert.equal(flow.draft.careerPlan?.agingRoll, null)
    assert.equal(flow.draft.careerPlan?.reenlistmentRoll, null)
  })

  it('requires anagathics decision before aging a reenlisted active term', () => {
    const flow = flowFromProjectedCharacter(
      character({
        ...agingProjection([
          ...resolvedTermSkillHistory,
          {
            type: 'DECIDE_ANAGATHICS',
            useAnagathics: false,
            termIndex: 0
          },
          {
            type: 'COMPLETE_AGING',
            aging: {
              roll: {
                expression: '2d6',
                rolls: [5, 5],
                total: 10
              },
              age: 22,
              modifier: 0,
              characteristicChanges: []
            }
          },
          {
            type: 'RESOLVE_REENLISTMENT',
            reenlistment: {
              expression: '2d6',
              rolls: [4, 4],
              total: 8,
              characteristic: null,
              modifier: 0,
              target: 4,
              success: true,
              outcome: 'allowed'
            }
          },
          { type: 'REENLIST' },
          {
            type: 'SURVIVAL_PASSED',
            canCommission: true,
            canAdvance: false,
            survival: {
              expression: '2d6',
              rolls: [3, 3],
              total: 6,
              characteristic: 'end',
              modifier: 0,
              target: 5,
              success: true
            }
          },
          {
            type: 'COMPLETE_COMMISSION',
            commission: {
              expression: '2d6',
              rolls: [1, 2],
              total: 3,
              characteristic: 'str',
              modifier: 0,
              target: 6,
              success: false
            }
          },
          termSkillEvent('Gambling-1')
        ]),
        state: {
          status: 'AGING',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        terms: [
          {
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
            reEnlistment: 8
          },
          {
            career: 'Scout',
            skills: ['Gambling-1'],
            skillsAndTraining: ['Gambling-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 6,
            facts: {
              survival: {
                passed: true,
                survival: {
                  expression: '2d6',
                  rolls: [3, 3],
                  total: 6,
                  characteristic: 'end',
                  modifier: 0,
                  target: 5,
                  success: true
                },
                canCommission: true,
                canAdvance: false
              },
              commission: {
                skipped: false,
                passed: false,
                commission: {
                  expression: '2d6',
                  rolls: [1, 2],
                  total: 3,
                  characteristic: 'str',
                  modifier: 0,
                  target: 6,
                  success: false
                }
              },
              termSkillRolls: [termSkillEvent('Gambling-1').termSkill]
            }
          }
        ]
      })
    )
    if (!flow) throw new Error('Expected projected flow')

    assert.equal(deriveCharacterCreationTermSkillTableActions(flow).length, 0)
    assert.deepEqual(deriveCharacterCreationAnagathicsDecision(flow), {
      label: 'Decide anagathics',
      reason: 'Iona Vesh Scout anagathics'
    })
    assert.equal(deriveNextCharacterCreationAgingRoll(flow), null)
  })

  it('keeps plain mustering out on skills but opens equipment once benefits exist', () => {
    const plainMusteringFlow = flowFromProjectedCharacter(
      character({
        ...agingProjection(),
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        }
      })
    )
    const benefitMusteringFlow = flowFromProjectedCharacter(
      character({
        ...agingProjection([
          {
            type: 'FINISH_MUSTERING',
            musteringBenefit: {
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
          }
        ]),
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        }
      })
    )

    assert.equal(plainMusteringFlow?.step, 'career')
    assert.equal(benefitMusteringFlow?.step, 'equipment')
  })

  it('marks legacy aggregate mustering benefits without inventing roll facts', () => {
    const creation: CharacterCreationProjection = {
      ...agingProjection(),
      state: {
        status: 'MUSTERING_OUT',
        context: {
          canCommission: false,
          canAdvance: false
        }
      },
      terms: [
        {
          career: 'Scout',
          skills: [],
          skillsAndTraining: [],
          benefits: ['Low Passage', '20000'],
          complete: true,
          canReenlist: false,
          completedBasicTraining: true,
          musteringOut: true,
          anagathics: false,
          survival: 8
        }
      ],
      history: []
    }

    assert.deepEqual(musteringBenefitsFromProjection(creation), [
      {
        career: 'Scout',
        kind: 'material',
        roll: 0,
        legacyProjection: true,
        value: 'Low Passage',
        credits: 0
      },
      {
        career: 'Scout',
        kind: 'cash',
        roll: 0,
        legacyProjection: true,
        value: '20000',
        credits: 20000
      }
    ])
    assert.equal(
      flowFromProjectedCharacter(character(creation))?.step,
      'equipment'
    )
  })
})
