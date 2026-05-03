import type {
  IntegerProperty,
  NumberProperty,
  StringProperty
} from './schemaTypes'

interface WorldSchema {
  title: string
  type: 'object'
  required: readonly string[]
  properties: {
    name: StringProperty
    primaryStarport: StringProperty
    size: IntegerProperty
    atmosphere: NumberProperty
    hydrographics: NumberProperty
    population: NumberProperty
    government: NumberProperty
    lawLevel: NumberProperty
    techLevel: NumberProperty
    tradeCodes: StringProperty
  }
}

const worldSchema = Object.freeze({
  title: 'World',
  type: 'object',
  required: [],
  properties: {
    name: {
      type: 'string',
      title: 'Name'
    },
    primaryStarport: {
      type: 'string',
      title: 'Primary Starport'
    },
    size: {
      title: 'Size',
      type: 'integer',
      minimum: 1,
      maximum: 10,
      multipleOf: 1
    },
    atmosphere: {
      type: 'number',
      title: 'Atmosphere'
    },
    hydrographics: {
      type: 'number',
      title: 'Hydrographics'
    },
    population: {
      type: 'number',
      title: 'Population'
    },
    government: {
      type: 'number',
      title: 'Government'
    },
    lawLevel: {
      type: 'number',
      title: 'Law Level'
    },
    techLevel: {
      type: 'number',
      title: 'Tech Level'
    },
    tradeCodes: {
      type: 'string',
      title: 'Trade Codes'
    }
  }
} as const) satisfies WorldSchema

export default worldSchema
