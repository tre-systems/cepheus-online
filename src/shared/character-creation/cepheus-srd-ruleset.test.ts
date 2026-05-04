import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CEPHEUS_SRD_CAREERS,
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
