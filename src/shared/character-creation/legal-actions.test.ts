import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createCareerCreationState,
  deriveLegalCareerCreationActionKeys
} from './index'

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
})
