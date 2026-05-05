import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CEPHEUS_SRD_RULESET } from './cepheus-srd-ruleset'
import {
  deriveBackgroundSkillPlan,
  deriveHomeworldBackgroundSkillNames,
  derivePrimaryEducationSkillOptions,
  deriveTotalBackgroundSkillAllowance
} from './background-skills'

describe('background skill helpers', () => {
  it('derives total background skill allowance from the EDU modifier', () => {
    assert.equal(deriveTotalBackgroundSkillAllowance(2), 1)
    assert.equal(deriveTotalBackgroundSkillAllowance(7), 3)
    assert.equal(deriveTotalBackgroundSkillAllowance(12), 5)
    assert.equal(deriveTotalBackgroundSkillAllowance(null), 3)
  })

  it('returns primary education options after mandatory homeworld skills', () => {
    const options = derivePrimaryEducationSkillOptions({
      edu: 7,
      homeworld: {
        lawLevel: 'No Law',
        tradeCodes: 'Asteroid'
      },
      rules: CEPHEUS_SRD_RULESET
    })

    assert.deepEqual(options.slice(0, 3), [
      { name: 'Gun Combat*', preselected: true },
      { name: 'Zero-G', preselected: true },
      { name: 'Admin', preselected: false }
    ])

    assert.equal(
      options.some((option) => option.name === 'Computer'),
      true
    )
  })

  it('derives unique homeworld skills from law level and trade codes', () => {
    assert.deepEqual(
      deriveHomeworldBackgroundSkillNames({
        homeworld: {
          lawLevel: 'High Law',
          tradeCodes: ['Water World', 'High Population']
        },
        rules: CEPHEUS_SRD_RULESET
      }),
      ['Melee Combat*', 'Watercraft*', 'Streetwise']
    )

    assert.deepEqual(
      deriveHomeworldBackgroundSkillNames({
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Agricultural', 'Garden']
        },
        rules: CEPHEUS_SRD_RULESET
      }),
      ['Gun Combat*', 'Animals*']
    )
  })

  it('separates homeworld cascade skills into pending selections', () => {
    assert.deepEqual(
      deriveBackgroundSkillPlan({
        edu: 7,
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: 'Industrial'
        },
        rules: CEPHEUS_SRD_RULESET
      }),
      {
        backgroundSkills: ['Broker-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }
    )
  })

  it('does not preselect homeworld skills when EDU allowance is too low', () => {
    const options = derivePrimaryEducationSkillOptions({
      edu: 2,
      homeworld: {
        lawLevel: 'No Law',
        tradeCodes: 'Asteroid'
      },
      rules: CEPHEUS_SRD_RULESET
    })

    assert.deepEqual(options.slice(0, 2), [
      { name: 'Admin', preselected: false },
      { name: 'Advocate', preselected: false }
    ])

    assert.deepEqual(
      deriveBackgroundSkillPlan({
        edu: 2,
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: 'Asteroid'
        },
        rules: CEPHEUS_SRD_RULESET
      }),
      {
        backgroundSkills: [],
        pendingCascadeSkills: []
      }
    )
  })
})
