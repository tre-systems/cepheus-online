import {describe, it} from 'node:test'
import {expect} from '../../test/expect'

import pieceSchema from './pieceSchema'

describe('pieceSchema', () => {
  it('should have correct title and type', () => {
    expect(pieceSchema.title).toBe('Piece')
    expect(pieceSchema.type).toBe('object')
  })

  it('should require name field', () => {
    expect(pieceSchema.required).toContain('name')
  })

  it('should have name property with validation', () => {
    const name = pieceSchema.properties.name
    expect(name.title).toBe('Name')
    expect(name.type).toBe('string')
    expect(name.minLength).toBe(3)
    expect(name.maxLength).toBe(32)
    expect(name.pattern).toBeDefined()
    expect(name.errorMessage).toBeDefined()
  })

  it('should have type property with enum', () => {
    const type = pieceSchema.properties.type
    expect(type.title).toBe('Type')
    expect(type.enum).toContain('pawn')
    expect(type.enum).toContain('marker')
    expect(type.enum).toContain('token')
    expect(type.enum).toContain('figurine')
    expect(type.enum).toContain('miniature')
  })

  it('should have nullable image asset property', () => {
    const imageAssetId = pieceSchema.properties.imageAssetId
    expect(imageAssetId.title).toBe('Counter Image')
    expect(imageAssetId.type).toContain('null')
  })

  it('should have scale property with valid range', () => {
    const scale = pieceSchema.properties.scale
    expect(scale.title).toBe('Scale')
    expect(scale.type).toBe('number')
    expect(scale.default).toBe(1.0)
    expect(scale.minimum).toBe(0.1)
    expect(scale.maximum).toBe(50.0)
  })

  it('should have width property with valid range', () => {
    const width = pieceSchema.properties.width
    expect(width.title).toBe('Width')
    expect(width.default).toBe(50)
    expect(width.minimum).toBe(1)
    expect(width.maximum).toBe(500)
  })

  it('should have height property with valid range', () => {
    const height = pieceSchema.properties.height
    expect(height.title).toBe('Height')
    expect(height.default).toBe(50)
    expect(height.minimum).toBe(1)
    expect(height.maximum).toBe(500)
  })

  it('should have visibility property with enum values', () => {
    const visibility = pieceSchema.properties.visibility
    expect(visibility.title).toBe('Visibility')
    expect(visibility.type).toContain('null')
    expect(visibility.enum).toBeDefined()
  })

  it('should have freedom property with enum values', () => {
    const freedom = pieceSchema.properties.freedom
    expect(freedom.title).toBe('Freedom')
    expect(freedom.type).toContain('null')
    expect(freedom.enum).toBeDefined()
  })
})
