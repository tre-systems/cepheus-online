import type {Characteristics, CombatState, Equipment} from '@data/types'

export const getEffectiveArmorRating = (
  weapon: Equipment,
  targetArmor: Equipment | null | undefined
): number => {
  if (!targetArmor) return 0

  const isLaser = weapon.Name?.toLowerCase().includes('laser')
  return isLaser ? (targetArmor.LaserAR ?? 0) : (targetArmor.AR ?? 0)
}

export const calculateDamageAfterArmor = (
  rawDamage: number,
  armorRating: number
): number => Math.max(0, rawDamage - armorRating)

// Cepheus Engine damage: END first, then higher of STR/DEX, then lower
export const applyDamageToCharacteristics = (
  characteristics: Partial<Characteristics>,
  damage: number
): Partial<Characteristics> => {
  if (damage <= 0) return characteristics

  const result = {...characteristics}
  const str = result.str ?? 0
  const dex = result.dex ?? 0
  const end = result.end ?? 0

  const [highKey, lowKey] =
    str > dex ? (['str', 'dex'] as const) : (['dex', 'str'] as const)

  let remainingDamage = damage
  const endDamage = Math.min(remainingDamage, end)
  result.end = end - endDamage
  remainingDamage -= endDamage

  if (remainingDamage > 0) {
    const highValue = result[highKey] ?? 0
    const highDamage = Math.min(remainingDamage, highValue)
    result[highKey] = highValue - highDamage
    remainingDamage -= highDamage
  }

  if (remainingDamage > 0) {
    const lowValue = result[lowKey] ?? 0
    const lowDamage = Math.min(remainingDamage, lowValue)
    result[lowKey] = lowValue - lowDamage
  }

  return result
}

export const calculateCarryCapacity = (str: number): string =>
  `${str * 2}/${str * 4}/${str * 6}/${str * 12}`

export const calculateTotalCost = (equipment: Equipment[]): number =>
  equipment.reduce(
    (acc, item) => acc + parseFloat(item?.Cost?.toString() ?? '0'),
    0
  )

export const calculateTotalWeight = (equipment: Equipment[]): number =>
  equipment.reduce(
    (acc, item) =>
      acc + (item.Carried ? parseFloat(item?.Wgt?.toString() ?? '0') : 0),
    0
  )

export type RangeBand =
  | 'Personal'
  | 'Close'
  | 'Short'
  | 'Medium'
  | 'Long'
  | 'Very Long'
  | 'Distant'

export type WeaponRangeType =
  | 'Close Quarters'
  | 'Extended Reach'
  | 'Thrown'
  | 'Pistol'
  | 'Rifle'
  | 'Shotgun'
  | 'Assault Weapon'
  | 'Rocket'

type RangeModifierEntry = {
  Weapon: WeaponRangeType
} & Partial<Record<RangeBand, number>>

export const RANGE_MODIFIER_TABLE: RangeModifierEntry[] = [
  {Weapon: 'Close Quarters', Personal: 0, Close: -2},
  {Weapon: 'Extended Reach', Personal: -2, Close: 0},
  {Weapon: 'Thrown', Close: 0, Short: -2, Medium: -2},
  {Weapon: 'Pistol', Personal: -2, Close: 0, Short: 0, Medium: -2, Long: -4},
  {
    Weapon: 'Rifle',
    Personal: -4,
    Close: -2,
    Short: 0,
    Medium: 0,
    Long: 0,
    'Very Long': -2,
    Distant: -4
  },
  {Weapon: 'Shotgun', Personal: -2, Close: 0, Short: -2, Medium: -2, Long: -4},
  {
    Weapon: 'Assault Weapon',
    Personal: -2,
    Close: 0,
    Short: 0,
    Medium: 0,
    Long: -2,
    'Very Long': -4,
    Distant: -6
  },
  {
    Weapon: 'Rocket',
    Personal: -4,
    Close: -2,
    Short: -2,
    Medium: 0,
    Long: 0,
    'Very Long': -2,
    Distant: -4
  }
]

export const getRangeType = (
  weaponRange: string | undefined
): string | null => {
  if (!weaponRange) return null
  const match = /\(([^)]+)\)/.exec(weaponRange)
  return match?.[1] ?? null
}

export const getRangeModifier = (
  rangeType: string | null,
  rangeBand: RangeBand
): number => {
  if (!rangeType) return 0

  const entry = RANGE_MODIFIER_TABLE.find(
    e => e.Weapon.toLowerCase() === rangeType.toLowerCase()
  )

  return entry?.[rangeBand] ?? 0
}

export const updateCombatStateModifiers = (
  combatState: CombatState,
  update: Partial<CombatState>
): CombatState => {
  const cleanModifiers = combatState.modifiers
    .filter(m => m.label !== 'Dodge')
    .filter(m => m.label !== 'Reactions')
    .filter(m => m.label !== 'Aim')
    .filter(m => m.label !== 'Fatigued')

  const newState = {...combatState, ...update}
  const newModifiers = [...cleanModifiers]

  if (newState.dodge) {
    newModifiers.push({label: 'Dodge', dm: -1})
  }
  if (newState.aim && newState.aim !== 0) {
    newModifiers.push({label: 'Aim', dm: newState.aim})
  }
  if (newState.fatigued) {
    newModifiers.push({label: 'Fatigued', dm: -2})
  }

  return {...newState, modifiers: newModifiers}
}
