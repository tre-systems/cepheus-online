import type {
  CharacterEquipmentItem,
  CharacterState,
  CharacteristicKey,
  GameState,
  PieceState
} from '../../shared/state'

const characteristicDefinitions: {
  key: CharacteristicKey
  label: string
  fallback: number
}[] = [
  { key: 'str', label: 'Str', fallback: 7 },
  { key: 'dex', label: 'Dex', fallback: 8 },
  { key: 'end', label: 'End', fallback: 8 },
  { key: 'int', label: 'Int', fallback: 7 },
  { key: 'edu', label: 'Edu', fallback: 9 },
  { key: 'soc', label: 'Soc', fallback: 6 }
]

const characteristicModifier = (
  characteristic: number | null | undefined
): number => (characteristic == null ? 0 : Math.floor(characteristic / 3) - 2)

export const characterSheetTabLabels = {
  details: 'Details',
  action: 'Action',
  items: 'Items',
  notes: 'Notes'
} as const

export const characterSheetEmptyLabels = {
  noActiveToken: 'No active token',
  noLinkedCharacterSheet: 'No linked character sheet',
  noTrainedSkills: 'No trained skills',
  noEquipmentListed: 'No equipment listed',
  noNotes: 'No notes'
} as const

export interface CharacteristicDisplayRow {
  key: CharacteristicKey
  label: string
  value: string
  modifier: number
  modifierLabel: string
  inputValue: string
}

export interface EquipmentDisplayItem {
  name: string
  quantity: number
  notes: string
  carried: boolean | undefined
  meta: string
}

type LegacyEquipmentItem = CharacterEquipmentItem & {
  Name?: string
  Quantity?: number
  Notes?: string
  Carried?: boolean
  carried?: boolean
}

export const selectedCharacter = (
  state: Pick<GameState, 'characters'> | null | undefined,
  piece: Pick<PieceState, 'characterId'> | null | undefined
): CharacterState | null => {
  if (!piece?.characterId) return null
  return state?.characters[piece.characterId] ?? null
}

export const characterSheetTitle = (
  piece: Pick<PieceState, 'name'> | null | undefined,
  character: Pick<CharacterState, 'name'> | null | undefined
) => character?.name || piece?.name || 'No piece'

export const characteristicRows = (
  character: Pick<CharacterState, 'characteristics'> | null | undefined
): CharacteristicDisplayRow[] => {
  const values = character?.characteristics

  return characteristicDefinitions.map(({ key, label, fallback }) => {
    const value = values?.[key] ?? fallback
    const modifier = characteristicModifier(value)
    return {
      key,
      label,
      value: String(value),
      modifier,
      modifierLabel:
        modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : String(modifier),
      inputValue: values?.[key] == null ? '' : String(values[key])
    }
  })
}

export const characterSkills = (
  character: Pick<CharacterState, 'skills'> | null | undefined
): string[] => {
  if (character && Array.isArray(character.skills)) {
    return character.skills
      .filter((skill) => typeof skill === 'string' && skill.trim())
      .map((skill) => skill.trim())
  }
  if (character) return []
  return ['Vacc Suit-0', 'Gun Combat-0', 'Mechanic-0', 'Recon-0']
}

export const skillsFromText = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean)

export const skillRollReason = (
  piece: Pick<PieceState, 'name'>,
  character: Pick<CharacterState, 'name'> | null | undefined,
  skill: string
) => `${character?.name || piece.name}: ${skill}`

const equipmentName = (item: LegacyEquipmentItem) =>
  item.Name || item.name || 'Item'

const equipmentQuantity = (item: LegacyEquipmentItem) =>
  item.Quantity ?? item.quantity ?? 1

const equipmentNotes = (item: LegacyEquipmentItem) =>
  item.notes || item.Notes || ''

const equipmentCarried = (item: LegacyEquipmentItem) =>
  item.Carried ?? item.carried

export const equipmentDisplayItems = (
  equipment: readonly CharacterEquipmentItem[] | null | undefined
): EquipmentDisplayItem[] =>
  (Array.isArray(equipment) ? equipment : []).map((item) => {
    const source = item as LegacyEquipmentItem
    const quantity = equipmentQuantity(source)
    const carried = equipmentCarried(source)

    return {
      name: equipmentName(source),
      quantity,
      notes: equipmentNotes(source),
      carried,
      meta:
        'x' +
        quantity +
        (carried === undefined ? '' : carried ? ' carried' : ' stowed')
    }
  })

export const equipmentText = (
  equipment: readonly CharacterEquipmentItem[] | null | undefined
) =>
  equipmentDisplayItems(equipment)
    .map((item) => [item.name, item.quantity, item.notes].join(' | '))
    .join('\n')

export const equipmentFromText = (value: string): CharacterEquipmentItem[] =>
  value
    .split('\n')
    .map((line) => {
      const [name = '', quantity = '1', ...notes] = line
        .split('|')
        .map((part) => part.trim())
      if (!name) return null
      const parsedQuantity = Number.parseInt(quantity, 10)
      return {
        name,
        quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 1,
        notes: notes.join(' | ')
      }
    })
    .filter((item): item is CharacterEquipmentItem => item !== null)
