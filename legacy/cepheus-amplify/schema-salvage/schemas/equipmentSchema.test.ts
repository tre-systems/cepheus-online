import { describe, it } from 'node:test'
import { expect } from '../../test/expect'

import equipmentSchema from './equipmentSchema'

describe('equipmentSchema', () => {
  it('should have correct title and type', () => {
    expect(equipmentSchema.title).toBe('Item')
    expect(equipmentSchema.type).toBe('object')
  })

  it('should require Name field', () => {
    expect(equipmentSchema.required).toContain('Name')
  })

  it('should have Name property', () => {
    const name = equipmentSchema.properties.Name
    expect(name.title).toBe('Name')
    expect(name.type).toBe('string')
  })

  it('should have Category property with equipment categories', () => {
    const category = equipmentSchema.properties.Category
    expect(category.title).toBe('Category')
    expect(category.type).toContain('null')
    expect(category.enum).toContain('ARMOR')
    expect(category.enum).toContain('MELEE_WEAPON')
    expect(category.enum).toContain('RANGED_WEAPON')
    expect(category.enum).toContain('AMMO')
  })

  it('should have all expected weapon properties', () => {
    const weaponProps = ['RoF', 'Range', 'Dmg', 'Recoil', 'Skill', 'Rounds']
    weaponProps.forEach((prop) => {
      expect(equipmentSchema.properties).toHaveProperty(prop)
    })
  })

  it('should have all expected armor properties', () => {
    const armorProps = ['AR', 'AP', 'LaserAR']
    armorProps.forEach((prop) => {
      expect(equipmentSchema.properties).toHaveProperty(prop)
    })
  })

  it('should have general equipment properties', () => {
    const generalProps = [
      'Location',
      'Quantity',
      'Carried',
      'TL',
      'Cost',
      'Wgt',
      'Description'
    ]
    generalProps.forEach((prop) => {
      expect(equipmentSchema.properties).toHaveProperty(prop)
    })
  })

  it('should have Carried default to false', () => {
    expect(equipmentSchema.properties.Carried.default).toBe(false)
  })

  it('should have Recoil default to false', () => {
    expect(equipmentSchema.properties.Recoil.default).toBe(false)
  })

  it('should allow null for optional numeric fields', () => {
    const nullableNumericProps = [
      'Quantity',
      'TL',
      'Cost',
      'Wgt',
      'Rating',
      'AR',
      'AP',
      'Rounds'
    ]
    nullableNumericProps.forEach((prop) => {
      const propSchema =
        equipmentSchema.properties[
          prop as keyof typeof equipmentSchema.properties
        ]
      expect(propSchema.type).toContain('null')
    })
  })
})
