import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseLocalAssetMetadataCandidates } from './local-metadata'

describe('local asset metadata parsing', () => {
  it('accepts a single metadata object', () => {
    assert.deepEqual(
      parseLocalAssetMetadataCandidates('{"root":"Geomorphs"}'),
      [{ root: 'Geomorphs' }]
    )
  })

  it('accepts an array of metadata objects', () => {
    assert.deepEqual(
      parseLocalAssetMetadataCandidates(
        '[{"root":"Geomorphs"},{"root":"Counters"}]'
      ),
      [{ root: 'Geomorphs' }, { root: 'Counters' }]
    )
  })

  it('accepts an assets wrapper object', () => {
    assert.deepEqual(
      parseLocalAssetMetadataCandidates('{"assets":[{"root":"Counters"}]}'),
      [{ root: 'Counters' }]
    )
  })

  it('treats empty input as an empty candidate list', () => {
    assert.deepEqual(parseLocalAssetMetadataCandidates('  '), [])
  })

  it('rejects unsupported JSON roots', () => {
    let message = ''
    try {
      parseLocalAssetMetadataCandidates('"Geomorphs"')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    assert.equal(/Local asset metadata must be/.test(message), true)
  })
})
