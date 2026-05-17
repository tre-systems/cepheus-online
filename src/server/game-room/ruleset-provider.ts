import {
  resolveDefaultRulesetData,
  resolveDefaultRulesetReference,
  type RulesetDataResolver,
  type RulesetReferenceResolver
} from '../../shared/character-creation/default-ruleset-provider'

export const resolveRoomRulesetData: RulesetDataResolver = (rulesetId) =>
  resolveDefaultRulesetData(rulesetId)

export const resolveRoomRulesetReference: RulesetReferenceResolver = (
  rulesetId
) => resolveDefaultRulesetReference(rulesetId)
