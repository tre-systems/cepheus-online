import type {SchemaProperty} from './schemaTypes'

type PieceSchema = SchemaProperty & {
  title: string
  type: 'object'
  required: readonly string[]
  properties: Record<string, SchemaProperty>
}

const pieceEnum = ['pawn', 'marker', 'token', 'figurine', 'miniature'] as const

export const visibility = Object.freeze({
  HIDDEN: 'HIDDEN',
  PREVIEW: 'PREVIEW',
  VISIBLE: 'VISIBLE'
} as const)

export const freedom = Object.freeze({
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED',
  SHARE: 'SHARE'
} as const)

const pieceSchema = Object.freeze({
  title: 'Piece',
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      title: 'Name',
      type: 'string',
      minLength: 3,
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$',
      errorMessage: {
        type: 'Must be a string.',
        minLength: 'Must be at least 3 characters long.',
        maxLength: 'Must be shorter than 32 characters.',
        required: 'Is required.',
        pattern:
          'Must consist of upper or lowercase characters or numbers separated by a space underscore or dash.'
      }
    },
    type: {
      title: 'Type',
      type: 'string',
      enum: [...pieceEnum],
      enumNames: pieceEnum.map(i => i.charAt(0).toUpperCase() + i.slice(1))
    },
    scale: {
      type: 'number',
      title: 'Scale',
      default: 1.0,
      minimum: 0.1,
      maximum: 50.0,
      errorMessage: {
        type: 'Must be a positive number between 0.1 and 50.0',
        minimum: 'Must be a positive number between 0.1 and 50.0',
        maximum: 'Must be a positive number between 0.1 and 50.0'
      }
    },
    width: {
      type: 'number',
      title: 'Width',
      default: 50,
      minimum: 1,
      maximum: 500,
      errorMessage: {
        type: 'Must be a positive number between 1 and 500',
        minimum: 'Must be a positive number between 1 and 500',
        maximum: 'Must be a positive number between 1 and 500'
      }
    },
    height: {
      type: 'number',
      title: 'Height',
      default: 50,
      minimum: 1,
      maximum: 500,
      errorMessage: {
        type: 'Must be a positive number between 1 and 500',
        minimum: 'Must be a positive number between 1 and 500',
        maximum: 'Must be a positive number between 1 and 500'
      }
    },
    visibility: {
      type: ['string', 'null'],
      title: 'Visibility',
      default: visibility.PREVIEW,
      enum: Object.values(visibility)
    },
    freedom: {
      type: ['string', 'null'],
      title: 'Freedom',
      default: freedom.UNLOCKED,
      enum: Object.values(freedom)
    }
  }
} as const) satisfies PieceSchema

export default pieceSchema
