export const DICE_ROLL_ANIMATION_MS = 2200
export const DICE_OVERLAY_VISIBLE_MS = 1200
export const DICE_REVEAL_MIN_MS = 500
export const DICE_REVEALED_HOLD_MS = 1200

export const DICE_PIP_SLOTS = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: [
    'top-left',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-right'
  ]
} as const

export type DicePipValue = keyof typeof DICE_PIP_SLOTS
export type DicePipSlot = (typeof DICE_PIP_SLOTS)[DicePipValue][number]
export type DieFaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

export interface DieFace {
  name: DieFaceName
  value: number
}

export interface DieTilt {
  x: string
  y: string
  z: string
}

export interface DiceRollTiming {
  rollDurationMs: number
  visibleDurationMs: number
}

export const deriveD6Face = (value: number): DicePipValue =>
  ((((((Math.trunc(value) || 1) - 1) % 6) + 6) % 6) + 1) as DicePipValue

export const deriveDicePipSlots = (
  value: number
): readonly DicePipSlot[] | null =>
  DICE_PIP_SLOTS[value as DicePipValue] ?? null

export const deriveDieFaces = (value: number): readonly DieFace[] => {
  const base = deriveD6Face(value)

  return [
    { name: 'front', value },
    { name: 'back', value: 7 - base },
    { name: 'right', value: deriveD6Face(base + 1) },
    { name: 'left', value: deriveD6Face(base + 3) },
    { name: 'top', value: deriveD6Face(base + 4) },
    { name: 'bottom', value: deriveD6Face(base + 2) }
  ]
}

export const deriveDieTilt = (index: number): DieTilt =>
  index % 2 === 0
    ? { x: '-22deg', y: '-34deg', z: '1deg' }
    : { x: '-18deg', y: '-24deg', z: '-4deg' }

export const deriveDiceRollTiming = ({
  revealAt,
  nowMs,
  maxRollDurationMs = DICE_ROLL_ANIMATION_MS,
  minRollDurationMs = DICE_REVEAL_MIN_MS,
  overlayVisibleMs = DICE_OVERLAY_VISIBLE_MS,
  revealedHoldMs = DICE_REVEALED_HOLD_MS
}: {
  revealAt: string | null | undefined
  nowMs: number
  maxRollDurationMs?: number
  minRollDurationMs?: number
  overlayVisibleMs?: number
  revealedHoldMs?: number
}): DiceRollTiming => {
  const revealAtMs = Date.parse(revealAt ?? '')
  const timeUntilReveal = Number.isFinite(revealAtMs)
    ? revealAtMs - nowMs
    : maxRollDurationMs
  const rollDurationMs = Math.max(
    minRollDurationMs,
    Math.min(maxRollDurationMs, timeUntilReveal)
  )

  return {
    rollDurationMs,
    visibleDurationMs: Math.max(
      overlayVisibleMs,
      rollDurationMs + revealedHoldMs
    )
  }
}
