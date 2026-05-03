import type {NumberProperty, StringProperty} from './schemaTypes'

interface BoardSchema {
  title: string
  type: 'object'
  required: readonly string[]
  properties: {
    name: StringProperty
    imageAssetId: StringProperty
    url: StringProperty
    scale: NumberProperty
    width: NumberProperty
    height: NumberProperty
  }
}

const boardSchema = Object.freeze({
  title: 'Board',
  type: 'object',
  required: ['name'],
  properties: {
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
    url: {
      title: 'Url',
      type: ['string', 'null']
    },
    imageAssetId: {
      title: 'Board Image',
      type: ['string', 'null']
    },
    scale: {
      type: 'number',
      title: 'Scale (px/m)',
      default: 50.0,
      minimum: 10.0,
      maximum: 100.0,
      errorMessage: {
        type: 'Must be a positive number between 10.0 and 100.0',
        minimum: 'Must be a positive number between 10.0 and 100.0',
        maximum: 'Must be a positive number between 10.0 and 100.0'
      }
    },
    width: {
      type: 'integer',
      title: 'Width',
      default: 1000,
      minimum: 100,
      maximum: 5000,
      errorMessage: {
        type: 'Must be a positive number between 100 and 5000',
        minimum: 'Must be a positive number between 100 and 5000',
        maximum: 'Must be a positive number between 100 and 5000'
      }
    },
    height: {
      type: 'integer',
      title: 'Height',
      default: 1000,
      minimum: 100,
      maximum: 5000,
      errorMessage: {
        type: 'Must be a positive number between 100 and 5000',
        minimum: 'Must be a positive number between 100 and 5000',
        maximum: 'Must be a positive number between 100 and 5000'
      }
    }
  }
} as const) satisfies BoardSchema

export default boardSchema
