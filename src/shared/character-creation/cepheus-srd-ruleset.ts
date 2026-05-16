import * as rawDefaultRulesetModule from '../../../data/rulesets/cepheus-engine-srd.json'
import { err, ok, type Result } from '../result'
import type { AgingEffect, CareerBasicsTable, CareerSkillTable } from './types'

export interface CepheusCareerDefinition {
  name: string
  qualification: string
  survival: string
  commission: string
  advancement: string
  serviceSkills: readonly string[]
  specialistSkills: readonly string[]
  personalDevelopment: readonly string[]
  advancedEducation: readonly string[]
}

export interface CepheusSrdRuleset {
  gender: Record<string, string>
  careerBasics: CareerBasicsTable
  serviceSkills: CareerSkillTable
  specialistSkills: CareerSkillTable
  personalDevelopment: CareerSkillTable
  advEducation: CareerSkillTable
  ranksAndSkills: Record<string, Record<string, string>>
  cashBenefits: Record<string, Record<string, number>>
  materialBenefits: Record<string, Record<string, string>>
  primaryEducationSkillsData: readonly string[]
  homeWorldSkillsByLawLevel: Record<string, string>
  homeWorldSkillsByTradeCode: Record<string, string>
  cascadeSkills: Record<string, readonly string[]>
  theDraft: readonly string[]
  aging: readonly AgingEffect[]
}

const ROLL_TABLE_KEYS = ['1', '2', '3', '4', '5', '6'] as const

export const DEFAULT_RULESET_ID = 'cepheus-engine-srd'

const rawDefaultRuleset =
  (rawDefaultRulesetModule as { default?: unknown }).default ??
  rawDefaultRulesetModule

const bundledRulesets: Record<string, unknown> = {
  [DEFAULT_RULESET_ID]: rawDefaultRuleset
}

export const SUPPORTED_RULESET_IDS = Object.keys(bundledRulesets)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requiredRecordKeys = [
  'gender',
  'careerBasics',
  'serviceSkills',
  'specialistSkills',
  'personalDevelopment',
  'advEducation',
  'ranksAndSkills',
  'cashBenefits',
  'materialBenefits',
  'homeWorldSkillsByLawLevel',
  'homeWorldSkillsByTradeCode',
  'cascadeSkills'
] satisfies readonly (keyof CepheusSrdRuleset)[]

const requiredArrayKeys = [
  'primaryEducationSkillsData',
  'theDraft',
  'aging'
] satisfies readonly (keyof CepheusSrdRuleset)[]

const validateCareerSkillTables = (
  ruleset: Record<string, unknown>,
  errors: string[]
): void => {
  const careerBasics = ruleset.careerBasics
  if (!isRecord(careerBasics)) return

  const careerNames = Object.keys(careerBasics)
  for (const tableKey of [
    'serviceSkills',
    'specialistSkills',
    'personalDevelopment',
    'advEducation'
  ] satisfies readonly (keyof CepheusSrdRuleset)[]) {
    const table = ruleset[tableKey]
    if (!isRecord(table)) continue

    for (const careerName of careerNames) {
      const careerTable = table[careerName]
      if (!isRecord(careerTable)) {
        errors.push(`${tableKey}.${careerName} must be a record`)
        continue
      }

      for (const rollKey of ROLL_TABLE_KEYS) {
        if (typeof careerTable[rollKey] !== 'string') {
          errors.push(`${tableKey}.${careerName}.${rollKey} must be a string`)
        }
      }
    }
  }
}

export const decodeCepheusSrdRuleset = (
  raw: unknown
): Result<CepheusSrdRuleset, string[]> => {
  const errors: string[] = []

  if (!isRecord(raw)) {
    return err(['Ruleset must be an object'])
  }

  for (const key of requiredRecordKeys) {
    if (!isRecord(raw[key])) {
      errors.push(`${key} must be an object`)
    }
  }

  for (const key of requiredArrayKeys) {
    if (!Array.isArray(raw[key])) {
      errors.push(`${key} must be an array`)
    }
  }

  validateCareerSkillTables(raw, errors)

  return errors.length === 0
    ? ok(raw as unknown as CepheusSrdRuleset)
    : err(errors)
}

export const resolveRulesetById = (
  rulesetId: string = DEFAULT_RULESET_ID
): Result<CepheusSrdRuleset, string[]> => {
  const raw = bundledRulesets[rulesetId]
  if (raw === undefined) {
    return err([`Unknown ruleset id "${rulesetId}"`])
  }

  return decodeCepheusSrdRuleset(raw)
}

export const loadDefaultRuleset = (): CepheusSrdRuleset => {
  const decoded = resolveRulesetById(DEFAULT_RULESET_ID)
  if (!decoded.ok) {
    throw new Error(decoded.error.join('; '))
  }

  return decoded.value
}

const tableValues = (table: Record<string, string>): string[] =>
  ROLL_TABLE_KEYS.map((key) => table[key])

export const CEPHEUS_SRD_RULESET = loadDefaultRuleset()

const PREFERRED_CAREER_ORDER = [
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
  'Drifter'
] as const

const careerNamesForRuleset = (ruleset: CepheusSrdRuleset): string[] => [
  ...PREFERRED_CAREER_ORDER.filter((name) => ruleset.careerBasics[name]),
  ...Object.keys(ruleset.careerBasics).filter(
    (name) => !(PREFERRED_CAREER_ORDER as readonly string[]).includes(name)
  )
]

export const deriveCepheusCareerDefinitions = (
  ruleset: CepheusSrdRuleset
): CepheusCareerDefinition[] =>
  careerNamesForRuleset(ruleset).map((name) => {
    const basics = ruleset.careerBasics[name]

    return {
      name,
      qualification: basics.Qualifications,
      survival: basics.Survival,
      commission: basics.Commission,
      advancement: basics.Advancement,
      serviceSkills: tableValues(ruleset.serviceSkills[name]),
      specialistSkills: tableValues(ruleset.specialistSkills[name]),
      personalDevelopment: tableValues(ruleset.personalDevelopment[name]),
      advancedEducation: tableValues(ruleset.advEducation[name])
    }
  })

export const CEPHEUS_SRD_CAREERS =
  deriveCepheusCareerDefinitions(CEPHEUS_SRD_RULESET)
