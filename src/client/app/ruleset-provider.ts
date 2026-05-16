import {
  resolveDefaultRulesetData,
  type RulesetDataResolver
} from '../../shared/character-creation/default-ruleset-provider.js'
import type { CepheusRuleset } from '../../shared/character-creation/cepheus-srd-ruleset.js'
import type { GameState } from '../../shared/state.js'

export type ClientRulesetResolver = RulesetDataResolver

export const resolveClientRuleset: ClientRulesetResolver = (rulesetId) => {
  return resolveDefaultRulesetData(rulesetId ?? undefined)
}

export const rulesetFromState = (
  state: Pick<GameState, 'rulesetId'> | null | undefined
): CepheusRuleset | null => {
  const resolved = resolveClientRuleset(state?.rulesetId)
  return resolved.ok ? resolved.value : null
}
