import type { AgingEffect, AgingResolution } from './types'

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
