import type { SchemaProperty } from './schemaTypes'

interface Character {
  type: string
}

interface CombatStateSchemaParams {
  character: Character
}

const combatStateSchema = ({
  character
}: CombatStateSchemaParams): SchemaProperty => ({
  title: 'Combat State',
  type: 'object',
  required: [],
  properties: {
    characteristics:
      character.type === 'ANIMAL'
        ? {
            type: 'object',
            title: 'Characteristics',
            properties: {
              str: {
                type: ['number', 'null'],
                title: 'Str'
              },
              dex: {
                type: ['number', 'null'],
                title: 'Dex'
              },
              end: {
                type: ['number', 'null'],
                title: 'End'
              },
              int: {
                type: ['number', 'null'],
                title: 'Int'
              },
              instinct: {
                type: ['number', 'null'],
                title: 'Instinct'
              },
              pack: {
                type: ['number', 'null'],
                title: 'Pack'
              }
            }
          }
        : {
            type: 'object',
            title: 'Characteristics',
            properties: {
              str: {
                type: ['number', 'null'],
                title: 'Str'
              },
              dex: {
                type: ['number', 'null'],
                title: 'Dex'
              },
              end: {
                type: ['number', 'null'],
                title: 'End'
              },
              int: {
                type: ['number', 'null'],
                title: 'Int'
              },
              edu: {
                type: ['number', 'null'],
                title: 'Edu'
              },
              soc: {
                type: ['number', 'null'],
                title: 'Soc'
              }
            }
          },
    visible: {
      type: ['boolean', 'null'],
      title: 'Visible'
    },
    aware: {
      type: ['boolean', 'null'],
      title: 'Aware'
    },
    target: {
      type: ['string', 'null'],
      title: 'Target'
    },
    stance: {
      title: 'Stance',
      type: 'string',
      default: '',
      enum: ['STANDING', 'PRONE', 'CROUCHED']
    },
    grappled: {
      type: ['boolean', 'null'],
      title: 'Grappled'
    },
    unconscious: {
      type: ['boolean', 'null'],
      title: 'Unconscious'
    },
    fatigued: {
      type: ['boolean', 'null'],
      title: 'Fatigued'
    },
    aim: {
      type: ['number', 'null'],
      title: 'Aim'
    },
    cover: {
      type: ['number', 'null'],
      title: 'Cover'
    },
    weapon: {
      type: ['string', 'null'],
      title: 'Weapon'
    },
    armor: {
      type: ['string', 'null'],
      title: 'Armor'
    },
    AR: {
      type: ['string', 'null'],
      title: 'AR'
    },
    group: {
      type: ['string', 'null'],
      title: 'Group'
    },
    dodge: {
      type: ['boolean', 'null'],
      title: 'Dodge'
    },
    parry: {
      type: ['boolean', 'null'],
      title: 'Parry'
    }
  }
})

export default combatStateSchema
