import type {
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacterState,
  CharacteristicKey
} from '../../shared/state'

const uppCharacteristicOrder: CharacteristicKey[] = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
]

const uppDigits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const formatUppCharacteristic = (
  value: number | null | undefined
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '?'
  }
  const normalized = Math.trunc(value)
  if (normalized < 0) return '?'
  return uppDigits[normalized] ?? '?'
}

export const deriveCharacterUpp = (
  characteristics: Partial<CharacterCharacteristics> | null | undefined
): string =>
  uppCharacteristicOrder
    .map((key) => formatUppCharacteristic(characteristics?.[key]))
    .join('')

export const isCharacterCreationFinal = (
  character: Pick<CharacterState, 'creation'> | null | undefined
): boolean =>
  character?.creation?.creationComplete === true ||
  character?.creation?.state.status === 'PLAYABLE'

const listValue = (items: readonly string[]): string =>
  items.length > 0 ? items.join(', ') : 'None'

const equipmentValue = (
  equipment: readonly CharacterEquipmentItem[] | null | undefined
): string => {
  if (!equipment || equipment.length === 0) return 'None'

  return equipment
    .map((item) => {
      const quantity = Math.max(1, item.quantity)
      return `${item.name} x${quantity}${item.notes ? ` (${item.notes})` : ''}`
    })
    .join('; ')
}

export const derivePlainCharacterExport = (
  character: CharacterState | null | undefined
): string | null => {
  if (!character || !isCharacterCreationFinal(character)) return null

  const career = character.creation?.careers.at(-1)
  const lines = [
    character.name.trim() || 'Unnamed character',
    `UPP: ${deriveCharacterUpp(character.characteristics)}`,
    `Type: ${character.type}`,
    `Age: ${character.age == null ? '-' : character.age}`,
    `Career: ${career?.name ?? 'None'}`,
    `Terms: ${character.creation?.terms.length ?? 0}`,
    `Skills: ${listValue(character.skills)}`,
    `Credits: Cr${character.credits}`,
    `Equipment: ${equipmentValue(character.equipment)}`
  ]

  const notes = character.notes.trim()
  if (notes) lines.push('Notes:', notes)

  return lines.join('\n')
}
