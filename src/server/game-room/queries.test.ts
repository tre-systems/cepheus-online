import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseViewerFromUrl } from './queries'

describe('room query viewer parsing', () => {
  it('does not honor query-string referee role on public hosts', () => {
    const viewer = parseViewerFromUrl(
      new URL('https://cepheus-online.example/rooms/demo/state?viewer=referee')
    )

    assert.equal(viewer.role, 'PLAYER')
  })

  it('keeps query-string referee role available for local development', () => {
    const viewer = parseViewerFromUrl(
      new URL('http://localhost:8788/rooms/demo/state?viewer=referee')
    )

    assert.equal(viewer.role, 'REFEREE')
  })
})
