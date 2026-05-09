import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { LiveDiceRollRevealTarget } from '../../shared/live-activity'
import type { ClientDiceRollActivity } from '../game-commands'
import type {
  AnimatePendingRollOptions,
  AnimateRollOptions
} from './dice-overlay'
import { createDiceOverlayWiring } from './dice-overlay-wiring'

class FakeClassList {
  readonly toggles: { name: string; force: boolean | undefined }[] = []

  toggle(name: string, force?: boolean): boolean {
    this.toggles.push({ name, force })
    return force ?? false
  }
}

class FakeElement {
  readonly classList = new FakeClassList()
  parentElement: FakeElement | null = null
  readonly children: FakeElement[] = []

  append(child: FakeElement): void {
    child.parentElement = this
    this.children.push(child)
  }
}

const roll = (id: string): LiveDiceRollRevealTarget => ({
  id,
  revealAt: '2026-05-09T12:00:00.000Z',
  rolls: [3, 4],
  total: 7
})

describe('dice overlay wiring', () => {
  it('maps panel host, context, elements, and reveal callback into animation options', () => {
    const overlay = new FakeElement()
    const stage = new FakeElement()
    const host = new FakeElement()
    const revealed: string[] = []
    const animationOptions: AnimateRollOptions[] = []

    const wiring = createDiceOverlayWiring({
      elements: {
        overlay: overlay as unknown as HTMLElement,
        stage: stage as unknown as HTMLElement
      },
      panel: {
        overlayHost: () => host as unknown as HTMLElement,
        overlayContext: () => ({ inCreator: true, inDialog: false })
      },
      resolveDiceReveal: (rollId) => {
        revealed.push(rollId)
      },
      animateRoll: (options) => {
        animationOptions.push(options)
        return 42
      }
    })

    wiring.animateRoll(roll('roll-1'))

    assert.equal(overlay.parentElement, host)
    assert.deepEqual(overlay.classList.toggles, [
      { name: 'in-creator', force: true },
      { name: 'in-dialog', force: false }
    ])

    const options = animationOptions[0]
    if (!options) throw new Error('Expected animation options')
    assert.equal(options.roll.id, 'roll-1')
    assert.equal(options.overlay, overlay)
    assert.equal(options.stage, stage)
    assert.equal(options.hideTimer, null)

    options.onReveal?.()
    assert.deepEqual(revealed, ['roll-1'])
  })

  it('preserves the animation hide timer between rolls and avoids reparenting current host', () => {
    const overlay = new FakeElement()
    const stage = new FakeElement()
    const host = new FakeElement()
    host.append(overlay)
    const hideTimers: (number | null)[] = []

    const wiring = createDiceOverlayWiring({
      elements: {
        overlay: overlay as unknown as HTMLElement,
        stage: stage as unknown as HTMLElement
      },
      panel: {
        overlayHost: () => host as unknown as HTMLElement,
        overlayContext: () => ({ inCreator: false, inDialog: true })
      },
      resolveDiceReveal: () => {},
      animateRoll: (options) => {
        hideTimers.push(options.hideTimer)
        return 100 + hideTimers.length
      }
    })

    wiring.animateRoll(roll('roll-1'))
    wiring.animateRoll(roll('roll-2'))

    assert.equal(host.children.length, 1)
    assert.deepEqual(hideTimers, [null, 101])
    assert.deepEqual(overlay.classList.toggles.slice(-2), [
      { name: 'in-creator', force: false },
      { name: 'in-dialog', force: true }
    ])
  })

  it('uses pending animation for redacted dice reveal targets', () => {
    const overlay = new FakeElement()
    const stage = new FakeElement()
    const host = new FakeElement()
    const revealed: string[] = []
    const animationOptions: AnimateRollOptions[] = []
    const pendingAnimationOptions: AnimatePendingRollOptions[] = []
    const pendingRoll: ClientDiceRollActivity = {
      id: 'roll-pending',
      revealAt: '2026-05-09T12:00:00.000Z'
    }

    const wiring = createDiceOverlayWiring({
      elements: {
        overlay: overlay as unknown as HTMLElement,
        stage: stage as unknown as HTMLElement
      },
      panel: {
        overlayHost: () => host as unknown as HTMLElement,
        overlayContext: () => ({ inCreator: false, inDialog: false })
      },
      resolveDiceReveal: (rollId) => {
        revealed.push(rollId)
      },
      animateRoll: (options) => {
        animationOptions.push(options)
        return 42
      },
      animatePendingRoll: (options) => {
        pendingAnimationOptions.push(options)
        return 43
      }
    })

    wiring.animateRoll(pendingRoll)

    assert.equal(animationOptions.length, 0)
    const options = pendingAnimationOptions[0]
    if (!options) throw new Error('Expected pending animation options')
    assert.equal(options.roll.id, 'roll-pending')
    assert.equal(options.roll.revealAt, '2026-05-09T12:00:00.000Z')
    assert.equal(options.overlay, overlay)
    assert.equal(options.stage, stage)
    assert.equal(options.hideTimer, null)

    options.onReveal?.()
    assert.deepEqual(revealed, ['roll-pending'])
  })
})
