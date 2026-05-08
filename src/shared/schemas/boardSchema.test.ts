import { describe, it } from 'node:test'
import { expect } from '../../test/expect'

import boardSchema from './boardSchema'

describe('boardSchema', () => {
  it('should have correct title and type', () => {
    expect(boardSchema.title).toBe('Board')
    expect(boardSchema.type).toBe('object')
  })

  it('should require name field', () => {
    expect(boardSchema.required).toContain('name')
  })

  it('should have name property with validation rules', () => {
    const name = boardSchema.properties.name
    expect(name.title).toBe('Name')
    expect(name.type).toBe('string')
    expect(name.minLength).toBe(3)
    expect(name.maxLength).toBe(32)
    expect(name.pattern).toBeDefined()
  })

  it('should have url property that accepts null', () => {
    const url = boardSchema.properties.url
    expect(url.title).toBe('Url')
    expect(url.type).toContain('null')
  })

  it('should have image asset property that accepts null', () => {
    const imageAssetId = boardSchema.properties.imageAssetId
    expect(imageAssetId.title).toBe('Board Image')
    expect(imageAssetId.type).toContain('null')
  })

  it('should have scale property with range 10-100', () => {
    const scale = boardSchema.properties.scale
    expect(scale.title).toBe('Scale (px/m)')
    expect(scale.type).toBe('number')
    expect(scale.default).toBe(50.0)
    expect(scale.minimum).toBe(10.0)
    expect(scale.maximum).toBe(100.0)
  })

  it('should have width property with range 100-5000', () => {
    const width = boardSchema.properties.width
    expect(width.title).toBe('Width')
    expect(width.type).toBe('integer')
    expect(width.default).toBe(1000)
    expect(width.minimum).toBe(100)
    expect(width.maximum).toBe(5000)
  })

  it('should have height property with range 100-5000', () => {
    const height = boardSchema.properties.height
    expect(height.title).toBe('Height')
    expect(height.type).toBe('integer')
    expect(height.default).toBe(1000)
    expect(height.minimum).toBe(100)
    expect(height.maximum).toBe(5000)
  })

  it('should have error messages defined', () => {
    expect(boardSchema.properties.name.errorMessage).toBeDefined()
    expect(boardSchema.properties.scale.errorMessage).toBeDefined()
    expect(boardSchema.properties.width.errorMessage).toBeDefined()
    expect(boardSchema.properties.height.errorMessage).toBeDefined()
  })
})
