import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CharacterCharacteristics } from './state'
import {
  availableCareerNames,
  canTransitionCareerCreationState,
  careerSkillWithLevel,
  canCompleteCreation,
  canOfferAnagathics,
  canOfferMusteringBenefit,
  canOfferNewCareer,
  canOfferReenlistment,
  canStartNextCareerTerm,
  characteristicModifier,
  createCareerCreationState,
  createCareerTerm,
  deriveAgingRollModifier,
  deriveAnagathicsModifier,
  deriveBasicTrainingPlan,
  deriveCareerBenefitCount,
  deriveCashBenefitRollModifier,
  deriveCareerQualificationDm,
  deriveMaterialBenefitRollModifier,
  deriveRemainingCashBenefits,
  deriveRemainingCareerBenefits,
  deriveSurvivalPromotionOptions,
  enumerateTermOutcomes,
  evaluateCareerCheck,
  formatCareerSkill,
  isCareerCreationStatus,
  isCascadeCareerSkill,
  mustResolveAging,
  normalizeCareerSkill,
  parseCareerCheck,
  parseCareerSkill,
  parseCareerRankReward,
  payForAnagathics,
  resolveAging,
  resolveAnagathicsUse,
  resolveCareerBenefit,
  resolveCascadeCareerSkill,
  resolveReenlistment,
  selectAgingEffect,
  startDraftCareerTerm,
  startCareerTerm,
  tallyCareerSkills,
  transitionCareerCreationState,
  type CareerBasicsTable,
  type CareerTerm,
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
    assert.deepEqual(
      parseCareerRankReward({
        ranksAndSkills: {
          Navy: {
            '1': 'Ensign [Leadership]',
            '2': 'Lieutenant'
          }
        },
        career: 'Navy',
        rank: 1
      }),
      { rank: 1, title: 'Ensign', bonusSkill: 'Leadership' }
    )
    assert.deepEqual(
      parseCareerRankReward({
        ranksAndSkills: { Athlete: { '1': '-' } },
        career: 'Athlete',
        rank: 1
      }),
      { rank: 1, title: '', bonusSkill: null }
    )
  })
})

describe('career skill helpers', () => {
  it('parses, formats, normalizes, and tallies career skills', () => {
    assert.deepEqual(parseCareerSkill('Gun Combat-1'), {
      name: 'Gun Combat',
      level: 1
    })
    assert.deepEqual(parseCareerSkill('Jack-of-all-Trades-0'), {
      name: 'Jack-of-all-Trades',
      level: 0
    })
    assert.deepEqual(parseCareerSkill('Pilot'), { name: 'Pilot', level: 0 })
    assert.equal(parseCareerSkill(''), null)
    assert.equal(formatCareerSkill({ name: 'Pilot', level: 2 }), 'Pilot-2')
    assert.equal(isCascadeCareerSkill('Gun Combat*'), true)
    assert.equal(careerSkillWithLevel('Gun Combat*', 0), 'Gun Combat-0')
    assert.equal(normalizeCareerSkill('Pilot', 1), 'Pilot-1')
    assert.equal(normalizeCareerSkill('Pilot-2', 1), 'Pilot-2')
    assert.equal(normalizeCareerSkill('Gun Combat*', 0), 'Gun Combat-0')
    assert.equal(normalizeCareerSkill('  '), null)

    assert.deepEqual(
      tallyCareerSkills([
        'Pilot-1',
        'Gun Combat-0',
        'Pilot-1',
        'Animals*',
        'Jack-of-all-Trades-0'
      ]),
      ['Pilot-2', 'Gun Combat-0', 'Jack-of-all-Trades-0']
    )
  })

  it('resolves cascade selections into background, career, or nested queues', () => {
    assert.deepEqual(
      resolveCascadeCareerSkill({
        pendingCascadeSkills: ['Gun Combat-1', 'Animals-0'],
        careerSkills: ['Pilot-1'],
        termSkills: ['Pilot-1'],
        cascadeSkill: 'Gun Combat-1',
        selection: 'Slug Pistol'
      }),
      {
        pendingCascadeSkills: ['Animals-0'],
        backgroundSkills: [],
        careerSkills: ['Pilot-1', 'Slug Pistol-1'],
        termSkills: ['Pilot-1', 'Slug Pistol-1']
      }
    )

    assert.deepEqual(
      resolveCascadeCareerSkill({
        pendingCascadeSkills: ['Animals-0'],
        backgroundSkills: ['Streetwise-0'],
        cascadeSkill: 'Animals-0',
        selection: 'Riding',
        basicTraining: true
      }),
      {
        pendingCascadeSkills: [],
        backgroundSkills: ['Streetwise-0', 'Riding-0'],
        careerSkills: [],
        termSkills: ['Riding-0']
      }
    )

    assert.deepEqual(
      resolveCascadeCareerSkill({
        pendingCascadeSkills: ['Science-1'],
        cascadeSkill: 'Science-1',
        selection: 'Life Sciences*'
      }).pendingCascadeSkills,
      ['Life Sciences-1']
    )
  })
})

describe('career term outcome helpers', () => {
  it('enumerates survival, promotion, and reenlistment outcomes', () => {
    const outcomes = enumerateTermOutcomes({
      canCommission: true,
      canAdvance: false,
      canReenlist: true
    })

    assert.equal(outcomes.length, 13)
    assert.deepEqual(outcomes[0], {
      id: 'survival-fail',
      survival: 'fail',
      commission: 'na',
      advancement: 'na',
      reenlistment: 'blocked',
      decision: 'na',
      result: 'MISHAP'
    })
    assert.equal(
      outcomes.some(
        (outcome) =>
          outcome.id ===
          'survival-pass__commission-pass__advancement-na__reenlist-forced__decision-na'
      ),
      true
    )
  })

  it('collapses reenlistment choices when blocked or forced to retire', () => {
    assert.deepEqual(
      enumerateTermOutcomes({ canReenlist: false }).map(
        (outcome) => outcome.result
      ),
      ['MISHAP', 'MUSTERING_OUT']
    )
    assert.deepEqual(
      enumerateTermOutcomes({ mustRetire: true }).map(
        (outcome) => outcome.reenlistment
      ),
      ['blocked', 'retire']
    )
  })
})

describe('mustering-out and aging helpers', () => {
  const scoutTerm = createCareerTerm({ career: 'Scout' })

  const benefitTables = {
    materialBenefits: {
      Scout: {
        '1': 'Low Passage',
        '2': '+1 Edu',
        '6': 'Courier Vessel'
      }
    },
    cashBenefits: {
      Scout: {
        '1': 20000,
        '2': '30000',
        '6': '50000'
      }
    }
  }

  const agingTable = [
    {
      Roll: -2,
      Effects: 'Reduce one physical characteristic by 1.',
      Changes: [{ type: 'PHYSICAL' as const, modifier: -1 }]
    },
    {
      Roll: -1,
      Effects: 'Reduce one physical characteristic by 1.',
      Changes: [{ type: 'PHYSICAL' as const, modifier: -1 }]
    },
    {
      Roll: 1,
      Effects: 'No effect.'
    }
  ]

  const completeAgingTable = [
    {
      Roll: -1,
      Effects: 'Reduce one physical characteristic by 1.',
      Changes: [{ type: 'PHYSICAL' as const, modifier: -1 }]
    },
    {
      Roll: 0,
      Effects: 'Reduce one physical characteristic by 1.',
      Changes: [{ type: 'PHYSICAL' as const, modifier: -1 }]
    },
    {
      Roll: 1,
      Effects: 'No effect.'
    }
  ]

  it('derives benefit counts and resolves cash or material rolls', () => {
    assert.equal(
      deriveCareerBenefitCount({ termsInCareer: 3, currentRank: 0 }),
      3
    )
    assert.equal(
      deriveCareerBenefitCount({ termsInCareer: 3, currentRank: 1 }),
      4
    )
    assert.equal(
      deriveCareerBenefitCount({ termsInCareer: 3, currentRank: 3 }),
      5
    )
    assert.equal(
      deriveCareerBenefitCount({ termsInCareer: 3, currentRank: 5 }),
      6
    )
    assert.equal(
      deriveRemainingCareerBenefits({
        termsInCareer: 3,
        currentRank: 5,
        benefitsReceived: 2
      }),
      4
    )
    assert.equal(
      deriveRemainingCareerBenefits({
        termsInCareer: 1,
        currentRank: 0,
        benefitsReceived: 4
      }),
      0
    )
    assert.equal(
      deriveCashBenefitRollModifier({ retired: true, hasGambling: true }),
      2
    )
    assert.equal(deriveMaterialBenefitRollModifier({ currentRank: 5 }), 1)
    assert.equal(deriveRemainingCashBenefits({ cashBenefitsReceived: 1 }), 2)
    assert.equal(deriveRemainingCashBenefits({ cashBenefitsReceived: 4 }), 0)

    assert.deepEqual(
      resolveCareerBenefit({
        tables: benefitTables,
        career: 'Scout',
        roll: 9,
        kind: 'material'
      }),
      {
        kind: 'material',
        value: 'Courier Vessel',
        credits: 0
      }
    )
    assert.deepEqual(
      resolveCareerBenefit({
        tables: benefitTables,
        career: 'Scout',
        roll: 2,
        kind: 'cash'
      }),
      {
        kind: 'cash',
        value: '30000',
        credits: 30000
      }
    )
  })

  it('selects and resolves clamped aging effects without mutating rules data', () => {
    assert.equal(selectAgingEffect(completeAgingTable, 0)?.Roll, 0)
    assert.equal(selectAgingEffect(agingTable, -8)?.Roll, -2)
    assert.equal(selectAgingEffect(agingTable, 8)?.Roll, 1)

    const resolved = resolveAging({
      currentAge: 34,
      table: agingTable,
      roll: -8
    })

    assert.deepEqual(resolved, {
      age: 38,
      message: 'Reduce one physical characteristic by 1.',
      characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
    })

    resolved.characteristicChanges[0].modifier = -9
    assert.deepEqual(agingTable[0].Changes, [
      { type: 'PHYSICAL', modifier: -1 }
    ])

    assert.deepEqual(
      resolveAging({ currentAge: null, table: agingTable, roll: 8 }),
      {
        age: 22,
        message: 'No aging effects.',
        characteristicChanges: []
      }
    )
  })

  it('treats SRD aging roll 0 as the represented aging-table effect', () => {
    const srdAgingTable = [
      {
        Roll: 0,
        Effects: 'Reduce one physical characteristic by 1',
        Changes: [{ type: 'PHYSICAL' as const, modifier: -1 }]
      },
      {
        Roll: 1,
        Effects: 'No effect',
        Changes: []
      }
    ]

    assert.deepEqual(
      resolveAging({ currentAge: 34, table: srdAgingTable, roll: 0 }),
      {
        age: 38,
        message: 'Reduce one physical characteristic by 1',
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      }
    )
  })

  it('creates, completes, and starts career terms without mutating inputs', () => {
    const existingTerm = {
      ...createCareerTerm({ career: 'Scout' }),
      skills: ['Pilot-1']
    }
    const existingTerms = [existingTerm]
    const careers = [{ name: 'Scout', rank: 1 }]

    const started = startCareerTerm({
      career: 'Scout',
      terms: existingTerms,
      careers
    })

    assert.equal(started.terms.length, 2)
    assert.equal(started.terms[0].complete, true)
    assert.equal(started.terms[1].career, 'Scout')
    assert.equal(started.terms[1].completedBasicTraining, true)
    assert.deepEqual(started.careers, careers)
    assert.equal(started.canEnterDraft, true)
    assert.equal(started.failedToQualify, false)
    assert.equal(existingTerm.complete, false)

    const drafted = startCareerTerm({
      career: 'Marine',
      terms: [],
      careers: [],
      drafted: true
    })
    assert.equal(drafted.canEnterDraft, false)
    assert.equal(drafted.terms[0].draft, 1)
    assert.deepEqual(drafted.careers, [{ name: 'Marine', rank: 0 }])

    const draftStarted = startDraftCareerTerm({
      draftTable: [
        'Aerospace',
        'Marine',
        'Maritime Defense',
        'Navy',
        'Scout',
        'Surface Defense'
      ],
      roll: 5,
      terms: [],
      careers: []
    })
    assert.deepEqual(draftStarted?.draft, { roll: 5, career: 'Scout' })
    assert.equal(draftStarted?.terms[0].career, 'Scout')
    assert.equal(draftStarted?.terms[0].draft, 1)
    assert.equal(draftStarted?.canEnterDraft, false)
  })

  it('derives aging modifiers and anagathics payment effects', () => {
    const terms: CareerTerm[] = [
      { ...createCareerTerm({ career: 'Scout' }), anagathics: true },
      { ...createCareerTerm({ career: 'Scout' }), anagathics: false },
      { ...createCareerTerm({ career: 'Scout' }), anagathics: true }
    ]

    assert.equal(deriveAnagathicsModifier(terms), 2)
    assert.equal(deriveAgingRollModifier(terms), -1)

    const paid = payForAnagathics({
      credits: 10000,
      terms,
      cost: 5000
    })

    assert.equal(paid.credits, 5000)
    assert.equal(paid.terms[2].anagathicsCost, 5000)
    assert.equal(terms[2].anagathicsCost, undefined)

    assert.deepEqual(resolveAnagathicsUse({ term: scoutTerm, survived: true }), {
      term: {
        ...scoutTerm,
        anagathics: true
      },
      survived: true
    })
  })

  it('decides whether a character must age or can start another term', () => {
    assert.equal(mustResolveAging({ age: 18, termCount: 0 }), false)
    assert.equal(mustResolveAging({ age: 18, termCount: 1 }), true)
    assert.equal(mustResolveAging({ age: 22, termCount: 1 }), false)

    assert.equal(
      canStartNextCareerTerm({
        termCount: 1,
        term: scoutTerm
      }),
      true
    )
    assert.equal(
      canStartNextCareerTerm({
        termCount: 7,
        term: scoutTerm
      }),
      false
    )
    assert.equal(
      canStartNextCareerTerm({
        termCount: 1,
        term: { ...scoutTerm, career: 'Drifter' }
      }),
      false
    )
  })

  it('gates anagathics, reenlistment, benefits, new career, and completion', () => {
    assert.equal(canOfferAnagathics({ term: scoutTerm }), true)
    assert.equal(
      canOfferAnagathics({
        term: { ...scoutTerm, survival: 8 }
      }),
      false
    )
    assert.equal(
      canOfferReenlistment({
        term: { ...scoutTerm, skillsAndTraining: ['Pilot-1'] }
      }),
      true
    )
    assert.equal(
      canOfferReenlistment({
        term: { ...scoutTerm, skillsAndTraining: ['Pilot-1'] },
        mustAge: true
      }),
      false
    )
    assert.equal(canOfferMusteringBenefit({ remainingBenefits: 1 }), true)
    assert.equal(
      canOfferNewCareer({ termCount: 6, remainingBenefits: 0 }),
      true
    )
    assert.equal(
      canOfferNewCareer({ termCount: 7, remainingBenefits: 0 }),
      false
    )
    assert.equal(
      canCompleteCreation({
        terms: [{ ...scoutTerm, complete: true }]
      }),
      true
    )
  })

  it('resolves reenlistment retirement, forced, allowed, and blocked paths', () => {
    assert.deepEqual(
      resolveReenlistment({
        term: scoutTerm,
        termCount: 7,
        roll: 8,
        check: '6+',
        characteristics
      }),
      {
        outcome: 'retire',
        message: 'Your character must retire.',
        term: {
          ...scoutTerm,
          musteringOut: true,
          canReenlist: false,
          complete: true
        },
        nextTermCareer: null
      }
    )

    assert.deepEqual(
      resolveReenlistment({
        term: scoutTerm,
        termCount: 2,
        roll: 12,
        check: '6+',
        characteristics
      }),
      {
        outcome: 'forced',
        message: 'Your character must reenlist.',
        term: {
          ...scoutTerm,
          reEnlistment: 12
        },
        nextTermCareer: 'Scout'
      }
    )

    const allowed = resolveReenlistment({
      term: scoutTerm,
      termCount: 2,
      roll: 7,
      check: '6+',
      characteristics
    })
    assert.equal(allowed.outcome, 'allowed')
    assert.equal(allowed.term.reEnlistment, 7)

    const blocked = resolveReenlistment({
      term: scoutTerm,
      termCount: 2,
      roll: 5,
      check: '6+',
      characteristics
    })
    assert.equal(blocked.outcome, 'blocked')
    assert.equal(blocked.term.musteringOut, true)
    assert.equal(blocked.term.canReenlist, false)
  })
})
