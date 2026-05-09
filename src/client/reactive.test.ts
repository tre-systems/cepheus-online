import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  batch,
  createDisposalScope,
  effect,
  registerDisposer,
  signal
} from './reactive'

describe('reactive primitives', () => {
  it('runs effects when a signal changes and stops after disposal', () => {
    const count = signal(0)
    const observed: number[] = []
    const dispose = effect(() => {
      observed.push(count.value)
    })

    count.value = 1
    dispose()
    count.value = 2

    assert.deepEqual(observed, [0, 1])
  })

  it('batches multiple signal writes into one effect run', () => {
    const left = signal(0)
    const right = signal(0)
    const observed: Array<[number, number]> = []
    const dispose = effect(() => {
      observed.push([left.value, right.value])
    })

    batch(() => {
      left.value = 1
      right.value = 2
    })

    assert.deepEqual(observed, [
      [0, 0],
      [1, 2]
    ])

    dispose()
  })

  it('disposes computed values through a disposal scope', () => {
    const scope = createDisposalScope()
    const input = signal(2)
    const doubled = scope.computed(() => input.value * 2)

    assert.equal(doubled.value, 4)

    input.value = 3
    assert.equal(doubled.value, 6)

    scope.dispose()
    input.value = 4

    assert.equal(doubled.value, 6)
  })

  it('runs registered effect cleanups before rerun and disposal', () => {
    const current = signal('alpha')
    const calls: string[] = []
    const dispose = effect(() => {
      const value = current.value
      calls.push(`run:${value}`)
      registerDisposer(() => {
        calls.push(`cleanup:${value}`)
      })
    })

    current.value = 'beta'
    dispose()
    current.value = 'gamma'

    assert.deepEqual(calls, [
      'run:alpha',
      'cleanup:alpha',
      'run:beta',
      'cleanup:beta'
    ])
  })
})
