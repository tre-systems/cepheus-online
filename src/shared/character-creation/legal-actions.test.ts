import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createCareerCreationState,
  createCareerTerm,
  deriveSurvivalFailurePendingDecision,
  deriveCareerCreationActionContext,
  deriveCareerCreationActionPlan,
  deriveCareerCreationPendingDecisions,
  deriveCareerCreationReenlistmentOutcome,
  deriveLegalCareerCreationActionKeys,
  deriveLegalCareerCreationActionKeysForProjection,
  deriveLegalCareerCreationActions,
  deriveRemainingCareerCreationBenefits,
  projectCareerCreationActionPlan,
  resolveSurvivalFailureOutcome
} from './index'
import type {
  CareerCreationActionProjection,
  CareerCreationBenefitFact,
  CareerTermReenlistmentFact,
  CareerCreationTermSkillFact,
  CareerTerm
} from './types'

const term = (overrides: Partial<CareerTerm> = {}): CareerTerm => ({
  ...createCareerTerm({ career: 'Scout' }),
  ...overrides
})

const projection = (
  status: CareerCreationActionProjection['state']['status'],
  overrides: Partial<CareerCreationActionProjection> = {}
): CareerCreationActionProjection => ({
  state: createCareerCreationState(status),
  terms: [],
  careers: [],
  pendingCascadeSkills: [],
  creationComplete: false,
  ...overrides
})

const musteringBenefit = (
  overrides: Partial<CareerCreationBenefitFact> = {}
): CareerCreationBenefitFact => ({
  career: 'Scout',
  kind: 'material',
  roll: { expression: '2d6', rolls: [3, 4], total: 7 },
  modifier: 0,
  tableRoll: 7,
  value: 'Low Passage',
  credits: 0,
  materialItem: 'Low Passage',
  ...overrides
})

const reenlistmentFact = (
  outcome: CareerTermReenlistmentFact['outcome']
): CareerTermReenlistmentFact => ({
  outcome,
  reenlistment: {
    expression: '2d6',
    rolls: outcome === 'forced' ? [6, 6] : [3, 4],
    total: outcome === 'forced' ? 12 : 7,
    characteristic: null,
    modifier: 0,
    target: 6,
    success: outcome !== 'blocked',
    outcome
  }
})

const termSkillFact = (
  overrides: Partial<CareerCreationTermSkillFact> = {}
): CareerCreationTermSkillFact => ({
  career: 'Scout',
  table: 'serviceSkills',
  roll: { expression: '1d6', rolls: [1], total: 1 },
  tableRoll: 1,
  rawSkill: 'Pilot',
  skill: 'Pilot-1',
  characteristic: null,
  pendingCascadeSkill: null,
  ...overrides
})

const mishapFact = (
  benefitEffect: 'forfeit_current_term' | 'lose_all'
): NonNullable<CareerTerm['facts']>['mishap'] => ({
  roll: {
    expression: '1d6',
    rolls: [benefitEffect === 'lose_all' ? 4 : 2],
    total: benefitEffect === 'lose_all' ? 4 : 2
  },
  outcome: {
    career: 'Scout',
    roll: benefitEffect === 'lose_all' ? 4 : 2,
    id:
      benefitEffect === 'lose_all'
        ? 'dishonorable_discharge'
        : 'honorable_discharge',
    description:
      benefitEffect === 'lose_all'
        ? 'Dishonorably discharged from the service. Lose all benefits.'
        : 'Honorably discharged from the service.',
    discharge: benefitEffect === 'lose_all' ? 'dishonorable' : 'honorable',
    benefitEffect,
    debtCredits: 0,
    extraServiceYears: 0,
    injury: null
  }
})

describe('career creation legal action planner', () => {
  it('derives legal action keys from the coarse creation status', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('CHARACTERISTICS')
      ),
      ['setCharacteristics']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('SURVIVAL')
      ),
      ['rollSurvival']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('COMMISSION', { canCommission: true })
      ),
      ['rollCommission', 'skipCommission']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('ADVANCEMENT', { canAdvance: true })
      ),
      ['rollAdvancement', 'skipAdvancement']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(createCareerCreationState('MISHAP')),
      ['resolveMishap', 'confirmDeath']
    )
  })

  it('derives structured legal actions with server command and roll requirements', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActions(createCareerCreationState('SURVIVAL')),
      [
        {
          key: 'rollSurvival',
          status: 'SURVIVAL',
          commandTypes: ['ResolveCharacterCreationSurvival'],
          rollRequirement: { key: 'survival', dice: '2d6' }
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(createCareerCreationState('HOMEWORLD')),
      [
        {
          key: 'completeHomeworld',
          status: 'HOMEWORLD',
          commandTypes: ['CompleteCharacterCreationHomeworld']
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(
        createCareerCreationState('CAREER_SELECTION')
      ),
      [
        {
          key: 'selectCareer',
          status: 'CAREER_SELECTION',
          commandTypes: [
            'ResolveCharacterCreationQualification',
            'ResolveCharacterCreationDraft',
            'EnterCharacterCreationDrifter'
          ],
          rollRequirement: { key: 'careerQualification', dice: '2d6' }
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(
        createCareerCreationState('CAREER_SELECTION'),
        { failedToQualify: true, canEnterDraft: true }
      ),
      [
        {
          key: 'selectCareer',
          status: 'CAREER_SELECTION',
          commandTypes: [
            'ResolveCharacterCreationQualification',
            'ResolveCharacterCreationDraft',
            'EnterCharacterCreationDrifter'
          ],
          failedQualificationOptions: [
            { option: 'Drifter' },
            {
              option: 'Draft',
              rollRequirement: { key: 'draft', dice: '1d6' }
            }
          ]
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(
        createCareerCreationState('BASIC_TRAINING')
      ),
      [
        {
          key: 'completeBasicTraining',
          status: 'BASIC_TRAINING',
          commandTypes: ['CompleteCharacterCreationBasicTraining']
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(createCareerCreationState('AGING')),
      [
        {
          key: 'resolveAging',
          status: 'AGING',
          commandTypes: [
            'ResolveCharacterCreationAging',
            'ResolveCharacterCreationAgingLosses'
          ],
          rollRequirement: { key: 'aging', dice: '2d6' }
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(
        createCareerCreationState('MUSTERING_OUT'),
        { canContinueCareer: true }
      ),
      [
        {
          key: 'continueCareer',
          status: 'MUSTERING_OUT',
          commandTypes: ['ContinueCharacterCreationAfterMustering']
        },
        {
          key: 'finishMustering',
          status: 'MUSTERING_OUT',
          commandTypes: ['CompleteCharacterCreationMustering']
        }
      ]
    )
  })

  it('does not offer actions for impossible promotion states', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('COMMISSION', { canCommission: false })
      ),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('ADVANCEMENT', { canAdvance: false })
      ),
      []
    )
  })

  it('derives mishap legal actions from pending survival failure facts', () => {
    const death = resolveSurvivalFailureOutcome({
      career: 'Scout',
      survival: { total: 2, outcome: 'fail' }
    })
    const mishap = resolveSurvivalFailureOutcome({
      career: 'Marine',
      survival: { total: 5, outcome: 'fail' },
      mishap: { total: 4 }
    })

    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(createCareerCreationState('MISHAP'), {
        pendingDecisions: [deriveSurvivalFailurePendingDecision(death)]
      }),
      ['confirmDeath']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(createCareerCreationState('MISHAP'), {
        pendingDecisions: [deriveSurvivalFailurePendingDecision(mishap)]
      }),
      ['resolveMishap']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActions(createCareerCreationState('MISHAP'), {
        pendingDecisions: [deriveSurvivalFailurePendingDecision(mishap)]
      }),
      [
        {
          key: 'resolveMishap',
          status: 'MISHAP',
          commandTypes: ['ResolveCharacterCreationMishap'],
          rollRequirement: { key: 'mishap', dice: '1d6' }
        }
      ]
    )
  })

  it('derives injury resolution from projected mishap facts before mustering', () => {
    const plan = deriveCareerCreationActionPlan(
      projection('MISHAP', {
        terms: [
          term({
            facts: {
              mishap: {
                roll: { expression: '1d6', rolls: [1], total: 1 },
                outcome: {
                  career: 'Scout',
                  roll: 1,
                  id: 'injured_in_action',
                  description:
                    'Injured in action. Treat as injury table result 2, or roll twice and take the lower result.',
                  discharge: 'honorable',
                  benefitEffect: 'forfeit_current_term',
                  debtCredits: 0,
                  extraServiceYears: 0,
                  injury: {
                    type: 'fixed',
                    injuryRoll: 2,
                    alternative: 'roll_twice_take_lower'
                  }
                }
              }
            }
          })
        ]
      })
    )

    assert.deepEqual(plan.pendingDecisions, [{ key: 'injuryResolution' }])
    assert.deepEqual(plan.legalActions, [
      {
        key: 'resolveInjury',
        status: 'MISHAP',
        commandTypes: ['ResolveCharacterCreationInjury'],
        rollRequirement: { key: 'injury', dice: '1d6' }
      }
    ])
  })

  it('exposes only Drifter or Draft options after failed qualification', () => {
    const plan = deriveCareerCreationActionPlan(
      projection('CAREER_SELECTION', {
        failedToQualify: true,
        canEnterDraft: true
      })
    )

    assert.equal(plan.status, 'CAREER_SELECTION')
    assert.deepEqual(plan.pendingDecisions, [])
    assert.deepEqual(plan.legalActions, [
      {
        key: 'selectCareer',
        status: 'CAREER_SELECTION',
        commandTypes: [
          'ResolveCharacterCreationQualification',
          'ResolveCharacterCreationDraft',
          'EnterCharacterCreationDrifter'
        ],
        failedQualificationOptions: [
          { option: 'Drifter' },
          {
            option: 'Draft',
            rollRequirement: { key: 'draft', dice: '1d6' }
          }
        ]
      }
    ])
    assert.equal((plan.careerChoiceOptions?.careers.length ?? 0) > 0, true)
  })

  it('does not expose the Draft option after the draft has been used', () => {
    assert.deepEqual(
      deriveCareerCreationActionPlan(
        projection('CAREER_SELECTION', {
          failedToQualify: true,
          canEnterDraft: false
        })
      ).legalActions[0]?.failedQualificationOptions,
      [{ option: 'Drifter' }]
    )
  })

  it('offers SRD term gates in order around commission and advancement', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: true
        })
      ),
      ['rollCommission', 'skipCommission']
    )

    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('ADVANCEMENT', {
          canCommission: true,
          canAdvance: true
        })
      ),
      ['rollAdvancement', 'skipAdvancement']
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(
        createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: true
        })
      ),
      [
        {
          key: 'rollCommission',
          status: 'COMMISSION',
          commandTypes: ['ResolveCharacterCreationCommission'],
          rollRequirement: { key: 'commission', dice: '2d6' }
        },
        {
          key: 'skipCommission',
          status: 'COMMISSION',
          commandTypes: ['SkipCharacterCreationCommission']
        }
      ]
    )

    assert.deepEqual(
      deriveLegalCareerCreationActions(
        createCareerCreationState('ADVANCEMENT', {
          canCommission: true,
          canAdvance: true
        })
      ),
      [
        {
          key: 'rollAdvancement',
          status: 'ADVANCEMENT',
          commandTypes: ['ResolveCharacterCreationAdvancement'],
          rollRequirement: { key: 'advancement', dice: '2d6' }
        },
        {
          key: 'skipAdvancement',
          status: 'ADVANCEMENT',
          commandTypes: ['SkipCharacterCreationAdvancement']
        }
      ]
    )
  })

  it('derives legal actions in SRD phase order', () => {
    const phases = [
      [
        createCareerCreationState('CHARACTERISTICS'),
        {},
        ['setCharacteristics']
      ],
      [createCareerCreationState('HOMEWORLD'), {}, ['completeHomeworld']],
      [createCareerCreationState('CAREER_SELECTION'), {}, ['selectCareer']],
      [
        createCareerCreationState('BASIC_TRAINING'),
        {},
        ['completeBasicTraining']
      ],
      [createCareerCreationState('SURVIVAL'), {}, ['rollSurvival']],
      [
        createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: true
        }),
        {},
        ['rollCommission', 'skipCommission']
      ],
      [
        createCareerCreationState('ADVANCEMENT', {
          canCommission: true,
          canAdvance: true
        }),
        {},
        ['rollAdvancement', 'skipAdvancement']
      ],
      [createCareerCreationState('SKILLS_TRAINING'), {}, ['completeSkills']],
      [createCareerCreationState('AGING'), {}, ['resolveAging']],
      [
        createCareerCreationState('REENLISTMENT'),
        { reenlistmentOutcome: 'allowed' },
        ['reenlist', 'leaveCareer']
      ],
      [
        createCareerCreationState('MUSTERING_OUT'),
        { canContinueCareer: false },
        ['finishMustering']
      ],
      [
        createCareerCreationState('ACTIVE'),
        { canCompleteCreation: true },
        ['completeCreation']
      ]
    ] satisfies readonly [
      ReturnType<typeof createCareerCreationState>,
      Parameters<typeof deriveLegalCareerCreationActionKeys>[1],
      ReturnType<typeof deriveLegalCareerCreationActionKeys>
    ][]

    for (const [state, context, expectedActions] of phases) {
      assert.deepEqual(
        deriveLegalCareerCreationActionKeys(state, context),
        expectedActions,
        state.status
      )
    }
  })

  it('projects basic training options from the active career term', () => {
    const action = deriveCareerCreationActionPlan(
      projection('BASIC_TRAINING', {
        terms: [term({ career: 'Merchant' })]
      })
    ).legalActions[0]

    assert.deepEqual(action?.basicTrainingOptions, {
      kind: 'all',
      skills: [
        'Comms-0',
        'Engineering-0',
        'Gun Combat-0',
        'Melee Combat-0',
        'Broker-0',
        'Vehicle-0'
      ]
    })
  })

  it('gates status actions while required decisions are pending', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('CHARACTERISTICS'),
        { pendingDecisions: [{ key: 'characteristicAssignment' }] }
      ),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('BASIC_TRAINING'),
        { pendingDecisions: [{ key: 'basicTrainingSkillSelection' }] }
      ),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('SKILLS_TRAINING'),
        { pendingDecisions: [{ key: 'cascadeSkillResolution' }] }
      ),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(createCareerCreationState('AGING'), {
        pendingDecisions: [{ key: 'anagathicsDecision' }]
      }),
      ['decideAnagathics']
    )
  })

  it('derives reenlistment actions from term-level context', () => {
    const reenlistment = createCareerCreationState('REENLISTMENT')

    assert.deepEqual(deriveLegalCareerCreationActionKeys(reenlistment), [
      'rollReenlistment'
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(reenlistment, {
        reenlistmentOutcome: 'forced'
      }),
      ['forcedReenlist']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(reenlistment, {
        reenlistmentOutcome: 'allowed'
      }),
      ['reenlist', 'leaveCareer']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(reenlistment, {
        reenlistmentOutcome: 'blocked'
      }),
      ['leaveCareer']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(reenlistment, {
        pendingDecisions: [{ key: 'reenlistmentResolution' }]
      }),
      ['rollReenlistment']
    )
  })

  it('gates mustering and completion actions by remaining work', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('MUSTERING_OUT'),
        { remainingMusteringBenefits: 1, canContinueCareer: true }
      ),
      ['resolveMusteringBenefit']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(
        createCareerCreationState('MUSTERING_OUT'),
        { canContinueCareer: true }
      ),
      ['continueCareer', 'finishMustering']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(createCareerCreationState('ACTIVE')),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeys(createCareerCreationState('ACTIVE'), {
        canCompleteCreation: true
      }),
      ['completeCreation']
    )
  })

  it('derives pending decisions from projected cascade skill state', () => {
    const creation = projection('SKILLS_TRAINING', {
      pendingCascadeSkills: ['Gun Combat-0']
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'cascadeSkillResolution' }
    ])
    assert.deepEqual(deriveCareerCreationActionContext(creation), {
      pendingDecisions: [{ key: 'cascadeSkillResolution' }],
      remainingMusteringBenefits: 0,
      canContinueCareer: false,
      canCompleteCreation: false,
      reenlistmentOutcome: 'unresolved'
    })
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      []
    )
    assert.deepEqual(deriveCareerCreationActionPlan(creation), {
      status: 'SKILLS_TRAINING',
      pendingDecisions: [{ key: 'cascadeSkillResolution' }],
      legalActions: [],
      cascadeSkillChoices: [
        {
          cascadeSkill: 'Gun Combat-0',
          label: 'Gun Combat',
          level: 0,
          options: [
            { value: 'Archery-0', label: 'Archery', cascade: false },
            {
              value: 'Energy Pistol-0',
              label: 'Energy Pistol',
              cascade: false
            },
            { value: 'Energy Rifle-0', label: 'Energy Rifle', cascade: false },
            { value: 'Shotgun-0', label: 'Shotgun', cascade: false },
            { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false },
            { value: 'Slug Rifle-0', label: 'Slug Rifle', cascade: false }
          ]
        }
      ]
    })
  })

  it('derives pending decisions from unresolved projected homeworld choices', () => {
    const creation = projection('HOMEWORLD', {
      backgroundSkillAllowance: 3,
      backgroundSkills: ['Zero-G-0'],
      pendingCascadeSkills: []
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'homeworldSkillSelection' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('HOMEWORLD', {
          backgroundSkillAllowance: 3,
          backgroundSkills: ['Zero-G-0', 'Admin-0', 'Broker-0'],
          pendingCascadeSkills: []
        })
      ),
      ['completeHomeworld']
    )
  })

  it('projects homeworld law, trade code, and background skill choices', () => {
    const creation = projection('HOMEWORLD', {
      homeworld: {
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })
    const plan = deriveCareerCreationActionPlan(creation, {
      characteristics: { edu: 12 }
    })

    assert.equal(
      plan.homeworldChoiceOptions?.lawLevels.includes('No Law'),
      true
    )
    assert.equal(
      plan.homeworldChoiceOptions?.tradeCodes.includes('Asteroid'),
      true
    )
    assert.deepEqual(
      plan.homeworldChoiceOptions?.backgroundSkills.slice(0, 3),
      [
        {
          value: 'Gun Combat-0',
          label: 'Gun Combat*',
          preselected: true,
          cascade: true
        },
        {
          value: 'Zero-G-0',
          label: 'Zero-G',
          preselected: true,
          cascade: false
        },
        {
          value: 'Admin-0',
          label: 'Admin',
          preselected: false,
          cascade: false
        }
      ]
    )
  })

  it('projects career selection choices and check modifiers', () => {
    const creation = projection('CAREER_SELECTION', {
      terms: [term({ career: 'Scout' })]
    })
    const plan = deriveCareerCreationActionPlan(creation, {
      characteristics: { end: 7, int: 9 }
    })
    const scout = plan.careerChoiceOptions?.careers.find(
      (career) => career.key === 'Scout'
    )

    assert.equal(plan.careerChoiceOptions?.careers[0]?.key, 'Scout')
    assert.equal(scout?.selected, true)
    assert.deepEqual(scout?.qualification, {
      label: 'Qualification',
      requirement: 'Int 6+',
      available: true,
      characteristic: 'int',
      target: 6,
      modifier: 1
    })
    assert.deepEqual(scout?.survival, {
      label: 'Survival',
      requirement: 'End 7+',
      available: true,
      characteristic: 'end',
      target: 7,
      modifier: 0
    })
  })

  it('projects the shared action plan onto creation state without mutating input', () => {
    const creation = projection('SURVIVAL')
    const projected = projectCareerCreationActionPlan(creation)

    assert.equal((creation as { actionPlan?: unknown }).actionPlan, undefined)
    assert.deepEqual(projected.actionPlan, {
      status: 'SURVIVAL',
      pendingDecisions: [],
      legalActions: [
        {
          key: 'rollSurvival',
          status: 'SURVIVAL',
          commandTypes: ['ResolveCharacterCreationSurvival'],
          rollRequirement: { key: 'survival', dice: '2d6' }
        }
      ]
    })
  })

  it('derives pending decisions from unresolved projected term gates', () => {
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('BASIC_TRAINING', {
          terms: [
            term({
              completedBasicTraining: false,
              skillsAndTraining: []
            })
          ]
        })
      ),
      []
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('BASIC_TRAINING', {
          terms: [
            term({
              career: 'Scout',
              completedBasicTraining: true,
              skillsAndTraining: ['Vacc Suit-0'],
              facts: undefined
            }),
            term({
              career: 'Merchant',
              completedBasicTraining: false,
              skillsAndTraining: ['Legacy Training-0'],
              facts: {}
            })
          ]
        })
      ),
      [{ key: 'basicTrainingSkillSelection' }]
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('BASIC_TRAINING', {
          terms: [
            term({
              career: 'Scout',
              completedBasicTraining: true,
              skillsAndTraining: ['Vacc Suit-0'],
              facts: undefined
            }),
            term({
              career: 'Merchant',
              completedBasicTraining: false,
              skillsAndTraining: [],
              facts: undefined
            })
          ]
        })
      ),
      [{ key: 'basicTrainingSkillSelection' }]
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('BASIC_TRAINING', {
          terms: [
            term({
              career: 'Scout',
              completedBasicTraining: true,
              skillsAndTraining: ['Vacc Suit-0'],
              facts: undefined
            }),
            term({
              career: 'Merchant',
              completedBasicTraining: false,
              skillsAndTraining: [],
              facts: undefined
            })
          ]
        })
      ),
      ['completeBasicTraining']
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('BASIC_TRAINING', {
          terms: [
            term({
              completedBasicTraining: false,
              skillsAndTraining: [],
              facts: { basicTrainingSkills: ['Broker-0'] }
            })
          ]
        })
      ),
      []
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('BASIC_TRAINING', {
          terms: [
            term({
              completedBasicTraining: false,
              skillsAndTraining: ['Pilot-0'],
              facts: undefined
            })
          ]
        })
      ),
      []
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('SKILLS_TRAINING', {
          terms: [term({ skills: [], facts: undefined })]
        })
      ),
      [{ key: 'skillTrainingSelection' }]
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 1,
          terms: [
            term({
              skills: [],
              facts: { termSkillRolls: [termSkillFact()] }
            })
          ]
        })
      ),
      []
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 1,
          terms: [
            term({
              skills: ['Legacy Skill-1'],
              facts: { basicTrainingSkills: [] }
            })
          ]
        })
      ),
      [{ key: 'skillTrainingSelection' }]
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          terms: [term({ skills: ['Pilot-1'], facts: undefined })]
        })
      ),
      ['completeSkills']
    )
  })

  it('keeps non-commission careers in skills training until both term skill rolls are resolved', () => {
    const creation = projection('SKILLS_TRAINING', {
      requiredTermSkillCount: 2,
      terms: [term({ career: 'Scout', skills: ['Pilot-1'], facts: undefined })]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'skillTrainingSelection' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      ['rollTermSkill']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 2,
          terms: [
            term({
              career: 'Scout',
              skills: ['Pilot-1', 'Mechanics-1'],
              facts: undefined
            })
          ]
        })
      ),
      ['completeSkills']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 2,
          terms: [
            term({
              career: 'Scout',
              skills: [],
              facts: {
                termSkillRolls: [
                  termSkillFact({ skill: 'Pilot-1' }),
                  termSkillFact({
                    table: 'specialistSkills',
                    rawSkill: 'Mechanics',
                    skill: 'Mechanics-1'
                  })
                ]
              }
            })
          ]
        })
      ),
      ['completeSkills']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 2,
          terms: [
            term({
              career: 'Scout',
              skills: ['Legacy Pilot-1', 'Legacy Mechanics-1'],
              facts: {
                termSkillRolls: [termSkillFact({ skill: 'Pilot-1' })]
              }
            })
          ]
        })
      ),
      ['rollTermSkill']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 2,
          terms: [
            term({
              career: 'Scout',
              skills: ['Legacy Pilot-1', 'Legacy Mechanics-1'],
              facts: {}
            })
          ]
        })
      ),
      ['rollTermSkill']
    )
  })

  it('projects legal term skill table choices from the action plan', () => {
    const creation = projection('SKILLS_TRAINING', {
      requiredTermSkillCount: 2,
      terms: [term({ career: 'Scout', skills: ['Pilot-1'], facts: undefined })]
    })

    assert.deepEqual(
      deriveCareerCreationActionPlan(creation, {
        characteristics: { edu: 7 }
      }).legalActions[0]?.termSkillTableOptions,
      [
        { table: 'personalDevelopment', label: 'Personal development' },
        { table: 'serviceSkills', label: 'Service skills' },
        { table: 'specialistSkills', label: 'Specialist skills' }
      ]
    )
    assert.deepEqual(
      deriveCareerCreationActionPlan(creation, {
        characteristics: { edu: 8 }
      }).legalActions[0]?.termSkillTableOptions,
      [
        { table: 'personalDevelopment', label: 'Personal development' },
        { table: 'serviceSkills', label: 'Service skills' },
        { table: 'specialistSkills', label: 'Specialist skills' },
        { table: 'advancedEducation', label: 'Advanced education' }
      ]
    )
  })

  it('derives pending decisions from unresolved aging losses', () => {
    const creation = projection('AGING', {
      characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'agingResolution' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('AGING', { characteristicChanges: [] })
      ),
      ['resolveAging']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }],
          terms: [term({ reEnlistment: 7 })]
        })
      ),
      ['resolveAging']
    )
  })

  it('derives pending decisions from unresolved reenlistment', () => {
    const creation = projection('REENLISTMENT', {
      terms: [term({ skillsAndTraining: ['Pilot-1'] })]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'reenlistmentResolution' }
    ])
    assert.deepEqual(deriveCareerCreationActionContext(creation), {
      pendingDecisions: [{ key: 'reenlistmentResolution' }],
      remainingMusteringBenefits: 1,
      canContinueCareer: false,
      canCompleteCreation: false,
      reenlistmentOutcome: 'unresolved'
    })
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      ['rollReenlistment']
    )
  })

  it('ignores legacy reenlistment rolls when semantic term facts exist', () => {
    const creation = projection('REENLISTMENT', {
      terms: [
        term({
          reEnlistment: 12,
          canReenlist: false,
          musteringOut: true,
          facts: { termSkillRolls: [] }
        })
      ]
    })

    assert.equal(
      deriveCareerCreationReenlistmentOutcome(creation),
      'unresolved'
    )
    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'reenlistmentResolution' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      ['rollReenlistment']
    )
  })

  it('projects legal mustering benefit choices from remaining benefits', () => {
    const creation = projection('MUSTERING_OUT', {
      terms: [term({ career: 'Scout', complete: true, musteringOut: true })],
      careers: [{ name: 'Scout', rank: 0 }]
    })

    assert.deepEqual(
      deriveCareerCreationActionPlan(creation).legalActions[0]
        ?.musteringBenefitOptions,
      [
        { career: 'Scout', kind: 'cash' },
        { career: 'Scout', kind: 'material' }
      ]
    )
    assert.deepEqual(
      deriveCareerCreationActionPlan(
        projection('MUSTERING_OUT', {
          terms: [
            term({
              career: 'Scout',
              complete: true,
              musteringOut: true,
              benefits: ['1000', '2000', '3000']
            }),
            ...Array.from({ length: 6 }, () =>
              term({
                career: 'Scout',
                complete: true,
                musteringOut: true
              })
            )
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      ).legalActions[0]?.musteringBenefitOptions,
      [{ career: 'Scout', kind: 'material' }]
    )
  })

  it('counts projected mustering facts before legacy benefit fields', () => {
    const creation = projection('MUSTERING_OUT', {
      terms: [
        term({
          career: 'Scout',
          complete: true,
          musteringOut: true,
          benefits: [],
          facts: {
            musteringBenefits: [
              musteringBenefit({
                career: 'Scout',
                kind: 'cash',
                value: '1000',
                credits: 1000,
                materialItem: null
              }),
              musteringBenefit({
                career: 'Scout',
                kind: 'cash',
                value: '2000',
                credits: 2000,
                materialItem: null
              }),
              musteringBenefit({
                career: 'Scout',
                kind: 'cash',
                value: '3000',
                credits: 3000,
                materialItem: null
              })
            ]
          }
        }),
        ...Array.from({ length: 6 }, () =>
          term({
            career: 'Scout',
            complete: true,
            musteringOut: true,
            benefits: [],
            facts: {}
          })
        )
      ],
      careers: [{ name: 'Scout', rank: 0 }]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(creation), 4)
    assert.deepEqual(
      deriveCareerCreationActionPlan(creation).legalActions[0]
        ?.musteringBenefitOptions,
      [{ career: 'Scout', kind: 'material' }]
    )
  })

  it('counts projected rank facts before legacy career rank for remaining benefits', () => {
    const creation = projection('MUSTERING_OUT', {
      terms: [
        term({
          career: 'Scout',
          complete: true,
          musteringOut: true,
          facts: {
            advancement: {
              skipped: false,
              passed: true,
              advancement: {
                expression: '2d6',
                rolls: [6, 6],
                total: 12,
                characteristic: 'int',
                modifier: 0,
                target: 8,
                success: true
              },
              rank: {
                career: 'Scout',
                previousRank: 4,
                newRank: 5,
                title: 'Senior Scout',
                bonusSkill: null
              }
            }
          }
        })
      ],
      careers: [{ name: 'Scout', rank: 0 }]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(creation), 4)
    assert.deepEqual(
      deriveCareerCreationActionPlan(creation).legalActions[0]
        ?.musteringBenefitOptions,
      [
        { career: 'Scout', kind: 'cash' },
        { career: 'Scout', kind: 'material' }
      ]
    )
  })

  it('ignores stale legacy career rank when semantic terms have no rank facts', () => {
    const creation = projection('MUSTERING_OUT', {
      terms: [
        term({
          career: 'Scout',
          complete: true,
          musteringOut: true,
          facts: {
            basicTrainingSkills: ['Comms-0']
          }
        })
      ],
      careers: [{ name: 'Scout', rank: 5 }]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(creation), 1)
    assert.deepEqual(
      deriveCareerCreationActionPlan(creation).legalActions[0]
        ?.musteringBenefitOptions,
      [
        { career: 'Scout', kind: 'cash' },
        { career: 'Scout', kind: 'material' }
      ]
    )
  })

  it('derives remaining projected mustering benefits by career', () => {
    const creation = projection('MUSTERING_OUT', {
      terms: [
        term({ career: 'Scout', benefits: ['Low Passage'] }),
        term({ career: 'Scout', benefits: [] }),
        term({ career: 'Navy', benefits: [] })
      ],
      careers: [
        { name: 'Scout', rank: 4 },
        { name: 'Navy', rank: 0 }
      ]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(creation), 4)
    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'musteringBenefitSelection' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      ['resolveMusteringBenefit']
    )
  })

  it('applies mishap benefit forfeiture to mustering legal actions', () => {
    const singleForfeitedTerm = projection('MUSTERING_OUT', {
      terms: [
        term({
          complete: true,
          musteringOut: true,
          facts: { mishap: mishapFact('forfeit_current_term') }
        })
      ],
      careers: [{ name: 'Scout', rank: 0 }]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(singleForfeitedTerm), 0)
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(singleForfeitedTerm),
      ['continueCareer', 'finishMustering']
    )

    const multiTermForfeiture = projection('MUSTERING_OUT', {
      terms: [
        term({ complete: true, facts: {} }),
        term({
          complete: true,
          musteringOut: true,
          facts: { mishap: mishapFact('forfeit_current_term') }
        })
      ],
      careers: [{ name: 'Scout', rank: 0 }]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(multiTermForfeiture), 1)
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(multiTermForfeiture),
      ['resolveMusteringBenefit']
    )

    const lostAllBenefits = projection('MUSTERING_OUT', {
      terms: [
        term({ complete: true, facts: {} }),
        term({
          complete: true,
          musteringOut: true,
          facts: { mishap: mishapFact('lose_all') }
        })
      ],
      careers: [{ name: 'Scout', rank: 5 }]
    })

    assert.equal(deriveRemainingCareerCreationBenefits(lostAllBenefits), 0)
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(lostAllBenefits),
      ['continueCareer', 'finishMustering']
    )
  })

  it('blocks projected mustering benefit actions behind unrelated pending decisions', () => {
    const creation = projection('MUSTERING_OUT', {
      terms: [term({ benefits: [], complete: true, musteringOut: true })],
      careers: [{ name: 'Scout', rank: 0 }],
      pendingCascadeSkills: ['Jack of all Trades']
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'cascadeSkillResolution' },
      { key: 'musteringBenefitSelection' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      []
    )
  })

  it('derives continuation and completion gates from projected terms', () => {
    assert.deepEqual(
      deriveCareerCreationActionContext(
        projection('MUSTERING_OUT', {
          terms: [
            term({
              career: 'Scout',
              benefits: ['Low Passage'],
              complete: true
            })
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      ),
      {
        pendingDecisions: [],
        remainingMusteringBenefits: 0,
        canContinueCareer: true,
        canCompleteCreation: true,
        reenlistmentOutcome: 'unresolved'
      }
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('MUSTERING_OUT', {
          terms: [
            term({
              career: 'Scout',
              benefits: ['Low Passage'],
              complete: true
            })
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      ),
      ['continueCareer', 'finishMustering']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('ACTIVE', {
          terms: [term({ complete: true })]
        })
      ),
      ['completeCreation']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('ACTIVE', {
          terms: [term({ complete: true })],
          creationComplete: true
        })
      ),
      []
    )
  })

  it('requires anagathics decisions before resolving projected aging', () => {
    const beforeDecision = projection('AGING', {
      terms: [term({ survival: 8, facts: undefined })]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(beforeDecision), [
      { key: 'anagathicsDecision' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(beforeDecision),
      ['decideAnagathics']
    )

    const beforeDecisionFromFacts = projection('AGING', {
      terms: [
        term({
          survival: undefined,
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
            }
          }
        })
      ]
    })

    assert.deepEqual(
      deriveCareerCreationPendingDecisions(beforeDecisionFromFacts),
      [{ key: 'anagathicsDecision' }]
    )

    const unresolvedFactsOwnedTerm = projection('AGING', {
      terms: [term({ survival: 8, facts: {} })]
    })

    assert.deepEqual(
      deriveCareerCreationPendingDecisions(unresolvedFactsOwnedTerm),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        unresolvedFactsOwnedTerm
      ),
      ['resolveAging']
    )

    const afterDecision = projection('AGING', {
      terms: [
        term({
          survival: 8,
          anagathics: true,
          facts: {
            anagathicsDecision: {
              useAnagathics: true,
              termIndex: 0
            }
          }
        })
      ],
      history: []
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(afterDecision), [])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(afterDecision),
      ['resolveAging']
    )
  })

  it('blocks aging actions when anagathics is not the only pending decision', () => {
    const creation = projection('AGING', {
      terms: [term({ survival: 8, facts: undefined })],
      pendingCascadeSkills: ['Jack of all Trades']
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'cascadeSkillResolution' },
      { key: 'anagathicsDecision' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      []
    )
  })

  it('derives reenlistment outcomes when projected term data is present', () => {
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          terms: [term()]
        })
      ),
      ['rollReenlistment']
    )
    assert.equal(
      deriveCareerCreationReenlistmentOutcome(
        projection('REENLISTMENT', {
          terms: [term({ reEnlistment: 12 })]
        })
      ),
      'forced'
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          terms: [term({ reEnlistment: 12 })]
        })
      ),
      ['forcedReenlist']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          terms: [term({ reEnlistment: 7 })]
        })
      ),
      ['reenlist', 'leaveCareer']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          terms: [term({ canReenlist: false, musteringOut: true })]
        })
      ),
      ['leaveCareer']
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          terms: Array.from({ length: 7 }, () => term())
        })
      ),
      ['leaveCareer']
    )
  })

  it('derives reenlistment outcomes from projected facts without legacy roll fields', () => {
    assert.equal(
      deriveCareerCreationReenlistmentOutcome(
        projection('REENLISTMENT', {
          terms: [
            term({
              reEnlistment: undefined,
              facts: { reenlistment: reenlistmentFact('forced') }
            })
          ]
        })
      ),
      'forced'
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('REENLISTMENT', {
          terms: [
            term({
              reEnlistment: undefined,
              facts: { reenlistment: reenlistmentFact('blocked') }
            })
          ]
        })
      ),
      ['leaveCareer']
    )
  })

  it('derives a replayable action plan from projected creation state', () => {
    assert.deepEqual(
      deriveCareerCreationActionPlan(
        projection('REENLISTMENT', {
          terms: [term({ reEnlistment: 12 })]
        })
      ),
      {
        status: 'REENLISTMENT',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'forcedReenlist',
            status: 'REENLISTMENT',
            commandTypes: ['ReenlistCharacterCreationCareer']
          }
        ]
      }
    )

    assert.deepEqual(
      deriveCareerCreationActionPlan(
        projection('ACTIVE', {
          terms: [term({ complete: true })]
        })
      ),
      {
        status: 'ACTIVE',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'completeCreation',
            status: 'ACTIVE',
            commandTypes: ['FinalizeCharacterCreation']
          }
        ]
      }
    )
  })
})
