import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CharacterCharacteristics } from './state'
import {
  availableCareerNames,
  canTransitionCareerCreationState,
  characteristicModifier,
  createCareerCreationState,
  deriveBasicTrainingPlan,
  deriveCareerQualificationDm,
  deriveSurvivalPromotionOptions,
  evaluateCareerCheck,
  isCareerCreationStatus,
  parseCareerCheck,
  transitionCareerCreationState,
  type CareerBasicsTable,
  type CareerSkillTable
} from './characterCreation'

const careerBasics = {
  Scout: {
    Qualifications: 'Int 6+',
    Survival: 'End 7+',
    Commission: '-',
    Advancement: '-',
    ReEnlistment: '6+'
  },
  Marine: {
    Qualifications: 'Int 6+',
    Survival: 'End 6+',
    Commission: 'Edu 6+',
    Advancement: 'Soc 7+',
    ReEnlistment: '6+'
  },
  Drifter: {
    Qualifications: 'Dex 5+',
    Survival: 'End 5+',
    Commission: '-',
    Advancement: '-',
    ReEnlistment: '5+'
  }
} satisfies CareerBasicsTable

const serviceSkills = {
  Scout: {
    '1': 'Pilot',
    '2': 'Vacc Suit',
    '3': 'Mechanics'
  },
  Marine: {
    '1': 'Gun Combat',
    '2': 'Tactics'
  }
} satisfies CareerSkillTable

const characteristics = {
  str: 7,
  dex: 8,
  end: 9,
  int: 10,
  edu: 7,
  soc: 6
} satisfies CharacterCharacteristics

describe('career creation state machine helpers', () => {
  it('transitions through the legacy career creation status model', () => {
    let state = createCareerCreationState()

    state = transitionCareerCreationState(state, {
      type: 'SET_CHARACTERISTICS'
    })
    assert.equal(state.status, 'HOMEWORLD')

    state = transitionCareerCreationState(state, {
      type: 'COMPLETE_HOMEWORLD'
    })
    assert.equal(state.status, 'CAREER_SELECTION')

    state = transitionCareerCreationState(state, {
      type: 'SELECT_CAREER',
      isNewCareer: true
    })
    assert.equal(state.status, 'BASIC_TRAINING')

    state = transitionCareerCreationState(state, {
      type: 'COMPLETE_BASIC_TRAINING'
    })
    assert.equal(state.status, 'SURVIVAL')

    state = transitionCareerCreationState(state, {
      type: 'SURVIVAL_PASSED',
      canCommission: false,
      canAdvance: true
    })
    assert.equal(state.status, 'ADVANCEMENT')
    assert.deepEqual(state.context, {
      canCommission: false,
      canAdvance: true
    })

    state = transitionCareerCreationState(state, {
      type: 'COMPLETE_ADVANCEMENT'
    })
    assert.equal(state.status, 'SKILLS_TRAINING')

    state = transitionCareerCreationState(state, { type: 'COMPLETE_SKILLS' })
    state = transitionCareerCreationState(state, { type: 'COMPLETE_AGING' })
    state = transitionCareerCreationState(state, { type: 'LEAVE_CAREER' })
    state = transitionCareerCreationState(state, { type: 'FINISH_MUSTERING' })
    state = transitionCareerCreationState(state, {
      type: 'CREATION_COMPLETE'
    })

    assert.equal(state.status, 'PLAYABLE')
  })

  it('keeps invalid transitions stable and supports reset from any state', () => {
    const survival = createCareerCreationState('SURVIVAL')

    assert.equal(
      canTransitionCareerCreationState(survival, {
        type: 'COMPLETE_SKILLS'
      }),
      false
    )
    assert.equal(
      transitionCareerCreationState(survival, {
        type: 'COMPLETE_SKILLS'
      }),
      survival
    )
    assert.deepEqual(
      transitionCareerCreationState(
        createCareerCreationState('DECEASED', {
          canAdvance: true,
          canCommission: true
        }),
        { type: 'RESET' }
      ),
      createCareerCreationState('CHARACTERISTICS')
    )
  })

  it('routes survival failure through mishap and death/retirement outcomes', () => {
    const mishap = transitionCareerCreationState(
      createCareerCreationState('SURVIVAL'),
      { type: 'SURVIVAL_FAILED' }
    )
    assert.equal(mishap.status, 'MISHAP')
    assert.equal(
      transitionCareerCreationState(mishap, { type: 'DEATH_CONFIRMED' }).status,
      'DECEASED'
    )
    assert.equal(
      transitionCareerCreationState(mishap, { type: 'MISHAP_RESOLVED' }).status,
      'MUSTERING_OUT'
    )
  })

  it('validates persisted status strings before hydration', () => {
    assert.equal(isCareerCreationStatus('SURVIVAL'), true)
    assert.equal(isCareerCreationStatus('UNKNOWN'), false)
    assert.equal(isCareerCreationStatus(undefined), false)
  })
})

describe('career ruleset helpers', () => {
  it('parses and evaluates characteristic and plain target checks', () => {
    assert.deepEqual(parseCareerCheck('End 7+'), {
      characteristic: 'end',
      target: 7
    })
    assert.deepEqual(parseCareerCheck('6+'), {
      characteristic: null,
      target: 6
    })
    assert.equal(parseCareerCheck('-'), null)

    assert.equal(characteristicModifier(9), 1)
    assert.equal(characteristicModifier(null), 0)
    assert.deepEqual(
      evaluateCareerCheck({
        check: 'End 7+',
        characteristics,
        roll: 6,
        dm: -1
      }),
      {
        check: { characteristic: 'end', target: 7 },
        modifier: 0,
        total: 6,
        success: false
      }
    )
    assert.deepEqual(
      evaluateCareerCheck({
        check: '6+',
        characteristics,
        roll: 5,
        dm: 1
      }),
      {
        check: { characteristic: null, target: 6 },
        modifier: 1,
        total: 6,
        success: true
      }
    )
  })

  it('derives career qualification modifiers and available careers', () => {
    assert.equal(deriveCareerQualificationDm(0), 0)
    assert.equal(deriveCareerQualificationDm(2), -4)
    assert.equal(deriveCareerQualificationDm(-1), 0)
    assert.deepEqual(availableCareerNames(careerBasics, ['Scout']), [
      'Marine',
      'Drifter'
    ])
    assert.deepEqual(availableCareerNames(careerBasics, ['Drifter']), [
      'Scout',
      'Marine',
      'Drifter'
    ])
  })

  it('derives basic training plans without mutating service skill tables', () => {
    assert.deepEqual(
      deriveBasicTrainingPlan({
        career: 'Scout',
        serviceSkills,
        completedTermCount: 0,
        previousCareerNames: []
      }),
      {
        kind: 'all',
        skills: ['Pilot', 'Vacc Suit', 'Mechanics']
      }
    )
    assert.deepEqual(
      deriveBasicTrainingPlan({
        career: 'Marine',
        serviceSkills,
        completedTermCount: 2,
        previousCareerNames: ['Scout']
      }),
      {
        kind: 'choose-one',
        skills: ['Gun Combat', 'Tactics']
      }
    )
    assert.deepEqual(
      deriveBasicTrainingPlan({
        career: 'Scout',
        serviceSkills,
        completedTermCount: 2,
        previousCareerNames: ['Scout']
      }),
      {
        kind: 'none',
        skills: []
      }
    )
  })

  it('derives post-survival commission and advancement options', () => {
    assert.deepEqual(deriveSurvivalPromotionOptions(careerBasics.Marine, 0), {
      canCommission: true,
      canAdvance: false
    })
    assert.deepEqual(deriveSurvivalPromotionOptions(careerBasics.Marine, 1), {
      canCommission: false,
      canAdvance: true
    })
    assert.deepEqual(deriveSurvivalPromotionOptions(careerBasics.Scout, 1), {
      canCommission: false,
      canAdvance: false
    })
  })
})
