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

export interface CepheusRuleset {
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

export type CepheusSrdRuleset = CepheusRuleset

export interface CepheusRulesetRegistry {
  supportedRulesetIds: readonly string[]
  resolveRulesetById: (rulesetId?: string) => Result<CepheusRuleset, string[]>
}

export interface ResolvedCepheusRuleset {
  id: string
  version: 1
  contentHash: string
  source: 'bundled' | 'custom'
  ruleset: CepheusRuleset
}

export interface CepheusRulesetProvider {
  supportedRulesetIds: readonly string[]
  resolveRulesetById: (
    rulesetId?: string
  ) => Result<ResolvedCepheusRuleset, string[]>
}

const ROLL_TABLE_KEYS = ['1', '2', '3', '4', '5', '6'] as const
const RANK_TABLE_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const
const BENEFIT_TABLE_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const
const CAREER_BASIC_KEYS = [
  'Qualifications',
  'Survival',
  'Commission',
  'Advancement',
  'ReEnlistment'
] as const

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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

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
] satisfies readonly (keyof CepheusRuleset)[]

const requiredArrayKeys = [
  'primaryEducationSkillsData',
  'theDraft',
  'aging'
] satisfies readonly (keyof CepheusRuleset)[]

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
  ] satisfies readonly (keyof CepheusRuleset)[]) {
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

const validateStringRecord = (
  value: unknown,
  label: string,
  errors: string[]
): void => {
  if (!isRecord(value)) return
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      errors.push(`${label}.${key} must be a string`)
    }
  }
}

const validateStringArray = (
  value: unknown,
  label: string,
  errors: string[]
): void => {
  if (!Array.isArray(value)) return
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      errors.push(`${label}[${index}] must be a string`)
    }
  }
}

const validateCareerBasics = (
  ruleset: Record<string, unknown>,
  errors: string[]
): void => {
  const careerBasics = ruleset.careerBasics
  if (!isRecord(careerBasics)) return

  for (const [careerName, basics] of Object.entries(careerBasics)) {
    if (!isRecord(basics)) {
      errors.push(`careerBasics.${careerName} must be a record`)
      continue
    }
    for (const key of CAREER_BASIC_KEYS) {
      if (typeof basics[key] !== 'string') {
        errors.push(`careerBasics.${careerName}.${key} must be a string`)
      }
    }
  }
}

const validateRankTables = (
  ruleset: Record<string, unknown>,
  errors: string[]
): void => {
  const ranksAndSkills = ruleset.ranksAndSkills
  if (!isRecord(ranksAndSkills)) return

  for (const [careerName, rankTable] of Object.entries(ranksAndSkills)) {
    if (!isRecord(rankTable)) {
      errors.push(`ranksAndSkills.${careerName} must be a record`)
      continue
    }
    for (const rankKey of RANK_TABLE_KEYS) {
      if (typeof rankTable[rankKey] !== 'string') {
        errors.push(`ranksAndSkills.${careerName}.${rankKey} must be a string`)
      }
    }
  }
}

const validateBenefitTables = (
  ruleset: Record<string, unknown>,
  errors: string[]
): void => {
  const careerBasics = ruleset.careerBasics
  if (!isRecord(careerBasics)) return

  for (const tableKey of [
    'cashBenefits',
    'materialBenefits'
  ] satisfies readonly (keyof CepheusRuleset)[]) {
    const table = ruleset[tableKey]
    if (!isRecord(table)) continue

    for (const careerName of Object.keys(careerBasics)) {
      const careerTable = table[careerName]
      if (!isRecord(careerTable)) {
        errors.push(`${tableKey}.${careerName} must be a record`)
        continue
      }
      for (const rollKey of BENEFIT_TABLE_KEYS) {
        const value = careerTable[rollKey]
        if (
          tableKey === 'cashBenefits'
            ? typeof value !== 'number'
            : typeof value !== 'string'
        ) {
          errors.push(
            `${tableKey}.${careerName}.${rollKey} must be a ${
              tableKey === 'cashBenefits' ? 'number' : 'string'
            }`
          )
        }
      }
    }
  }
}

const validateCascadeSkills = (
  ruleset: Record<string, unknown>,
  errors: string[]
): void => {
  const cascadeSkills = ruleset.cascadeSkills
  if (!isRecord(cascadeSkills)) return

  for (const [cascadeName, choices] of Object.entries(cascadeSkills)) {
    if (!isStringArray(choices)) {
      errors.push(`cascadeSkills.${cascadeName} must be an array of strings`)
    }
  }
}

const validateAgingTable = (
  ruleset: Record<string, unknown>,
  errors: string[]
): void => {
  const aging = ruleset.aging
  if (!Array.isArray(aging)) return

  for (const [index, entry] of aging.entries()) {
    if (!isRecord(entry)) {
      errors.push(`aging[${index}] must be a record`)
      continue
    }
    if (typeof entry.Roll !== 'string' && typeof entry.Roll !== 'number') {
      errors.push(`aging[${index}].Roll must be a string or number`)
    }
    if (typeof entry.Effects !== 'string') {
      errors.push(`aging[${index}].Effects must be a string`)
    }
    if (entry.Changes === undefined) continue
    if (!Array.isArray(entry.Changes)) {
      errors.push(`aging[${index}].Changes must be an array`)
      continue
    }
    for (const [changeIndex, change] of entry.Changes.entries()) {
      if (!isRecord(change)) {
        errors.push(`aging[${index}].Changes[${changeIndex}] must be a record`)
        continue
      }
      if (change.type !== 'PHYSICAL' && change.type !== 'MENTAL') {
        errors.push(
          `aging[${index}].Changes[${changeIndex}].type must be PHYSICAL or MENTAL`
        )
      }
      if (typeof change.modifier !== 'number') {
        errors.push(
          `aging[${index}].Changes[${changeIndex}].modifier must be a number`
        )
      }
    }
  }
}

export const decodeCepheusRuleset = (
  raw: unknown
): Result<CepheusRuleset, string[]> => {
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
  validateCareerBasics(raw, errors)
  validateRankTables(raw, errors)
  validateBenefitTables(raw, errors)
  validateCascadeSkills(raw, errors)
  validateStringRecord(raw.gender, 'gender', errors)
  validateStringRecord(
    raw.homeWorldSkillsByLawLevel,
    'homeWorldSkillsByLawLevel',
    errors
  )
  validateStringRecord(
    raw.homeWorldSkillsByTradeCode,
    'homeWorldSkillsByTradeCode',
    errors
  )
  validateStringArray(
    raw.primaryEducationSkillsData,
    'primaryEducationSkillsData',
    errors
  )
  validateStringArray(raw.theDraft, 'theDraft', errors)
  validateAgingTable(raw, errors)

  return errors.length === 0
    ? ok(raw as unknown as CepheusRuleset)
    : err(errors)
}

export const decodeCepheusSrdRuleset = decodeCepheusRuleset

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

const contentHashForRuleset = (raw: unknown): string => {
  const input = stableJson(raw)
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const createRulesetRegistry = (
  rulesets: Record<string, unknown>,
  defaultRulesetId: string = DEFAULT_RULESET_ID
): CepheusRulesetRegistry => {
  const supportedRulesetIds = Object.keys(rulesets)

  return {
    supportedRulesetIds,
    resolveRulesetById: (
      rulesetId: string = defaultRulesetId
    ): Result<CepheusRuleset, string[]> => {
      const raw = rulesets[rulesetId]
      if (raw === undefined) {
        return err([`Unknown ruleset id "${rulesetId}"`])
      }

      return decodeCepheusRuleset(raw)
    }
  }
}

export const createRulesetProvider = (
  rulesets: Record<string, unknown>,
  defaultRulesetId: string = DEFAULT_RULESET_ID,
  source: ResolvedCepheusRuleset['source'] = 'bundled'
): CepheusRulesetProvider => {
  const supportedRulesetIds = Object.keys(rulesets)

  return {
    supportedRulesetIds,
    resolveRulesetById: (
      rulesetId: string = defaultRulesetId
    ): Result<ResolvedCepheusRuleset, string[]> => {
      const raw = rulesets[rulesetId]
      if (raw === undefined) {
        return err([`Unknown ruleset id "${rulesetId}"`])
      }

      const decoded = decodeCepheusRuleset(raw)
      if (!decoded.ok) return decoded

      return ok({
        id: rulesetId,
        version: 1,
        contentHash: contentHashForRuleset(raw),
        source,
        ruleset: decoded.value
      })
    }
  }
}

const bundledRulesetRegistry = createRulesetRegistry(bundledRulesets)
const bundledRulesetProvider = createRulesetProvider(bundledRulesets)

export const resolveRulesetById = (
  rulesetId: string = DEFAULT_RULESET_ID
): Result<CepheusRuleset, string[]> =>
  bundledRulesetRegistry.resolveRulesetById(rulesetId)

export const resolveRulesetReference = (
  rulesetId: string = DEFAULT_RULESET_ID
): Result<ResolvedCepheusRuleset, string[]> =>
  bundledRulesetProvider.resolveRulesetById(rulesetId)

export const loadDefaultRuleset = (): CepheusRuleset => {
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

const careerNamesForRuleset = (ruleset: CepheusRuleset): string[] => [
  ...PREFERRED_CAREER_ORDER.filter((name) => ruleset.careerBasics[name]),
  ...Object.keys(ruleset.careerBasics).filter(
    (name) => !(PREFERRED_CAREER_ORDER as readonly string[]).includes(name)
  )
]

export const deriveCepheusCareerDefinitions = (
  ruleset: CepheusRuleset
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
