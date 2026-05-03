import {describe, it} from 'node:test'
import {expect} from '../../test/expect'

import worldSchema from './worldSchema'

describe('worldSchema', () => {
  it('should have correct title and type', () => {
    expect(worldSchema.title).toBe('World')
    expect(worldSchema.type).toBe('object')
  })

  it('should have no required fields', () => {
    expect(worldSchema.required).toHaveLength(0)
  })

  it('should have name property', () => {
    expect(worldSchema.properties.name.title).toBe('Name')
    expect(worldSchema.properties.name.type).toBe('string')
  })

  it('should have primaryStarport property', () => {
    expect(worldSchema.properties.primaryStarport.title).toBe(
      'Primary Starport'
    )
    expect(worldSchema.properties.primaryStarport.type).toBe('string')
  })

  it('should have size property with validation', () => {
    const size = worldSchema.properties.size
    expect(size.title).toBe('Size')
    expect(size.type).toBe('integer')
    expect(size.minimum).toBe(1)
    expect(size.maximum).toBe(10)
    expect(size.multipleOf).toBe(1)
  })

  it('should have all UWP properties', () => {
    const uwpProps = [
      'atmosphere',
      'hydrographics',
      'population',
      'government',
      'lawLevel',
      'techLevel'
    ]

    uwpProps.forEach(prop => {
      const propSchema =
        worldSchema.properties[prop as keyof typeof worldSchema.properties]
      expect(propSchema.type).toBe('number')
    })
  })

  it('should have tradeCodes property', () => {
    expect(worldSchema.properties.tradeCodes.title).toBe('Trade Codes')
    expect(worldSchema.properties.tradeCodes.type).toBe('string')
  })
})
