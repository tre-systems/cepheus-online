import {describe, expect, it} from 'vitest'

import characterSchemaFunction from './characterSchema'

const mockRuleset = {
  gender: {MALE: 'Male', FEMALE: 'Female', OTHER: 'Other'},
  homeWorldSkillsByLawLevel: {'0': 'Skill1', '1': 'Skill2'},
  homeWorldSkillsByTradeCode: {AG: 'Agricultural', IN: 'Industrial'}
}

describe('characterSchema', () => {
  describe('for PLAYER type', () => {
    const schema = characterSchemaFunction({
      ruleset: mockRuleset,
      character: {type: 'PLAYER'}
    })

    it('should have correct title', () => {
      expect(schema.title).toBe('Character')
    })

    it('should have basic properties', () => {
      expect(schema.properties.name.type).toBe('string')
      expect(schema.properties.type.enum).toContain('PLAYER')
      expect(schema.properties.gender.enum).toContain('Male')
    })

    it('should have standard humanoid characteristics', () => {
      const chars = schema.properties.characteristics
      expect(chars.properties).toHaveProperty('str')
      expect(chars.properties).toHaveProperty('dex')
      expect(chars.properties).toHaveProperty('end')
      expect(chars.properties).toHaveProperty('int')
      expect(chars.properties).toHaveProperty('edu')
      expect(chars.properties).toHaveProperty('soc')
    })

    it('should have homeWorld with ruleset options', () => {
      const homeWorld = schema.properties.homeWorld
      const lawLevel = homeWorld.properties?.lawLevel as {enum?: string[]}
      const tradeCodes = homeWorld.properties?.tradeCodes as {enum?: string[]}
      expect(lawLevel.enum).toContain('0')
      expect(tradeCodes.enum).toContain('AG')
    })
  })

  describe('for NPC type', () => {
    const schema = characterSchemaFunction({
      ruleset: mockRuleset,
      character: {type: 'NPC'}
    })

    it('should have standard humanoid characteristics', () => {
      const chars = schema.properties.characteristics
      expect(chars.properties).toHaveProperty('edu')
      expect(chars.properties).toHaveProperty('soc')
    })
  })

  describe('for ANIMAL type', () => {
    const schema = characterSchemaFunction({
      ruleset: mockRuleset,
      character: {type: 'ANIMAL'}
    })

    it('should have animal-specific characteristics', () => {
      const chars = schema.properties.characteristics
      expect(chars.properties).toHaveProperty('str')
      expect(chars.properties).toHaveProperty('dex')
      expect(chars.properties).toHaveProperty('end')
      expect(chars.properties).toHaveProperty('int')
      expect(chars.properties).toHaveProperty('instinct')
      expect(chars.properties).toHaveProperty('pack')
    })

    it('should not have humanoid-specific characteristics', () => {
      const chars = schema.properties.characteristics
      expect(chars.properties).not.toHaveProperty('edu')
      expect(chars.properties).not.toHaveProperty('soc')
    })

    it('should have animalData property', () => {
      const animalData = schema.properties.animalData
      expect(animalData.properties).toHaveProperty('size')
      expect(animalData.properties).toHaveProperty('type')
      expect(animalData.properties).toHaveProperty('terrain')
      expect(animalData.properties).toHaveProperty('locomotion')
      expect(animalData.properties).toHaveProperty('speed')
    })
  })

  describe('for ROBOT type', () => {
    const schema = characterSchemaFunction({
      ruleset: mockRuleset,
      character: {type: 'ROBOT'}
    })

    it('should have robot-specific characteristics', () => {
      const chars = schema.properties.characteristics
      expect(chars.properties).toHaveProperty('str')
      expect(chars.properties).toHaveProperty('dex')
      expect(chars.properties).toHaveProperty('int')
      expect(chars.properties).toHaveProperty('edu')
      expect(chars.properties).toHaveProperty('soc')
    })

    it('should not have END characteristic', () => {
      const chars = schema.properties.characteristics
      expect(chars.properties).not.toHaveProperty('end')
    })

    it('should have hull and structure properties', () => {
      expect(schema.properties.hull).toBeDefined()
      expect(schema.properties.structure).toBeDefined()
    })
  })

  describe('common properties', () => {
    const schema = characterSchemaFunction({
      ruleset: mockRuleset,
      character: {type: 'PLAYER'}
    })

    it('should have credits properties', () => {
      expect(schema.properties.credits.type).toBe('number')
      expect(schema.properties.startingCredits.type).toBe('number')
    })

    it('should have skills array', () => {
      expect(schema.properties.skills.type).toBe('array')
    })

    it('should have notes and description', () => {
      expect(schema.properties.notes).toBeDefined()
      expect(schema.properties.description).toBeDefined()
    })
  })
})
