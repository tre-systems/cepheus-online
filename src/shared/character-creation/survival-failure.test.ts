import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  deriveSurvivalFailurePendingDecision,
  resolveInjuryOutcome,
  resolveInjuryLosses,
  resolveSurvivalFailureOutcome,
  resolveSurvivalMishapOutcome
} from './survival-failure'

describe('survival failure outcomes', () => {
  it('models failed survival as death unless a mishap roll is supplied', () => {
    const outcome = resolveSurvivalFailureOutcome({
      career: 'Scout',
      survival: { total: 2, outcome: 'fail' }
    })

    assert.deepEqual(outcome, {
      type: 'death',
      career: 'Scout',
      survival: { total: 2, outcome: 'fail' },
      reason: 'failed_survival'
    })
    assert.deepEqual(deriveSurvivalFailurePendingDecision(outcome), {
      key: 'survivalResolution'
    })
  })

  it('models optional SRD mishaps as forced half-term career exits', () => {
    const outcome = resolveSurvivalFailureOutcome({
      career: 'Marine',
      survival: { total: 5, outcome: 'fail' },
      mishap: { total: 3 }
    })

    assert.deepEqual(outcome, {
      type: 'mishap',
      career: 'Marine',
      survival: { total: 5, outcome: 'fail' },
      mishap: {
        career: 'Marine',
        roll: 3,
        id: 'legal_battle_debt',
        description:
          'Honorably discharged after a long legal battle, creating Cr10,000 debt.',
        discharge: 'honorable',
        benefitEffect: 'forfeit_current_term',
        debtCredits: 10000,
        extraServiceYears: 0,
        injury: null
      },
      forcedCareerExit: true,
      servedYears: 2,
      forfeitCurrentTermBenefit: true
    })
    assert.deepEqual(deriveSurvivalFailurePendingDecision(outcome), {
      key: 'mishapResolution'
    })
  })

  it('resolves each SRD survival mishap table result', () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6].map((total) =>
        resolveSurvivalMishapOutcome({ career: 'Aerospace', roll: { total } })
      ),
      [
        {
          career: 'Aerospace',
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
        },
        {
          career: 'Aerospace',
          roll: 2,
          id: 'honorable_discharge',
          description: 'Honorably discharged from the service.',
          discharge: 'honorable',
          benefitEffect: 'forfeit_current_term',
          debtCredits: 0,
          extraServiceYears: 0,
          injury: null
        },
        {
          career: 'Aerospace',
          roll: 3,
          id: 'legal_battle_debt',
          description:
            'Honorably discharged after a long legal battle, creating Cr10,000 debt.',
          discharge: 'honorable',
          benefitEffect: 'forfeit_current_term',
          debtCredits: 10000,
          extraServiceYears: 0,
          injury: null
        },
        {
          career: 'Aerospace',
          roll: 4,
          id: 'dishonorable_discharge',
          description:
            'Dishonorably discharged from the service. Lose all benefits.',
          discharge: 'dishonorable',
          benefitEffect: 'lose_all',
          debtCredits: 0,
          extraServiceYears: 0,
          injury: null
        },
        {
          career: 'Aerospace',
          roll: 5,
          id: 'prison_discharge',
          description:
            'Dishonorably discharged after serving an extra 4 years in prison. Lose all benefits.',
          discharge: 'dishonorable',
          benefitEffect: 'lose_all',
          debtCredits: 0,
          extraServiceYears: 4,
          injury: null
        },
        {
          career: 'Aerospace',
          roll: 6,
          id: 'medical_discharge',
          description:
            'Medically discharged from the service. Roll on the Injury table.',
          discharge: 'medical',
          benefitEffect: 'forfeit_current_term',
          debtCredits: 0,
          extraServiceYears: 0,
          injury: { type: 'roll' }
        }
      ]
    )
  })

  it('resolves and clamps SRD injury table results', () => {
    assert.equal(
      resolveInjuryOutcome({ career: 'Marine', roll: { total: -3 } }).id,
      'nearly_killed'
    )
    assert.equal(
      resolveInjuryOutcome({ career: 'Marine', roll: { total: 9 } }).id,
      'lightly_injured'
    )
    assert.equal(
      resolveInjuryOutcome({ career: 'Marine', roll: { total: 6 } }).crisisRisk,
      false
    )
  })

  it('resolves permanent injury losses without client-authored modifiers', () => {
    const characteristics = {
      str: 7,
      dex: 8,
      end: 6,
      int: 9,
      edu: 8,
      soc: 5
    }

    assert.deepEqual(
      resolveInjuryLosses({
        characteristics,
        injury: resolveInjuryOutcome({ career: 'Marine', roll: { total: 4 } }),
        primaryCharacteristic: 'end'
      }),
      {
        ok: true,
        value: {
          selectedLosses: [{ characteristic: 'end', modifier: -2 }],
          characteristicPatch: { end: 4 }
        }
      }
    )

    assert.deepEqual(
      resolveInjuryLosses({
        characteristics,
        injury: resolveInjuryOutcome({ career: 'Marine', roll: { total: 3 } }),
        primaryCharacteristic: 'end'
      }),
      {
        ok: false,
        error: {
          code: 'injury_invalid_primary_target',
          message: 'end cannot receive this injury'
        }
      }
    )
  })

  it('resolves severe and nearly killed injury choices from server severity rolls', () => {
    const characteristics = {
      str: 7,
      dex: 8,
      end: 6,
      int: 9,
      edu: 8,
      soc: 5
    }

    assert.deepEqual(
      resolveInjuryLosses({
        characteristics,
        injury: resolveInjuryOutcome({ career: 'Scout', roll: { total: 2 } }),
        primaryCharacteristic: 'str',
        severityRoll: 5
      }),
      {
        ok: true,
        value: {
          selectedLosses: [{ characteristic: 'str', modifier: -5 }],
          characteristicPatch: { str: 2 }
        }
      }
    )

    assert.deepEqual(
      resolveInjuryLosses({
        characteristics,
        injury: resolveInjuryOutcome({ career: 'Scout', roll: { total: 1 } }),
        primaryCharacteristic: 'str',
        secondaryChoice: { mode: 'both_other_physical' },
        severityRoll: 6
      }),
      {
        ok: true,
        value: {
          selectedLosses: [
            { characteristic: 'str', modifier: -6 },
            { characteristic: 'dex', modifier: -2 },
            { characteristic: 'end', modifier: -2 }
          ],
          characteristicPatch: { str: 1, dex: 6, end: 4 }
        }
      }
    )

    assert.deepEqual(
      resolveInjuryLosses({
        characteristics,
        injury: resolveInjuryOutcome({ career: 'Scout', roll: { total: 1 } }),
        primaryCharacteristic: 'str',
        secondaryChoice: {
          mode: 'one_other_physical',
          characteristic: 'dex'
        },
        severityRoll: 6
      }),
      {
        ok: true,
        value: {
          selectedLosses: [
            { characteristic: 'str', modifier: -6 },
            { characteristic: 'dex', modifier: -4 }
          ],
          characteristicPatch: { str: 1, dex: 4 }
        }
      }
    )
  })
})
