import {describe, it} from 'node:test'
import {expect} from '../../test/expect'
import type {SchemaDefinition} from '../types/schema'
import {isObjectSchema} from '../types/schema'

import combatStateSchema from './combatStateSchema'

const getProperties = (
  schema: SchemaDefinition
): Record<string, SchemaDefinition | boolean> => {
  if (!isObjectSchema(schema) || schema.properties === undefined) {
    throw new Error('Expected object schema with properties')
  }

  return schema.properties
}

const getProperty = (
  schema: SchemaDefinition,
  property: string
): SchemaDefinition => {
  const value = getProperties(schema)[property]
  if (value === undefined || typeof value === 'boolean') {
    throw new Error(`Expected schema property ${property}`)
  }

  return value
}

describe('combatStateSchema', () => {
  describe('for non-animal characters', () => {
    const schema = combatStateSchema({character: {type: 'PLAYER'}})

    it('should have correct title', () => {
      expect(schema.title).toBe('Combat State')
    })

    it('should have standard characteristics for humanoid', () => {
      const chars = getProperties(getProperty(schema, 'characteristics'))
      expect(chars).toHaveProperty('str')
      expect(chars).toHaveProperty('dex')
      expect(chars).toHaveProperty('end')
      expect(chars).toHaveProperty('int')
      expect(chars).toHaveProperty('edu')
      expect(chars).toHaveProperty('soc')
    })

    it('should not have animal-specific characteristics', () => {
      const chars = getProperties(getProperty(schema, 'characteristics'))
      expect(chars).not.toHaveProperty('instinct')
      expect(chars).not.toHaveProperty('pack')
    })
  })

  describe('for animal characters', () => {
    const schema = combatStateSchema({character: {type: 'ANIMAL'}})

    it('should have animal-specific characteristics', () => {
      const chars = getProperties(getProperty(schema, 'characteristics'))
      expect(chars).toHaveProperty('str')
      expect(chars).toHaveProperty('dex')
      expect(chars).toHaveProperty('end')
      expect(chars).toHaveProperty('int')
      expect(chars).toHaveProperty('instinct')
      expect(chars).toHaveProperty('pack')
    })

    it('should not have humanoid-specific characteristics', () => {
      const chars = getProperties(getProperty(schema, 'characteristics'))
      expect(chars).not.toHaveProperty('edu')
      expect(chars).not.toHaveProperty('soc')
    })
  })

  describe('common combat properties', () => {
    const schema = combatStateSchema({character: {type: 'PLAYER'}})

    it('should have visibility and awareness properties', () => {
      expect(getProperties(schema)).toHaveProperty('visible')
      expect(getProperties(schema)).toHaveProperty('aware')
    })

    it('should have targeting property', () => {
      expect(getProperties(schema)).toHaveProperty('target')
    })

    it('should have stance with enum values', () => {
      const stance = getProperty(schema, 'stance')
      expect(stance.enum).toContain('STANDING')
      expect(stance.enum).toContain('PRONE')
      expect(stance.enum).toContain('CROUCHED')
    })

    it('should have combat status properties', () => {
      const statusProps = [
        'grappled',
        'unconscious',
        'fatigued',
        'dodge',
        'parry'
      ]
      statusProps.forEach(prop => {
        expect(getProperties(schema)).toHaveProperty(prop)
      })
    })

    it('should have combat modifier properties', () => {
      const modifierProps = ['aim', 'cover', 'weapon', 'armor', 'AR', 'group']
      modifierProps.forEach(prop => {
        expect(getProperties(schema)).toHaveProperty(prop)
      })
    })
  })
})
