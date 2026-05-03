import type {SchemaProperty} from './schemaTypes'

export const color = Object.freeze({
  title: 'Color',
  type: 'string',
  pattern: '^#([A-Fa-f0-9]{3}){1,2}$',
  minLength: 4,
  maxLength: 7,
  errorMessage: {
    type: 'The color must be a string.',
    minLength: 'The color must be at least 4 characters long.',
    maxLength: 'The color must be shorter than 7 characters.',
    required: 'The color is required.',
    pattern: 'The color must be a CSS hex color code.'
  }
} as const) satisfies SchemaProperty

export const emailAddress = Object.freeze({
  title: 'Email Address',
  type: ['string', 'null'],
  pattern: '^\\S+@\\S+\\.\\S+$',
  minLength: 3,
  maxLength: 254,
  errorMessage: {
    type: 'The email address must be a string.',
    minLength: 'The email address must be at least 3 characters long.',
    maxLength: 'The email address must be shorter than 254 characters.',
    pattern: 'The email address is not valid.'
  }
} as const) satisfies SchemaProperty

export const logo = Object.freeze({
  title: 'Logo',
  type: ['string', 'null'],
  pattern: '\\.(gif|jpe?g|png|webp)$',
  minLength: 5,
  maxLength: 254,
  errorMessage: {
    type: 'The logo file name must be a string.',
    minLength: 'The logo file name must be at least 5 characters long.',
    maxLength: 'The logo file name must be shorter than 254 characters.',
    pattern:
      'The logo file name cannot contain spaces and must end in an image extension (.jpg .png .gif).'
  }
} as const) satisfies SchemaProperty

export const dateTime = Object.freeze({
  title: 'DateTime',
  type: ['string', 'null'],
  format: 'date-time',
  pattern:
    '^([+-]?\\d{4}(?!\\d{2}\\b))((-?)((0[1-9]|1[0-2])(\\3([12]\\d|0[1-9]|3[01]))?|W([0-4]\\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\\d|[12]\\d{2}|3([0-5]\\d|6[1-6])))([T\\s]((([01]\\d|2[0-3])((:?)[0-5]\\d)?|24:?00)([.,]\\d+(?!:))?)?(\\17[0-5]\\d([.,]\\d+)?)?([zZ]|([+-])([01]\\d|2[0-3]):?([0-5]\\d)?)?)?(Z|[+-](?:2[0-3]|[01][0-9])(?::?(?:[0-5][0-9]))?)?$',
  errorMessage: {
    type: 'The DateTime must be a string.',
    pattern: 'The DateTime is not a valid AWSDateTime.'
  }
} as const) satisfies SchemaProperty

export const slug = Object.freeze({
  title: 'Slug',
  type: ['string', 'null'],
  pattern: '^[a-z](-?[0-9a-z])*$',
  errorMessage: {
    type: 'The Slug must be a string.',
    pattern: 'The Slug must be all lowercase separated by dashes.'
  }
} as const) satisfies SchemaProperty

const guidPattern =
  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$'

export const guid = Object.freeze({
  title: 'Guid',
  type: ['string', 'null'],
  pattern: guidPattern,
  errorMessage: {
    type: 'Must be a string.',
    pattern: 'Must be valid UUID.'
  }
} as const) satisfies SchemaProperty

export const gameID = Object.freeze({
  title: 'Game ID',
  type: ['string', 'null'],
  pattern: guidPattern,
  errorMessage: {
    type: 'Game ID must be a string.',
    pattern: 'Game ID must be valid UUID.'
  }
} as const) satisfies SchemaProperty
