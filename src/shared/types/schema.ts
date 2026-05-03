import type {JsonValue} from './json'

export type SchemaType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'

export type SchemaErrorMessage = Record<string, string> | string

export type SchemaDefinition =
  | ObjectSchema
  | ArraySchema
  | ScalarSchema
  | MultiTypeSchema

type SchemaValue = string | number | boolean | null
type SchemaEnum = readonly SchemaValue[]
type SchemaProperties = Record<string, SchemaDefinition | boolean>
type SchemaItems = SchemaDefinition | boolean

interface BaseSchema {
  title?: string
  type: SchemaType | readonly SchemaType[]
  enum?: SchemaEnum
  enumNames?: readonly string[]
  default?: JsonValue
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  format?: string
  pattern?: string
  errorMessage?: SchemaErrorMessage
}

export interface ObjectSchema extends BaseSchema {
  type: 'object'
  required?: readonly string[]
  properties?: SchemaProperties
}

export interface ArraySchema extends BaseSchema {
  type: 'array'
  items?: SchemaItems
}

export interface StringSchema extends BaseSchema {
  type: 'string'
}

export interface NumberSchema extends BaseSchema {
  type: 'number'
}

export interface IntegerSchema extends BaseSchema {
  type: 'integer'
}

export interface BooleanSchema extends BaseSchema {
  type: 'boolean'
}

export interface NullSchema extends BaseSchema {
  type: 'null'
}

export type ScalarSchema =
  | StringSchema
  | NumberSchema
  | IntegerSchema
  | BooleanSchema
  | NullSchema

export interface MultiTypeSchema extends BaseSchema {
  type: readonly SchemaType[]
  required?: readonly string[]
  properties?: SchemaProperties
  items?: SchemaItems
}

export const isObjectSchema = (
  schema: SchemaDefinition
): schema is ObjectSchema | MultiTypeSchema =>
  schema.type === 'object' ||
  (Array.isArray(schema.type) && schema.type.includes('object'))
