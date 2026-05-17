import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { browserImageUrl, cropStartsInsideImage, cssUrl } from './images'

describe('image asset helpers', () => {
  it('allows browser-loadable image references', () => {
    assert.equal(browserImageUrl('/assets/board.png'), '/assets/board.png')
    assert.equal(
      browserImageUrl('asset_uploaded_1'),
      '/api/assets/asset_uploaded_1'
    )
    assert.equal(
      browserImageUrl('http://example.test/piece.png'),
      'http://example.test/piece.png'
    )
    assert.equal(
      browserImageUrl('https://example.test/piece.png'),
      'https://example.test/piece.png'
    )
    assert.equal(
      browserImageUrl('blob:https://example.test/id'),
      'blob:https://example.test/id'
    )
    assert.equal(
      browserImageUrl('data:image/png;base64,abc'),
      'data:image/png;base64,abc'
    )
  })

  it('rejects non-browser image references', () => {
    assert.equal(browserImageUrl(null), null)
    assert.equal(browserImageUrl(undefined), null)
    assert.equal(browserImageUrl(''), null)
    assert.equal(browserImageUrl('asset-id'), null)
    assert.equal(browserImageUrl('data:text/plain;base64,abc'), null)
  })

  it('serializes URLs for CSS url values', () => {
    assert.equal(
      cssUrl('/images/a b "quoted".png'),
      'url("/images/a b \\"quoted\\".png")'
    )
  })

  it('preserves crop start validation semantics', () => {
    const dimensions = { width: 100, height: 50 }

    assert.equal(cropStartsInsideImage({ x: 0, y: 0 }, dimensions), true)
    assert.equal(cropStartsInsideImage({ x: 99, y: 49 }, dimensions), true)
    assert.equal(cropStartsInsideImage({ x: 100, y: 0 }, dimensions), false)
    assert.equal(cropStartsInsideImage({ x: 0, y: 50 }, dimensions), false)
  })
})
