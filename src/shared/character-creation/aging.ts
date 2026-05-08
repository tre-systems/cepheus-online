import type { CharacterCharacteristics, CharacteristicKey } from '../state'
import { clamp } from '../util'
import type {
  AgingChange,
  AgingChangeType,
  AgingEffect,
  AgingLossResolution,
  AgingLossSelection,
  AgingResolution
} from './types'

export const physicalAgingLossTargets = [
  'str',
  'dex',
  'end'
] satisfies CharacteristicKey[]

export const mentalAgingLossTargets = [
  'int',
  'edu',
  'soc'
] satisfies CharacteristicKey[]

export type AgingLossResolutionErrorCode =
  | 'invalid_aging_loss_target'
  | 'duplicate_aging_loss_target'
  | 'aging_loss_multiset_mismatch'

export interface AgingLossResolutionError {
  code: AgingLossResolutionErrorCode
  message: string
}

export type AgingLossResolutionResult =
  | { ok: true; value: AgingLossResolution }
  | { ok: false; error: AgingLossResolutionError }

export const agingLossTargetsForType = (
  type: AgingChangeType
): readonly CharacteristicKey[] =>
  type === 'PHYSICAL' ? physicalAgingLossTargets : mentalAgingLossTargets

const agingChangeKey = (change: AgingChange): string =>
  `${change.type}:${change.modifier}`

const agingChangeCounts = (
  changes: readonly AgingChange[]
): Record<string, number> =>
  changes.reduce<Record<string, number>>((counts, change) => {
    const key = agingChangeKey(change)
    counts[key] = (counts[key] ?? 0) + 1

    return counts
  }, {})

const sameAgingChangeMultiset = (
  pendingLosses: readonly AgingChange[],
  selectedLosses: readonly AgingLossSelection[]
): boolean => {
  const pendingCounts = agingChangeCounts(pendingLosses)
  const selectedCounts = agingChangeCounts(selectedLosses)
  const keys = new Set([
    ...Object.keys(pendingCounts),
    ...Object.keys(selectedCounts)
  ])

  for (const key of keys) {
    if ((pendingCounts[key] ?? 0) !== (selectedCounts[key] ?? 0)) {
      return false
    }
  }

  return true
}

export const resolveAgingLosses = ({
  characteristics,
  pendingLosses,
  selectedLosses
}: {
  characteristics: CharacterCharacteristics
  pendingLosses: readonly AgingChange[]
  selectedLosses: readonly AgingLossSelection[]
}): AgingLossResolutionResult => {
  if (!sameAgingChangeMultiset(pendingLosses, selectedLosses)) {
    return {
      ok: false,
      error: {
        code: 'aging_loss_multiset_mismatch',
        message: 'Selected aging losses must match pending aging losses'
      }
    }
  }

  const selectedByType = new Set<string>()
  const characteristicPatch: AgingLossResolution['characteristicPatch'] = {}

  for (const loss of selectedLosses) {
    const allowedTargets = agingLossTargetsForType(loss.type)
    if (!allowedTargets.includes(loss.characteristic)) {
      return {
        ok: false,
        error: {
          code: 'invalid_aging_loss_target',
          message: `${loss.characteristic} cannot receive a ${loss.type} aging loss`
        }
      }
    }

    const selectionKey = `${loss.type}:${loss.characteristic}`
    if (selectedByType.has(selectionKey)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_aging_loss_target',
          message: `${loss.characteristic} cannot receive more than one ${loss.type} aging loss`
        }
      }
    }
    selectedByType.add(selectionKey)

    const current =
      characteristicPatch[loss.characteristic] ??
      characteristics[loss.characteristic] ??
      0
    characteristicPatch[loss.characteristic] = clamp(
      current + loss.modifier,
      0,
      Number.MAX_SAFE_INTEGER
    )
  }

  return {
    ok: true,
    value: {
      selectedLosses: selectedLosses.map((loss) => ({ ...loss })),
      characteristicPatch
    }
  }
}

export const selectAgingEffect = (
  table: readonly AgingEffect[],
  roll: number
): AgingEffect | null => {
  if (table.length === 0) return null

  const rolls = table.map((effect) => Number(effect.Roll))
  const minRoll = Math.min(...rolls)
  const maxRoll = Math.max(...rolls)
  const clampedRoll = Math.max(minRoll, Math.min(maxRoll, roll))

  return table.find((effect) => Number(effect.Roll) === clampedRoll) ?? null
}

export const resolveAging = ({
  currentAge,
  table,
  roll,
  years = 4
}: {
  currentAge: number | null | undefined
  table: readonly AgingEffect[]
  roll: number
  years?: number
}): AgingResolution => {
  const age = (currentAge ?? 18) + years
  const effect = selectAgingEffect(table, roll)
  const changes = effect?.Changes ?? []

  if (changes.length === 0) {
    return {
      age,
      message: 'No aging effects.',
      characteristicChanges: []
    }
  }

  return {
    age,
    message: effect?.Effects ?? 'No aging effects.',
    characteristicChanges: changes.map((change) => ({ ...change }))
  }
}
