import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  deriveRequiredTermSkillCount,
  deriveSurvivalPromotionOptions
} from './career-rules'

describe('career rule helpers', () => {
  it('requires two term skill rolls for careers without commission', () => {
    assert.equal(
      deriveRequiredTermSkillCount({
        Commission: '-',
      }),
      2
    )
    assert.equal(
      deriveRequiredTermSkillCount({
        Commission: 'Soc 7+'
      }),
      1
    )
  })

  it('derives promotion options from rank and career tables', () => {
    assert.deepEqual(
      deriveSurvivalPromotionOptions(
        { Commission: 'Soc 7+', Advancement: 'Edu 6+' },
        0
      ),
      { canCommission: true, canAdvance: false }
    )
    assert.deepEqual(
      deriveSurvivalPromotionOptions(
        { Commission: '-', Advancement: '-' },
        0
      ),
      { canCommission: false, canAdvance: false }
    )
  })
})
