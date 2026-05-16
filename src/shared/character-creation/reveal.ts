import { deriveLiveActivityRevealAt } from '../live-activity'
import type { CharacterCreationTimelineEntry } from './types'

export interface DiceRevealState {
  id: string
  revealAt: string
}

interface CharacterCreationRevealSource {
  timeline?: readonly CharacterCreationTimelineEntry[]
}

export const collectCreationRollEventIds = (
  value: unknown,
  ids: Set<string> = new Set()
): Set<string> => {
  if (!value || typeof value !== 'object') return ids

  if (
    'rollEventId' in value &&
    typeof (value as { rollEventId?: unknown }).rollEventId === 'string'
  ) {
    ids.add((value as { rollEventId: string }).rollEventId)
  }

  for (const child of Object.values(value)) {
    collectCreationRollEventIds(child, ids)
  }

  return ids
}

export const deriveUnrevealedCreationRollIds = (
  creation: CharacterCreationRevealSource,
  diceLog: readonly DiceRevealState[],
  nowMs: number
): Set<string> => {
  const creationRollIds = collectCreationRollEventIds(creation)
  if (creationRollIds.size === 0) return new Set()

  const retainedRollIds = new Set(diceLog.map((roll) => roll.id))
  const hiddenRollIds = new Set(
    diceLog
      .filter(
        (roll) =>
          creationRollIds.has(roll.id) && Date.parse(roll.revealAt) > nowMs
      )
      .map((roll) => roll.id)
  )

  for (const entry of creation.timeline ?? []) {
    if (!entry.rollEventId || retainedRollIds.has(entry.rollEventId)) continue
    if (Date.parse(deriveLiveActivityRevealAt(entry.createdAt)) > nowMs) {
      hiddenRollIds.add(entry.rollEventId)
    }
  }

  return hiddenRollIds
}
