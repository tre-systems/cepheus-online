import type { SchemaProperty } from './schemaTypes'

type EquipmentSchema = SchemaProperty & {
  title: string
  type: 'object'
  required: readonly string[]
  properties: Record<string, SchemaProperty>
}

const categories = {
  ARMOR: 'ARMOR',
  COMMUNICATOR: 'COMMUNICATOR',
  COMPUTER: 'COMPUTER',
  SOFTWARE: 'SOFTWARE',
  DRUG: 'DRUG',
  EXPLOSIVE: 'EXPLOSIVE',
  PERSONAL_DEVICE: 'PERSONAL_DEVICE',
  SENSORY_AID: 'SENSORY_AID',
  SHELTER: 'SHELTER',
  SURVIVAL_EQUIPMENT: 'SURVIVAL_EQUIPMENT',
  TOOL_KIT: 'TOOL_KIT',
  MELEE_WEAPON: 'MELEE_WEAPON',
  RANGED_WEAPON: 'RANGED_WEAPON',
  AMMO: 'AMMO',
  ACCESSORY: 'ACCESSORY',
  GRENADE: 'GRENADE',
  HEAVY_WEAPON: 'HEAVY_WEAPON'
} as const

const equipmentSchema = Object.freeze({
  title: 'Item',
  type: 'object',
  required: ['Name'],
  properties: {
    Name: {
      title: 'Name',
      type: 'string'
    },
    Category: {
      title: 'Category',
      type: ['string', 'null'],
      default: '',
      enum: Object.values(categories)
    },
    Location: {
      title: 'Location',
      type: ['string', 'null'],
      default: ''
    },
    Quantity: {
      title: 'Quantity',
      type: ['integer', 'null']
    },
    Carried: {
      title: 'Carried',
      default: false,
      type: ['boolean', 'null']
    },
    TL: {
      title: 'TL',
      type: ['integer', 'null']
    },
    Cost: {
      title: 'Cost',
      type: ['number', 'null']
    },
    Wgt: {
      title: 'Weight',
      type: ['number', 'null']
    },
    RoF: {
      title: 'Rate of Fire',
      type: ['string', 'null']
    },
    Range: {
      title: 'Range',
      type: ['string', 'null']
    },
    Dmg: {
      title: 'Damage',
      type: ['string', 'null']
    },
    Type: {
      title: 'Type',
      type: ['string', 'null']
    },
    Recoil: {
      type: ['boolean', 'null'],
      default: false,
      title: 'Recoil'
    },
    LL: {
      title: 'LL',
      type: ['integer', 'null']
    },
    Description: {
      title: 'Description',
      type: ['string', 'null']
    },
    Rating: {
      title: 'Rating',
      type: ['integer', 'null']
    },
    AR: {
      title: 'AR',
      type: ['integer', 'null']
    },
    AP: {
      title: 'AP',
      type: ['integer', 'null']
    },
    LaserAR: {
      title: 'LaserAR',
      type: ['integer', 'null']
    },
    Skill: {
      title: 'Skill',
      type: ['string', 'null']
    },
    Radius: {
      title: 'Radius',
      type: ['string', 'null']
    },
    Rounds: {
      title: 'Rounds',
      type: ['integer', 'null']
    }
  }
} as const) satisfies EquipmentSchema

export default equipmentSchema
