import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createWorkerRateLimiter, requestClientKey } from './worker-rate-limit'

describe('worker rate limiter', () => {
  it('rejects requests after the configured window budget', () => {
    const limiter = createWorkerRateLimiter({
      windowMs: 1_000,
      maxRequests: 2
    })

    assert.equal(limiter.check('ip:1', 100).allowed, true)
    assert.equal(limiter.check('ip:1', 200).allowed, true)

    const rejected = limiter.check('ip:1', 300)
    assert.equal(rejected.allowed, false)
    assert.equal(rejected.retryAfterSeconds, 1)
  })

  it('opens a new window after the reset time', () => {
    const limiter = createWorkerRateLimiter({
      windowMs: 1_000,
      maxRequests: 1
    })

    assert.equal(limiter.check('session:1', 100).allowed, true)
    assert.equal(limiter.check('session:1', 200).allowed, false)
    assert.equal(limiter.check('session:1', 1_101).allowed, true)
  })

  it('derives a stable request client key from proxy headers', () => {
    assert.equal(
      requestClientKey(
        new Request('https://cepheus.example', {
          headers: { 'cf-connecting-ip': '203.0.113.10' }
        })
      ),
      '203.0.113.10'
    )
    assert.equal(
      requestClientKey(
        new Request('https://cepheus.example', {
          headers: { 'x-forwarded-for': '203.0.113.20, 10.0.0.1' }
        })
      ),
      '203.0.113.20'
    )
  })
})
