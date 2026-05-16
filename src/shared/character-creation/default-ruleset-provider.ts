import {
  resolveRulesetReference,
  type CepheusRuleset,
  type ResolvedCepheusRuleset
} from './cepheus-srd-ruleset'
import type { Result } from '../result'

export type RulesetReferenceResolver = (
  rulesetId?: string
) => Result<ResolvedCepheusRuleset, string[]>

export type RulesetDataResolver = (
  rulesetId?: string
) => Result<CepheusRuleset, string[]>

export const resolveDefaultRulesetReference: RulesetReferenceResolver = (
  rulesetId
) => resolveRulesetReference(rulesetId)

export const resolveDefaultRulesetData: RulesetDataResolver = (rulesetId) => {
  const resolved = resolveDefaultRulesetReference(rulesetId)
  return resolved.ok
    ? { ok: true, value: resolved.value.ruleset }
    : { ok: false, error: resolved.error }
}
