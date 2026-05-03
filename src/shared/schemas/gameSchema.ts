import type {
  BooleanProperty,
  IntegerProperty,
  StringProperty
} from './schemaTypes'

interface GameSchema {
  title: string
  type: 'object'
  required: readonly string[]
  properties: {
    slug: StringProperty
    name: StringProperty
    allowSpectators: BooleanProperty
    allowCharacterDelete: BooleanProperty
    allowCharacterImport: BooleanProperty
    restrictMovement: BooleanProperty
    maxCharactersPerPlayer: IntegerProperty
  }
}

const gameSchema = Object.freeze({
  title: 'Game',
  type: 'object',
  required: ['name', 'slug', 'maxCharactersPerPlayer'],
  properties: {
    slug: {
      title: 'id',
      type: 'string',
      pattern: '^[0-9a-z](-?[0-9a-z])*$',
      minLength: 3,
      maxLength: 36,
      errorMessage: {
        type: 'Must be a string.',
        minLength: 'Must be at least 3 characters long.',
        maxLength: 'Must be shorter than 36 characters.',
        pattern: 'Must be all lowercase separated by dashes.'
      }
    },
    name: {
      title: 'Name',
      type: 'string',
      pattern: '^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$',
      minLength: 3,
      maxLength: 32,
      errorMessage: {
        type: 'Must be a string.',
        minLength: 'Must be at least 3 characters long.',
        maxLength: 'Must be shorter than 32 characters.',
        required: 'Is required.',
        pattern:
          'Must consist of upper or lowercase characters or numbers separated by a space underscore or dash.'
      }
    },
    allowSpectators: {
      type: ['boolean', 'null'],
      default: false,
      title: 'Allow Spectators'
    },
    allowCharacterDelete: {
      type: ['boolean', 'null'],
      default: false,
      title: 'Allow Character Delete'
    },
    allowCharacterImport: {
      type: ['boolean', 'null'],
      default: false,
      title: 'Allow Character Import'
    },
    restrictMovement: {
      type: ['boolean', 'null'],
      default: false,
      title: 'Restrict Movement'
    },
    maxCharactersPerPlayer: {
      type: 'integer',
      title: 'Max Characters Per Player',
      default: 1,
      minimum: 1,
      maximum: 20,
      errorMessage: {
        type: 'Must be a positive number between 1 and 20.',
        minimum: 'Must be a positive number between 1 and 20.',
        maximum: 'Must be a positive number between 1 and 20.'
      }
    }
  }
} as const) satisfies GameSchema

export default gameSchema
