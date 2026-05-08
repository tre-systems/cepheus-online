import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { creationActivityRevealDelayMs } from './creation-activity-feed'

describe('creation activity feed helpers', () => {
  it('waits until the latest dice reveal plus a small display buffer', () => {
    const nowMs = Date.parse('2026-05-08T10:00:00.000Z')

    const delay = creationActivityRevealDelayMs(
      [
        {
          id: 'roll-1',
          revealAt: '2026-05-08T10:00:01.000Z',
          rolls: [3, 4],
          total: 7
        },
        {
          id: 'roll-2',
          revealAt: '2026-05-08T10:00:02.000Z',
          rolls: [5, 6],
          total: 11
        }
      ],
      nowMs
    )

    assert.equal(delay, 2160)
  })

  it('does not delay when there is no valid reveal time', () => {
    const delay = creationActivityRevealDelayMs(
      [
        {
          id: 'roll-1',
          revealAt: 'not-a-date',
          rolls: [],
          total: 0
        }
      ],
      Date.parse('2026-05-08T10:00:00.000Z')
    )

    assert.equal(delay, 0)
  })
})
