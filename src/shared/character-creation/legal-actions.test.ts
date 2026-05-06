import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createCareerTerm,
  createCareerCreationState,
  deriveCareerCreationActionContext,
  deriveCareerCreationPendingDecisions,
  deriveCareerCreationReenlistmentOutcome,
  deriveLegalCareerCreationActionKeys,
  deriveLegalCareerCreationActionKeysForProjection,
  deriveRemainingCareerCreationBenefits
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
      []
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
      []
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

    assert.equal(deriveRemainingCareerCreationBenefits(creation), 3)
    assert.deepEqual(
      deriveLegalCareerCreationActionKeysForProjection(creation),
      ['resolveMusteringBenefit']
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

  it('derives reenlistment outcomes when projected term data is present', () => {
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
})
