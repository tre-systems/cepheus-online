import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveFaceValueContent } from './dice-overlay'

describe('client dice overlay helpers', () => {
  it('derives pip content for d6 face values', () => {
    assert.deepEqual(deriveFaceValueContent(4), {
      kind: 'pips',
      slots: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    })
  })

  it('derives numeric content for non-d6 face values', () => {
    assert.deepEqual(deriveFaceValueContent(8), {
      kind: 'numeric',
      label: '8'
    })
  })
})
