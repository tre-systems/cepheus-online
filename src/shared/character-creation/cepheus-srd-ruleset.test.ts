import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CEPHEUS_SRD_CAREERS,
  CEPHEUS_SRD_RULESET,
  DEFAULT_RULESET_ID,
  decodeCepheusSrdRuleset,
  resolveRulesetById,
  type CepheusCareerDefinition
} from './cepheus-srd-ruleset'
import { parseCareerCheck } from './career-rules'

const skillTables = [
  'serviceSkills',
  'specialistSkills',
  'personalDevelopment',
  'advancedEducation'
] satisfies readonly (keyof Pick<
  CepheusCareerDefinition,
  | 'serviceSkills'
  | 'specialistSkills'
  | 'personalDevelopment'
  | 'advancedEducation'
>)[]

const requiredChecks = [
  'qualification',
  'survival',
  'commission',
  'advancement'
] satisfies readonly (keyof Pick<
  CepheusCareerDefinition,
  'qualification' | 'survival' | 'commission' | 'advancement'
>)[]

describe('Cepheus SRD career ruleset', () => {
  it('loads the bundled default ruleset from JSON data', () => {
    const resolved = resolveRulesetById(DEFAULT_RULESET_ID)

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.value, CEPHEUS_SRD_RULESET)
    assert.equal(resolved.value.careerBasics.Scout.Survival, 'End 7+')
  })

  it('rejects malformed ruleset data at the data boundary', () => {
    const decoded = decodeCepheusSrdRuleset({
      careerBasics: {},
      serviceSkills: {}
    })

    assert.equal(decoded.ok, false)
    if (decoded.ok) return
    assert.equal(decoded.error.includes('gender must be an object'), true)
    assert.equal(decoded.error.includes('theDraft must be an array'), true)
  })

  it('includes the expected SRD careers with the legacy defaults first', () => {
    const careerNames = CEPHEUS_SRD_CAREERS.map((career) => career.name)

    assert.deepEqual(careerNames, [
      'Scout',
      'Merchant',
      'Marine',
      'Navy',
      'Belter',
      'Agent',
      'Aerospace',
      'Mercenary',
      'Physician',
      'Rogue',
      'Technician',
      'Drifter',
      'Athlete',
      'Barbarian',
      'Bureaucrat',
      'Colonist',
      'Diplomat',
      'Entertainer',
      'Hunter',
      'Maritime Defense',
      'Noble',
      'Pirate',
      'Scientist',
      'Surface Defense'
    ])
  })

  it('has six entries in every career skill table', () => {
    for (const career of CEPHEUS_SRD_CAREERS) {
      for (const table of skillTables) {
        assert.equal(
          career[table].length,
          6,
          `${career.name} ${table} should have six entries`
        )
      }
    }
  })

  it('uses parseable career checks where checks are present', () => {
    for (const career of CEPHEUS_SRD_CAREERS) {
      for (const checkName of requiredChecks) {
        const check = career[checkName]
        if (check === '-') continue

        assert.equal(
          parseCareerCheck(check) === null,
          false,
          `${career.name} ${checkName} should parse as a career check`
        )
      }
    }
  })

  it('does not contain duplicate career names', () => {
    const careerNames = CEPHEUS_SRD_CAREERS.map((career) => career.name)
    const uniqueCareerNames = new Set(careerNames)

    assert.equal(uniqueCareerNames.size, careerNames.length)
  })
})
