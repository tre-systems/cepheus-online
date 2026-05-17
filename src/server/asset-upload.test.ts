import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeLosSidecarInput,
  parsePositiveGridScale,
  parseUploadedImageDimensions,
  validateAssetContentType
} from './asset-upload'

const minimalPng = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set(new TextEncoder().encode('IHDR'), 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('asset upload validation', () => {
  it('accepts supported image content types and rejects others', () => {
    assert.deepEqual(validateAssetContentType('image/png; charset=binary'), {
      ok: true,
      value: 'image/png'
    })
    assert.equal(validateAssetContentType('image/svg+xml').ok, false)
  })

  it('reads PNG dimensions from uploaded bytes', () => {
    const result = parseUploadedImageDimensions(
      minimalPng(320, 240),
      'image/png'
    )

    assert.deepEqual(result, {
      ok: true,
      value: { width: 320, height: 240 }
    })
  })

  it('parses grid scale with a conservative default', () => {
    assert.deepEqual(parsePositiveGridScale(null), { ok: true, value: 50 })
    assert.deepEqual(parsePositiveGridScale('75'), { ok: true, value: 75 })
    assert.equal(parsePositiveGridScale('0').ok, false)
  })

  it('normalizes LOS sidecar asset refs to the uploaded asset id', () => {
    const result = normalizeLosSidecarInput(
      JSON.stringify({
        assetRef: 'local/dev.png',
        width: 100,
        height: 100,
        gridScale: 50,
        occluders: []
      }),
      'asset_123'
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal((result.value as { assetRef: string }).assetRef, 'asset_123')
  })
})
