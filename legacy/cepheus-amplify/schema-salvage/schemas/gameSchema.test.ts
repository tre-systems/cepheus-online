import { describe, it } from 'node:test'
import { expect } from '../../test/expect'

import gameSchema from './gameSchema'

describe('gameSchema', () => {
  it('should have correct title and type', () => {
    expect(gameSchema.title).toBe('Game')
    expect(gameSchema.type).toBe('object')
  })

  it('should require name, slug, and maxCharactersPerPlayer', () => {
    expect(gameSchema.required).toContain('name')
    expect(gameSchema.required).toContain('slug')
    expect(gameSchema.required).toContain('maxCharactersPerPlayer')
  })

  it('should have slug property with validation', () => {
    const slug = gameSchema.properties.slug
    expect(slug.title).toBe('id')
    expect(slug.type).toBe('string')
    expect(slug.minLength).toBe(3)
    expect(slug.maxLength).toBe(36)
    expect(slug.pattern).toBe('^[0-9a-z](-?[0-9a-z])*$')
  })

  it('should have name property with validation', () => {
    const name = gameSchema.properties.name
    expect(name.title).toBe('Name')
    expect(name.type).toBe('string')
    expect(name.minLength).toBe(3)
    expect(name.maxLength).toBe(32)
  })

  it('should have boolean settings with null support', () => {
    const booleanProps = [
      'allowSpectators',
      'allowCharacterDelete',
      'allowCharacterImport',
      'restrictMovement'
    ] as const

    booleanProps.forEach((prop) => {
      const propSchema = gameSchema.properties[prop]
      expect(propSchema.type).toContain('boolean')
      expect(propSchema.type).toContain('null')
      expect((propSchema as { default: boolean }).default).toBe(false)
    })
  })

  it('should have maxCharactersPerPlayer with range 1-20', () => {
    const maxChars = gameSchema.properties.maxCharactersPerPlayer
    expect(maxChars.title).toBe('Max Characters Per Player')
    expect(maxChars.type).toBe('integer')
    expect(maxChars.default).toBe(1)
    expect(maxChars.minimum).toBe(1)
    expect(maxChars.maximum).toBe(20)
  })

  it('should have error messages for validated fields', () => {
    expect(gameSchema.properties.slug.errorMessage).toBeDefined()
    expect(gameSchema.properties.name.errorMessage).toBeDefined()
    expect(
      gameSchema.properties.maxCharactersPerPlayer.errorMessage
    ).toBeDefined()
  })
})
