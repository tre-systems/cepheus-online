import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  CEPHEUS_SRD_CAREERS,
  CEPHEUS_SRD_RULESET,
  DEFAULT_RULESET_ID,
  createRulesetProvider,
  createRulesetRegistry,
  decodeCepheusRuleset,
  resolveRulesetReference,
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

const loadCustomRulesetFixture = (): unknown =>
  JSON.parse(
    readFileSync(
      'src/shared/character-creation/__fixtures__/custom-ruleset.json',
      'utf8'
    )
  )

describe('Cepheus SRD career ruleset', () => {
  it('loads the bundled default ruleset from JSON data', () => {
    const resolved = resolveRulesetById(DEFAULT_RULESET_ID)

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.value, CEPHEUS_SRD_RULESET)
    assert.equal(resolved.value.careerBasics.Scout.Survival, 'End 7+')
  })

  it('rejects malformed ruleset data at the data boundary', () => {
    const decoded = decodeCepheusRuleset({
      careerBasics: {},
      serviceSkills: {}
    })

    assert.equal(decoded.ok, false)
    if (decoded.ok) return
    assert.equal(decoded.error.includes('gender must be an object'), true)
    assert.equal(decoded.error.includes('theDraft must be an array'), true)
  })

  it('rejects malformed nested ruleset tables at the data boundary', () => {
    const raw = structuredClone(loadCustomRulesetFixture()) as Record<
      string,
      unknown
    >
    const careerBasics = raw.careerBasics as Record<
      string,
      Record<string, unknown>
    >
    const serviceSkills = raw.serviceSkills as Record<
      string,
      Record<string, unknown>
    >
    const ranksAndSkills = raw.ranksAndSkills as Record<
      string,
      Record<string, unknown>
    >
    const cashBenefits = raw.cashBenefits as Record<
      string,
      Record<string, unknown>
    >
    const cascadeSkills = raw.cascadeSkills as Record<string, unknown>
    const aging = raw.aging as Array<Record<string, unknown>>

    careerBasics.Courier.Survival = 7
    serviceSkills.Courier['3'] = null
    ranksAndSkills.Courier = {}
    ranksAndSkills.Courier['0'] = null
    cashBenefits.Courier['1'] = '1000'
    cascadeSkills.Survey = ['Prospecting', 7]
    aging.push({ Roll: '0-', Effects: 'Fixture row', Changes: [] })
    aging[0].Changes = [{ type: 'BODY', modifier: 'minus one' }]

    const decoded = decodeCepheusRuleset(raw)

    assert.equal(decoded.ok, false)
    if (decoded.ok) return
    assert.equal(
      decoded.error.includes('careerBasics.Courier.Survival must be a string'),
      true
    )
    assert.equal(
      decoded.error.includes('serviceSkills.Courier.3 must be a string'),
      true
    )
    assert.equal(
      decoded.error.includes('ranksAndSkills.Courier.0 must be a string'),
      true
    )
    assert.equal(
      decoded.error.includes('cashBenefits.Courier.1 must be a number'),
      true
    )
    assert.equal(
      decoded.error.includes(
        'cascadeSkills.Survey must be an array of strings'
      ),
      true
    )
    assert.equal(
      decoded.error.includes(
        'aging[0].Changes[0].type must be PHYSICAL or MENTAL'
      ),
      true
    )
  })

  it('decodes a non-SRD ruleset JSON fixture without using bundled defaults', () => {
    const decoded = decodeCepheusRuleset(loadCustomRulesetFixture())

    assert.equal(decoded.ok, true)
    if (!decoded.ok) return
    assert.deepEqual(Object.keys(decoded.value.careerBasics), ['Courier'])
    assert.equal(decoded.value.careerBasics.Courier.Survival, 'End 6+')
    assert.deepEqual(decoded.value.cascadeSkills.Survey, [
      'Prospecting',
      'Sensors'
    ])
  })

  it('creates validated registries from JSON-compatible ruleset records', () => {
    const registry = createRulesetRegistry({
      [DEFAULT_RULESET_ID]: CEPHEUS_SRD_RULESET,
      'custom-courier': loadCustomRulesetFixture()
    })

    assert.deepEqual(registry.supportedRulesetIds, [
      DEFAULT_RULESET_ID,
      'custom-courier'
    ])
    const resolved = registry.resolveRulesetById('custom-courier')
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.deepEqual(Object.keys(resolved.value.careerBasics), ['Courier'])
  })

  it('resolves ruleset metadata through a provider boundary', () => {
    const resolved = resolveRulesetReference(DEFAULT_RULESET_ID)

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.value.id, DEFAULT_RULESET_ID)
    assert.equal(resolved.value.version, 1)
    assert.equal(resolved.value.source, 'bundled')
    assert.equal(/^fnv1a32-[0-9a-f]{8}$/.test(resolved.value.contentHash), true)
    assert.deepEqual(resolved.value.ruleset, CEPHEUS_SRD_RULESET)
  })

  it('creates custom ruleset providers from JSON-compatible records', () => {
    const provider = createRulesetProvider(
      {
        [DEFAULT_RULESET_ID]: CEPHEUS_SRD_RULESET,
        'custom-courier': loadCustomRulesetFixture()
      },
      DEFAULT_RULESET_ID,
      'custom'
    )

    const resolved = provider.resolveRulesetById('custom-courier')
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.value.id, 'custom-courier')
    assert.equal(resolved.value.source, 'custom')
    assert.deepEqual(Object.keys(resolved.value.ruleset.careerBasics), [
      'Courier'
    ])
  })

  it('fails closed for unknown or malformed registry entries', () => {
    const registry = createRulesetRegistry({
      [DEFAULT_RULESET_ID]: CEPHEUS_SRD_RULESET,
      broken: { careerBasics: {} }
    })

    const unknown = registry.resolveRulesetById('missing')
    assert.equal(unknown.ok, false)
    if (unknown.ok) return
    assert.deepEqual(unknown.error, ['Unknown ruleset id "missing"'])

    const malformed = registry.resolveRulesetById('broken')
    assert.equal(malformed.ok, false)
    if (malformed.ok) return
    assert.equal(malformed.error.includes('gender must be an object'), true)
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
