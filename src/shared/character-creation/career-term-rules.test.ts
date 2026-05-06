import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { describe, it } from 'node:test'

import {
  CEPHEUS_SRD_RULESET,
  type CepheusSrdRuleset
} from './cepheus-srd-ruleset'
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
  deriveRemainingCashBenefits,
  deriveCashBenefitRollModifier,
  deriveCareerBenefitCount,
  deriveMaterialBenefitRollModifier,
  resolveCareerBenefit
} from './benefits'

const loadSrdRuleset = (): CepheusSrdRuleset =>
  JSON.parse(
    fs.readFileSync('data/rulesets/srd/cepheus-engine-srd.json', 'utf8')
  ) as CepheusSrdRuleset

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
] satisfies readonly (keyof CepheusSrdRuleset)[]

const skillTableKeys = [
  'serviceSkills',
  'specialistSkills',
  'personalDevelopment',
  'advEducation'
] satisfies readonly (keyof Pick<
  CepheusSrdRuleset,
  'serviceSkills' | 'specialistSkills' | 'personalDevelopment' | 'advEducation'
>)[]

describe('SRD career term rules alignment', () => {
  it('keeps the embedded SRD career data aligned with the source JSON', () => {
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
})
