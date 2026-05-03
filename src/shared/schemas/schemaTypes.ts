import type {
  ArraySchema,
  BooleanSchema,
  IntegerSchema,
  MultiTypeSchema,
  NumberSchema,
  ObjectSchema,
  SchemaDefinition,
  StringSchema
} from '../types/schema'

export type {
  SchemaDefinition as SchemaProperty,
  SchemaType
} from '../types/schema'

export type StringProperty = StringSchema | MultiTypeSchema
export type NumberProperty = NumberSchema | IntegerSchema | MultiTypeSchema
export type IntegerProperty = IntegerSchema | MultiTypeSchema
export type BooleanProperty = BooleanSchema | MultiTypeSchema
export type ArrayProperty = ArraySchema | MultiTypeSchema
export type EnumProperty = SchemaDefinition
export type ObjectProperty = ObjectSchema | MultiTypeSchema
