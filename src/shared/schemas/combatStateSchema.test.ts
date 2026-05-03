import {describe, expect, it} from 'vitest'

import combatStateSchema from './combatStateSchema'

type Schema = any

describe('combatStateSchema', () => {
  describe('for non-animal characters', () => {
    const schema: Schema = combatStateSchema({character: {type: 'PLAYER'}})

    it('should have correct title', () => {
      expect(schema.title).toBe('Combat State')
    })

    it('should have standard characteristics for humanoid', () => {
      const chars = schema.properties?.characteristics
      expect(chars.properties).toHaveProperty('str')
      expect(chars.properties).toHaveProperty('dex')
      expect(chars.properties).toHaveProperty('end')
      expect(chars.properties).toHaveProperty('int')
      expect(chars.properties).toHaveProperty('edu')
      expect(chars.properties).toHaveProperty('soc')
    })

    it('should not have animal-specific characteristics', () => {
      const chars = schema.properties?.characteristics
      expect(chars.properties).not.toHaveProperty('instinct')
      expect(chars.properties).not.toHaveProperty('pack')
    })
  })

  describe('for animal characters', () => {
    const schema: Schema = combatStateSchema({character: {type: 'ANIMAL'}})

    it('should have animal-specific characteristics', () => {
      const chars = schema.properties?.characteristics
      expect(chars.properties).toHaveProperty('str')
      expect(chars.properties).toHaveProperty('dex')
      expect(chars.properties).toHaveProperty('end')
      expect(chars.properties).toHaveProperty('int')
      expect(chars.properties).toHaveProperty('instinct')
      expect(chars.properties).toHaveProperty('pack')
    })

    it('should not have humanoid-specific characteristics', () => {
      const chars = schema.properties?.characteristics
      expect(chars.properties).not.toHaveProperty('edu')
      expect(chars.properties).not.toHaveProperty('soc')
    })
  })

  describe('common combat properties', () => {
    const schema: Schema = combatStateSchema({character: {type: 'PLAYER'}})

    it('should have visibility and awareness properties', () => {
      expect(schema.properties).toHaveProperty('visible')
      expect(schema.properties).toHaveProperty('aware')
    })

    it('should have targeting property', () => {
      expect(schema.properties).toHaveProperty('target')
    })

    it('should have stance with enum values', () => {
      const stance = schema.properties?.stance
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
        expect(schema.properties).toHaveProperty(prop)
      })
    })

    it('should have combat modifier properties', () => {
      const modifierProps = ['aim', 'cover', 'weapon', 'armor', 'AR', 'group']
      modifierProps.forEach(prop => {
        expect(schema.properties).toHaveProperty(prop)
      })
    })
  })
})
