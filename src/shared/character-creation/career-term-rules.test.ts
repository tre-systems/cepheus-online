import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { describe, it } from 'node:test'

import { CEPHEUS_SRD_RULESET, type CepheusRuleset } from './cepheus-srd-ruleset'
import {
  availableCareerNames,
  deriveBasicTrainingPlan,
  deriveCareerQualificationDm,
  deriveFailedQualificationOptions,
  deriveSurvivalPromotionOptions,
  parseCareerCheck,
  parseCareerRankReward,
  resolveDraftCareer
} from './career-rules'
import { resolveCareerSkillTableRoll } from './skills'
import {
  canRollCashBenefit,
  deriveCareerTermCashBenefitCount,
  deriveCareerTermMusteringBenefitCount,
  deriveRemainingCashBenefits,
  deriveCashBenefitRollModifier,
  deriveCareerBenefitCount,
  deriveCareerBenefitEligibleTermCount,
  deriveLegacyCareerTermCashBenefitCount,
  deriveLegacyCareerTermMusteringBenefitCount,
  deriveMaterialBenefitEffect,
  deriveMaterialBenefitRollModifier,
  deriveProjectedCareerTermCashBenefitCount,
  deriveProjectedCareerTermMusteringBenefitCount,
  normalizeMaterialBenefitValue,
  deriveRemainingCareerBenefitsForCareer,
  resolveCareerBenefit
} from './benefits'

const loadSrdRuleset = (): CepheusRuleset =>
  JSON.parse(
    fs.readFileSync('data/rulesets/cepheus-engine-srd.json', 'utf8')
  ) as CepheusRuleset

const relevantRulesetKeys = [
  'careerBasics',
  'theDraft',
  'ranksAndSkills',
  'serviceSkills',
  'specialistSkills',
  'personalDevelopment',
  'advEducation',
  'materialBenefits',
  'cashBenefits'
] satisfies readonly (keyof CepheusRuleset)[]

const skillTableKeys = [
  'serviceSkills',
  'specialistSkills',
  'personalDevelopment',
  'advEducation'
] satisfies readonly (keyof Pick<
  CepheusRuleset,
  'serviceSkills' | 'specialistSkills' | 'personalDevelopment' | 'advEducation'
>)[]

describe('SRD career term rules alignment', () => {
  it('keeps the loaded SRD career data aligned with the source JSON', () => {
    const source = loadSrdRuleset()

    for (const key of relevantRulesetKeys) {
      assert.deepEqual(
        CEPHEUS_SRD_RULESET[key],
        source[key],
        `${key} should match the SRD JSON source`
      )
    }
  })

  it('derives qualification penalties, available careers, and failed options', () => {
    assert.equal(deriveCareerQualificationDm(0), 0)
    assert.equal(deriveCareerQualificationDm(1), -2)
    assert.equal(deriveCareerQualificationDm(3), -6)

    assert.equal(
      availableCareerNames(CEPHEUS_SRD_RULESET.careerBasics, [
        'Scout'
      ]).includes('Scout'),
      false
    )
    assert.equal(
      availableCareerNames(CEPHEUS_SRD_RULESET.careerBasics, [
        'Drifter'
      ]).includes('Drifter'),
      true
    )

    assert.deepEqual(deriveFailedQualificationOptions(), ['Drifter', 'Draft'])
    assert.deepEqual(
      deriveFailedQualificationOptions({ canEnterDraft: false }),
      ['Drifter']
    )
    assert.deepEqual(CEPHEUS_SRD_RULESET.theDraft, [
      'Aerospace',
      'Marine',
      'Maritime Defense',
      'Navy',
      'Scout',
      'Surface Defense'
    ])
  })

  it('resolves the SRD draft table from a 1d6 roll', () => {
    assert.deepEqual(
      CEPHEUS_SRD_RULESET.theDraft.map((_career, index) =>
        resolveDraftCareer({
          table: CEPHEUS_SRD_RULESET.theDraft,
          roll: index + 1
        })
      ),
      [
        { roll: 1, career: 'Aerospace' },
        { roll: 2, career: 'Marine' },
        { roll: 3, career: 'Maritime Defense' },
        { roll: 4, career: 'Navy' },
        { roll: 5, career: 'Scout' },
        { roll: 6, career: 'Surface Defense' }
      ]
    )

    assert.deepEqual(
      resolveDraftCareer({ table: CEPHEUS_SRD_RULESET.theDraft, roll: 9 }),
      { roll: 6, career: 'Surface Defense' }
    )
    assert.equal(resolveDraftCareer({ table: [], roll: 1 }), null)
  })

  it('derives basic training from SRD service skill tables', () => {
    assert.deepEqual(
      deriveBasicTrainingPlan({
        career: 'Scout',
        serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
        completedTermCount: 0,
        previousCareerNames: []
      }),
      {
        kind: 'all',
        skills: [
          'Comms',
          'Electronics',
          'Gun Combat*',
          'Gunnery*',
          'Recon',
          'Piloting'
        ]
      }
    )

    assert.deepEqual(
      deriveBasicTrainingPlan({
        career: 'Merchant',
        serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
        completedTermCount: 1,
        previousCareerNames: ['Scout']
      }),
      {
        kind: 'choose-one',
        skills: [
          'Comms',
          'Engineering',
          'Gun Combat*',
          'Melee Combat*',
          'Broker',
          'Vehicle*'
        ]
      }
    )

    assert.equal(
      deriveBasicTrainingPlan({
        career: 'Scout',
        serviceSkills: CEPHEUS_SRD_RULESET.serviceSkills,
        completedTermCount: 1,
        previousCareerNames: ['Scout']
      }).kind,
      'none'
    )
  })

  it('derives survival promotion gates from SRD commission and advancement checks', () => {
    for (const [career, basics] of Object.entries(
      CEPHEUS_SRD_RULESET.careerBasics
    )) {
      const commissionExists = parseCareerCheck(basics.Commission) !== null
      const advancementExists = parseCareerCheck(basics.Advancement) !== null

      assert.deepEqual(
        deriveSurvivalPromotionOptions(basics, 0),
        {
          canCommission: commissionExists,
          canAdvance: false
        },
        `${career} rank 0 promotion gates`
      )
      assert.deepEqual(
        deriveSurvivalPromotionOptions(basics, 1),
        {
          canCommission: false,
          canAdvance: advancementExists
        },
        `${career} rank 1 promotion gates`
      )
    }
  })

  it('resolves SRD skill table rolls by career and clamps out-of-range rolls', () => {
    for (const tableKey of skillTableKeys) {
      const table = CEPHEUS_SRD_RULESET[tableKey]

      for (const [career, entries] of Object.entries(table)) {
        for (const [roll, skill] of Object.entries(entries)) {
          assert.equal(
            resolveCareerSkillTableRoll({
              table,
              career,
              roll: Number(roll)
            }),
            skill,
            `${career} ${tableKey} roll ${roll}`
          )
        }

        assert.equal(
          resolveCareerSkillTableRoll({ table, career, roll: 0 }),
          entries['1']
        )
        assert.equal(
          resolveCareerSkillTableRoll({ table, career, roll: 9 }),
          entries['6']
        )
      }
    }
  })

  it('parses SRD rank titles and rewards without changing the source values', () => {
    assert.deepEqual(
      parseCareerRankReward({
        ranksAndSkills: CEPHEUS_SRD_RULESET.ranksAndSkills,
        career: 'Scout',
        rank: 0
      }),
      { rank: 0, title: '', bonusSkill: 'Piloting' }
    )
    assert.deepEqual(
      parseCareerRankReward({
        ranksAndSkills: CEPHEUS_SRD_RULESET.ranksAndSkills,
        career: 'Aerospace',
        rank: 0
      }),
      { rank: 0, title: 'Airman', bonusSkill: 'Aircraft*' }
    )
    assert.deepEqual(
      parseCareerRankReward({
        ranksAndSkills: CEPHEUS_SRD_RULESET.ranksAndSkills,
        career: 'Aerospace',
        rank: 3
      }),
      { rank: 3, title: 'Squadron Leader', bonusSkill: 'Leadership' }
    )
  })

  it('derives SRD mustering benefit counts, modifiers, and table results', () => {
    assert.equal(
      deriveCareerBenefitCount({ termsInCareer: 4, currentRank: 6 }),
      7
    )
    assert.equal(deriveCashBenefitRollModifier({ retired: true }), 1)
    assert.equal(deriveCashBenefitRollModifier({ hasGambling: true }), 1)
    assert.equal(deriveMaterialBenefitRollModifier({ currentRank: 5 }), 1)
    assert.equal(deriveRemainingCashBenefits({ cashBenefitsReceived: 2 }), 1)
    assert.equal(deriveRemainingCashBenefits({ cashBenefitsReceived: 3 }), 0)
    assert.equal(canRollCashBenefit({ cashBenefitsReceived: 2 }), true)
    assert.equal(canRollCashBenefit({ cashBenefitsReceived: 3 }), false)
    const termWithFacts = {
      benefits: ['1000', 'Low Passage', '2000'],
      facts: {
        musteringBenefits: [
          {
            career: 'Scout',
            kind: 'cash' as const,
            roll: { expression: '2d6' as const, rolls: [1, 2], total: 3 },
            modifier: 0,
            tableRoll: 3,
            value: '1000',
            credits: 1000,
            materialItem: null
          },
          {
            career: 'Scout',
            kind: 'material' as const,
            roll: { expression: '2d6' as const, rolls: [3, 3], total: 6 },
            modifier: 0,
            tableRoll: 6,
            value: 'Low Passage',
            credits: 0,
            materialItem: 'Low Passage'
          },
          {
            career: 'Scout',
            kind: 'cash' as const,
            roll: { expression: '2d6' as const, rolls: [4, 4], total: 8 },
            modifier: 0,
            tableRoll: 8,
            value: '2000',
            credits: 2000,
            materialItem: null
          }
        ]
      }
    }
    const legacyTerm = {
      benefits: ['1000', 'Low Passage', '2000'],
      facts: undefined
    }
    const projectedTermWithoutMusteringFacts = {
      benefits: ['1000', 'Low Passage', '2000'],
      facts: {}
    }
    const semanticTermWithoutMusteringFacts = {
      benefits: ['1000', 'Low Passage', '2000'],
      facts: {
        survival: {
          passed: true,
          canCommission: false,
          canAdvance: true,
          survival: {
            expression: '2d6' as const,
            rolls: [4, 4],
            total: 8,
            characteristic: 'end' as const,
            modifier: 0,
            target: 7,
            success: true
          }
        }
      }
    }
    assert.equal(
      deriveProjectedCareerTermMusteringBenefitCount(termWithFacts),
      3
    )
    assert.equal(deriveProjectedCareerTermCashBenefitCount(termWithFacts), 2)
    assert.equal(deriveLegacyCareerTermMusteringBenefitCount(legacyTerm), 3)
    assert.equal(deriveLegacyCareerTermCashBenefitCount(legacyTerm), 2)
    assert.equal(deriveCareerTermMusteringBenefitCount(termWithFacts), 3)
    assert.equal(deriveCareerTermCashBenefitCount(termWithFacts), 2)
    assert.equal(deriveCareerTermMusteringBenefitCount(legacyTerm), 3)
    assert.equal(deriveCareerTermCashBenefitCount(legacyTerm), 2)
    assert.equal(
      deriveCareerTermMusteringBenefitCount(projectedTermWithoutMusteringFacts),
      0
    )
    assert.equal(
      deriveCareerTermCashBenefitCount(projectedTermWithoutMusteringFacts),
      0
    )
    assert.equal(
      deriveCareerTermMusteringBenefitCount(semanticTermWithoutMusteringFacts),
      0
    )
    assert.equal(
      deriveCareerTermCashBenefitCount(semanticTermWithoutMusteringFacts),
      0
    )

    assert.deepEqual(
      resolveCareerBenefit({
        tables: CEPHEUS_SRD_RULESET,
        career: 'Scout',
        roll: 9,
        kind: 'material'
      }),
      { kind: 'material', value: '-', credits: 0 }
    )
    assert.deepEqual(
      resolveCareerBenefit({
        tables: CEPHEUS_SRD_RULESET,
        career: 'Merchant',
        roll: 4,
        kind: 'cash'
      }),
      { kind: 'cash', value: '20000', credits: 20000 }
    )
  })

  it('applies mishap benefit forfeiture to projected mustering entitlement', () => {
    const survivedTerm = {
      career: 'Scout',
      benefits: [],
      facts: {}
    }
    const forfeitedTerm = {
      career: 'Scout',
      benefits: [],
      facts: {
        mishap: {
          roll: { expression: '1d6' as const, rolls: [2], total: 2 },
          outcome: {
            career: 'Scout',
            roll: 2,
            id: 'honorable_discharge',
            description: 'Honorably discharged from the service.',
            discharge: 'honorable' as const,
            benefitEffect: 'forfeit_current_term' as const,
            debtCredits: 0,
            extraServiceYears: 0,
            injury: null
          }
        }
      }
    }
    const lostAllTerm = {
      career: 'Scout',
      benefits: [],
      facts: {
        mishap: {
          roll: { expression: '1d6' as const, rolls: [4], total: 4 },
          outcome: {
            career: 'Scout',
            roll: 4,
            id: 'dishonorable_discharge',
            description:
              'Dishonorably discharged from the service. Lose all benefits.',
            discharge: 'dishonorable' as const,
            benefitEffect: 'lose_all' as const,
            debtCredits: 0,
            extraServiceYears: 0,
            injury: null
          }
        }
      }
    }

    assert.equal(
      deriveCareerBenefitEligibleTermCount({
        terms: [survivedTerm, forfeitedTerm],
        career: 'Scout'
      }),
      1
    )
    assert.equal(
      deriveRemainingCareerBenefitsForCareer({
        terms: [survivedTerm, forfeitedTerm],
        career: 'Scout',
        currentRank: 0
      }),
      1
    )
    assert.equal(
      deriveRemainingCareerBenefitsForCareer({
        terms: [survivedTerm, forfeitedTerm],
        career: 'Scout',
        currentRank: 5
      }),
      4
    )
    assert.equal(
      deriveRemainingCareerBenefitsForCareer({
        terms: [survivedTerm, lostAllTerm],
        career: 'Scout',
        currentRank: 5
      }),
      0
    )
  })

  it('normalizes and classifies material mustering benefits', () => {
    assert.equal(
      normalizeMaterialBenefitValue('1D6  Ship Shares'),
      '1D6 Ship Shares'
    )
    assert.deepEqual(deriveMaterialBenefitEffect('-'), { kind: 'none' })
    assert.deepEqual(deriveMaterialBenefitEffect('+1 Edu'), {
      kind: 'characteristic',
      characteristic: 'edu',
      modifier: 1
    })
    assert.deepEqual(deriveMaterialBenefitEffect('High  Passage'), {
      kind: 'equipment',
      item: 'High Passage'
    })
  })
})
