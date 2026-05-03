import type {
  ArrayProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  SchemaProperty,
  SchemaType,
  StringProperty
} from './schemaTypes'

interface Character {
  type: 'PLAYER' | 'NPC' | 'ANIMAL' | 'ROBOT'
}

interface Ruleset {
  gender: Record<string, string>
  homeWorldSkillsByLawLevel: Record<string, string>
  homeWorldSkillsByTradeCode: Record<string, string>
}

type CharacteristicProperty = SchemaProperty & {
  type: readonly SchemaType[]
  title: string
}

type CharacteristicsSchema = SchemaProperty & {
  type: 'object'
  title: string
  properties: Record<string, CharacteristicProperty>
}

interface CharacterSchema {
  title: string
  type: 'object'
  required: readonly string[]
  properties: {
    name: StringProperty
    type: EnumProperty
    image: StringProperty
    gender: EnumProperty
    age: NumberProperty
    displayTitle: NumberProperty
    characteristics: CharacteristicsSchema
    homeWorld: ObjectProperty
    credits: NumberProperty
    startingCredits: NumberProperty
    materialBenefits: ArrayProperty
    notes: StringProperty
    description: StringProperty
    traits: StringProperty
    price: NumberProperty
    hull: NumberProperty
    structure: NumberProperty
    skills: ArrayProperty
    animalData: ObjectProperty
  }
}

const characterSchemaFunction = ({
  ruleset,
  character
}: {
  ruleset: Ruleset
  character: Character
}): CharacterSchema => {
  const getCharacteristics = (): CharacteristicsSchema => {
    if (character.type === 'ROBOT') {
      return {
        type: 'object',
        title: 'Characteristics',
        properties: {
          str: {type: ['number', 'null'], title: 'Str'},
          dex: {type: ['number', 'null'], title: 'Dex'},
          int: {type: ['number', 'null'], title: 'Int'},
          edu: {type: ['number', 'null'], title: 'Edu'},
          soc: {type: ['number', 'null'], title: 'Soc'}
        }
      }
    }
    if (character.type === 'ANIMAL') {
      return {
        type: 'object',
        title: 'Characteristics',
        properties: {
          str: {type: ['number', 'null'], title: 'Str'},
          dex: {type: ['number', 'null'], title: 'Dex'},
          end: {type: ['number', 'null'], title: 'End'},
          int: {type: ['number', 'null'], title: 'Int'},
          instinct: {type: ['number', 'null'], title: 'Instinct'},
          pack: {type: ['number', 'null'], title: 'Pack'}
        }
      }
    }

    return {
      type: 'object',
      title: 'Characteristics',
      properties: {
        str: {type: ['number', 'null'], title: 'Str'},
        dex: {type: ['number', 'null'], title: 'Dex'},
        end: {type: ['number', 'null'], title: 'End'},
        int: {type: ['number', 'null'], title: 'Int'},
        edu: {type: ['number', 'null'], title: 'Edu'},
        soc: {type: ['number', 'null'], title: 'Soc'}
      }
    }
  }

  return {
    title: 'Character',
    type: 'object',
    required: [],
    properties: {
      name: {type: 'string', title: 'Name'},
      type: {
        title: 'Type',
        type: 'string',
        enum: ['PLAYER', 'NPC', 'ANIMAL', 'ROBOT']
      },
      image: {type: 'string', title: 'Image'},
      gender: {
        title: 'Gender',
        type: 'string',
        enum: Object.values(ruleset.gender)
      },
      age: {type: ['number', 'null'], title: 'Age'},
      displayTitle: {type: ['boolean', 'null'], title: 'Show Title'},
      characteristics: getCharacteristics(),
      homeWorld: {
        type: 'object',
        title: 'Home World',
        properties: {
          name: {type: ['string', 'null'], title: 'Home'},
          lawLevel: {
            type: 'string',
            title: 'Law Level',
            enum: Object.keys(ruleset.homeWorldSkillsByLawLevel)
          },
          tradeCodes: {
            type: 'string',
            title: 'Trade Code',
            enum: Object.keys(ruleset.homeWorldSkillsByTradeCode)
          }
        }
      },
      credits: {type: 'number', title: 'Credits'},
      startingCredits: {type: 'number', title: 'Starting Credits'},
      materialBenefits: {
        type: 'array',
        title: 'Material Benefits',
        default: [],
        items: {type: 'string'}
      },
      notes: {type: 'string', title: ''},
      description: {type: ['string', 'null'], title: 'Description'},
      traits: {type: ['string', 'null'], title: 'Traits'},
      price: {type: ['number', 'null'], title: 'Price'},
      hull: {type: ['number', 'null'], title: 'Hull'},
      structure: {type: ['number', 'null'], title: 'Structure'},
      skills: {
        type: 'array',
        title: 'Skills',
        default: [],
        items: {type: 'string'}
      },
      animalData: {
        type: 'object',
        title: 'Animal Data',
        required: [],
        properties: {
          size: {type: ['number', 'null'], title: 'Size'},
          subType: {type: ['string', 'null'], title: 'Sub Type'},
          type: {type: ['string', 'null'], title: 'Type'},
          terrain: {type: ['string', 'null'], title: 'Terrain'},
          locomotion: {type: ['string', 'null'], title: 'Locomotion'},
          speed: {type: ['number', 'null'], title: 'Speed'}
        }
      }
    }
  }
}

export default characterSchemaFunction
