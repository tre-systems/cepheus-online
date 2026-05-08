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
  resolveSurvivalFailureOutcome
} from './index'
import type { CareerCreationActionProjection, CareerTerm } from './types'

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
            'EnterCharacterCreationDrifter',
            'StartCharacterCareerTerm'
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
            'EnterCharacterCreationDrifter',
            'StartCharacterCareerTerm'
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
          commandTypes: ['ResolveCharacterCreationAging'],
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
          commandTypes: ['AdvanceCharacterCreation']
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
          commandTypes: ['AdvanceCharacterCreation'],
          rollRequirement: { key: 'mishap', dice: '2d6' }
        }
      ]
    )
  })

  it('exposes only Drifter or Draft options after failed qualification', () => {
    assert.deepEqual(
      deriveCareerCreationActionPlan(
        projection('CAREER_SELECTION', {
          failedToQualify: true,
          canEnterDraft: true
        })
      ),
      {
        status: 'CAREER_SELECTION',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'selectCareer',
            status: 'CAREER_SELECTION',
            commandTypes: [
              'ResolveCharacterCreationQualification',
              'ResolveCharacterCreationDraft',
              'EnterCharacterCreationDrifter',
              'StartCharacterCareerTerm'
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
      }
    )
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
      legalActions: []
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
      [{ key: 'basicTrainingSkillSelection' }]
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
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
              completedBasicTraining: false,
              skillsAndTraining: ['Pilot-0']
            })
          ]
        })
      ),
      []
    )
    assert.deepEqual(
      deriveCareerCreationPendingDecisions(
        projection('SKILLS_TRAINING', {
          terms: [term({ skills: [] })]
        })
      ),
      [{ key: 'skillTrainingSelection' }]
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          terms: [term({ skills: ['Pilot-1'] })]
        })
      ),
      ['completeSkills']
    )
  })

  it('keeps non-commission careers in skills training until both term skill rolls are resolved', () => {
    const creation = projection('SKILLS_TRAINING', {
      requiredTermSkillCount: 2,
      terms: [term({ career: 'Scout', skills: ['Pilot-1'] })]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(creation), [
      { key: 'skillTrainingSelection' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      []
    )
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(
        projection('SKILLS_TRAINING', {
          requiredTermSkillCount: 2,
          terms: [
            term({
              career: 'Scout',
              skills: ['Pilot-1', 'Mechanics-1']
            })
          ]
        })
      ),
      ['completeSkills']
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
      []
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
      terms: [term({ survival: 8 })]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(beforeDecision), [
      { key: 'anagathicsDecision' }
    ])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(beforeDecision),
      ['decideAnagathics']
    )

    const afterDecision = projection('AGING', {
      terms: [term({ survival: 8, anagathics: true })],
      history: [
        { type: 'DECIDE_ANAGATHICS', useAnagathics: true, termIndex: 0 }
      ]
    })

    assert.deepEqual(deriveCareerCreationPendingDecisions(afterDecision), [])
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(afterDecision),
      ['resolveAging']
    )
  })

  it('blocks aging actions when anagathics is not the only pending decision', () => {
    const creation = projection('AGING', {
      terms: [term({ survival: 8 })],
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
            commandTypes: ['AdvanceCharacterCreation']
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
            commandTypes: [
              'CompleteCharacterCreation',
              'FinalizeCharacterCreation'
            ]
          }
        ]
      }
    )
  })
})
