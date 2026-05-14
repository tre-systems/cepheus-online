import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../shared/ids'
import type { ClientDiceRollActivity } from '../../../game-commands'
import { createInitialCharacterDraft, type CharacterCreationFlow } from './flow'
import { createCharacterCreationLifecycleController } from './lifecycle'

const characterId = asCharacterId('char-1')

const flow = {
  step: 'characteristics',
  draft: createInitialCharacterDraft(characterId, { name: 'Scout' })
} satisfies CharacterCreationFlow

const rollActivity: ClientDiceRollActivity = {
  id: 'roll-1',
  total: 8,
  rolls: [4, 4],
  revealAt: '2026-01-01T00:00:01.000Z'
}

const createHarness = ({
  openedFlow = flow,
  refreshFollowed = false,
  refreshEditable = false
}: {
  openedFlow?: CharacterCreationFlow | null
  refreshFollowed?: boolean
  refreshEditable?: boolean
} = {}) => {
  const events: string[] = []
  let releaseReveal: () => void = () => {
    throw new Error('Reveal wait was not started')
  }
  const controller = createCharacterCreationLifecycleController({
    controller: {
      openFollow: () => openedFlow,
      refreshFollowed: () => {
        events.push('refreshFollowed')
        return refreshFollowed
      },
      shouldRefreshEditable: ({ deferredRollCount = 0 } = {}) => {
        events.push(`shouldRefreshEditable:${deferredRollCount}`)
        return refreshEditable
      }
    },
    panel: {
      open: () => events.push('panel.open'),
      scrollToTop: () => events.push('panel.scrollToTop')
    },
    closeCharacterSheet: () => events.push('sheet.close'),
    renderWizard: () => events.push('renderWizard'),
    waitForDiceReveal: async () => {
      events.push('waitForDiceReveal')
      await new Promise<void>((resolve) => {
        releaseReveal = resolve
      })
    },
    reportError: (message) => events.push(`error:${message}`)
  })

  return {
    controller,
    events,
    releaseReveal: () => releaseReveal()
  }
}

describe('character creation lifecycle controller', () => {
  it('opens a followed creation and leaves the sheet alone in read-only mode', () => {
    const harness = createHarness()

    assert.equal(harness.controller.openFollow(characterId), true)

    assert.deepEqual(harness.events, [
      'panel.open',
      'renderWizard',
      'panel.scrollToTop'
    ])
  })

  it('closes the sheet before opening an editable followed creation', () => {
    const harness = createHarness()

    assert.equal(
      harness.controller.openFollow(characterId, { readOnly: false }),
      true
    )

    assert.deepEqual(harness.events, [
      'sheet.close',
      'panel.open',
      'renderWizard',
      'panel.scrollToTop'
    ])
  })

  it('does not open the panel when no projected flow exists', () => {
    const harness = createHarness({ openedFlow: null })

    assert.equal(harness.controller.openFollow(characterId), false)
    assert.deepEqual(harness.events, [])
  })

  it('plans followed and editable rendering after the app render', () => {
    const harness = createHarness({
      refreshFollowed: true,
      refreshEditable: true
    })

    const plan = harness.controller.planStateRefresh()

    assert.deepEqual(harness.events, [
      'refreshFollowed',
      'shouldRefreshEditable:0'
    ])

    plan.renderAfterAppRender()

    assert.deepEqual(harness.events, [
      'refreshFollowed',
      'shouldRefreshEditable:0',
      'renderWizard',
      'renderWizard'
    ])
  })

  it('defers followed rendering until dice reveal has completed', async () => {
    const harness = createHarness({
      refreshFollowed: true
    })

    const plan = harness.controller.planStateRefresh({
      deferFollowedCreationRolls: [rollActivity]
    })
    plan.renderAfterAppRender()

    assert.deepEqual(harness.events, [
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal'
    ])

    harness.releaseReveal()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(harness.events, [
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal',
      'refreshFollowed',
      'renderWizard'
    ])
  })

  it('does not render editable local actions while a creation roll is pending', () => {
    const events: string[] = []
    const controller = createCharacterCreationLifecycleController({
      controller: {
        openFollow: () => flow,
        refreshFollowed: () => false,
        shouldRefreshEditable: ({ deferredRollCount = 0 } = {}) => {
          events.push(`shouldRefreshEditable:${deferredRollCount}`)
          return deferredRollCount === 0
        }
      },
      panel: {
        open: () => {},
        scrollToTop: () => {}
      },
      closeCharacterSheet: () => {},
      renderWizard: () => events.push('renderWizard'),
      waitForDiceReveal: async () => {},
      reportError: (message) => events.push(`error:${message}`)
    })

    controller
      .planStateRefresh({ deferFollowedCreationRolls: [rollActivity] })
      .renderAfterAppRender()

    assert.deepEqual(events, ['shouldRefreshEditable:1'])
  })

  it('waits for every deferred reveal before rendering a followed creation', async () => {
    const events: string[] = []
    const revealWaiters = new Map<string, () => void>()
    const controller = createCharacterCreationLifecycleController({
      controller: {
        openFollow: () => flow,
        refreshFollowed: () => {
          events.push('refreshFollowed')
          return true
        },
        shouldRefreshEditable: ({ deferredRollCount = 0 } = {}) => {
          events.push(`shouldRefreshEditable:${deferredRollCount}`)
          return false
        }
      },
      panel: {
        open: () => {},
        scrollToTop: () => {}
      },
      closeCharacterSheet: () => {},
      renderWizard: () => events.push('renderWizard'),
      waitForDiceReveal: async (roll) => {
        events.push(`waitForDiceReveal:${roll.id}`)
        await new Promise<void>((resolve) => {
          revealWaiters.set(roll.id, resolve)
        })
      },
      reportError: (message) => events.push(`error:${message}`)
    })

    controller
      .planStateRefresh({
        deferFollowedCreationRolls: [
          rollActivity,
          { ...rollActivity, id: 'roll-2' }
        ]
      })
      .renderAfterAppRender()

    assert.deepEqual(events, [
      'refreshFollowed',
      'shouldRefreshEditable:2',
      'waitForDiceReveal:roll-1',
      'waitForDiceReveal:roll-2'
    ])

    revealWaiters.get('roll-1')?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, [
      'refreshFollowed',
      'shouldRefreshEditable:2',
      'waitForDiceReveal:roll-1',
      'waitForDiceReveal:roll-2'
    ])

    revealWaiters.get('roll-2')?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, [
      'refreshFollowed',
      'shouldRefreshEditable:2',
      'waitForDiceReveal:roll-1',
      'waitForDiceReveal:roll-2',
      'refreshFollowed',
      'renderWizard'
    ])
  })

  it('waits for the newest deferred followed refresh before rendering', async () => {
    const events: string[] = []
    const revealWaiters = new Map<string, () => void>()
    const controller = createCharacterCreationLifecycleController({
      controller: {
        openFollow: () => flow,
        refreshFollowed: () => {
          events.push('refreshFollowed')
          return true
        },
        shouldRefreshEditable: ({ deferredRollCount = 0 } = {}) => {
          events.push(`shouldRefreshEditable:${deferredRollCount}`)
          return false
        }
      },
      panel: {
        open: () => {},
        scrollToTop: () => {}
      },
      closeCharacterSheet: () => {},
      renderWizard: () => events.push('renderWizard'),
      waitForDiceReveal: async (roll) => {
        events.push(`waitForDiceReveal:${roll.id}`)
        await new Promise<void>((resolve) => {
          revealWaiters.set(roll.id, resolve)
        })
      },
      reportError: (message) => events.push(`error:${message}`)
    })

    controller
      .planStateRefresh({ deferFollowedCreationRolls: [rollActivity] })
      .renderAfterAppRender()
    controller
      .planStateRefresh({
        deferFollowedCreationRolls: [{ ...rollActivity, id: 'roll-2' }]
      })
      .renderAfterAppRender()

    assert.deepEqual(events, [
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal:roll-1',
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal:roll-2'
    ])

    revealWaiters.get('roll-1')?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, [
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal:roll-1',
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal:roll-2'
    ])

    revealWaiters.get('roll-2')?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, [
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal:roll-1',
      'refreshFollowed',
      'shouldRefreshEditable:1',
      'waitForDiceReveal:roll-2',
      'refreshFollowed',
      'renderWizard'
    ])
  })

  it('does not render a stale followed projection after a newer state supersedes it', async () => {
    const events: string[] = []
    let pendingRefreshes = 0
    let releaseOldReveal: () => void = () => {
      throw new Error('Reveal wait was not started')
    }
    const controller = createCharacterCreationLifecycleController({
      controller: {
        openFollow: () => flow,
        refreshFollowed: () => {
          pendingRefreshes += 1
          events.push(`refreshFollowed:${pendingRefreshes}`)
          return pendingRefreshes <= 2
        },
        shouldRefreshEditable: ({ deferredRollCount = 0 } = {}) => {
          events.push(`shouldRefreshEditable:${deferredRollCount}`)
          return false
        }
      },
      panel: {
        open: () => {},
        scrollToTop: () => {}
      },
      closeCharacterSheet: () => {},
      renderWizard: () => events.push('renderWizard'),
      waitForDiceReveal: async () => {
        events.push('waitForDiceReveal')
        await new Promise<void>((resolve) => {
          releaseOldReveal = resolve
        })
      },
      reportError: (message) => events.push(`error:${message}`)
    })

    controller
      .planStateRefresh({ deferFollowedCreationRolls: [rollActivity] })
      .renderAfterAppRender()
    controller.planStateRefresh().renderAfterAppRender()

    assert.deepEqual(events, [
      'refreshFollowed:1',
      'shouldRefreshEditable:1',
      'waitForDiceReveal',
      'refreshFollowed:2',
      'shouldRefreshEditable:0',
      'renderWizard'
    ])

    releaseOldReveal()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, [
      'refreshFollowed:1',
      'shouldRefreshEditable:1',
      'waitForDiceReveal',
      'refreshFollowed:2',
      'shouldRefreshEditable:0',
      'renderWizard'
    ])
  })

  it('skips deferred followed rendering when the projection is gone after reveal', async () => {
    let refreshCount = 0
    const events: string[] = []
    let releaseReveal: () => void = () => {
      throw new Error('Reveal wait was not started')
    }
    const controller = createCharacterCreationLifecycleController({
      controller: {
        openFollow: () => flow,
        refreshFollowed: () => {
          refreshCount += 1
          events.push(`refreshFollowed:${refreshCount}`)
          return refreshCount === 1
        },
        shouldRefreshEditable: () => false
      },
      panel: {
        open: () => {},
        scrollToTop: () => {}
      },
      closeCharacterSheet: () => {},
      renderWizard: () => events.push('renderWizard'),
      waitForDiceReveal: async () => {
        events.push('waitForDiceReveal')
        await new Promise<void>((resolve) => {
          releaseReveal = resolve
        })
      },
      reportError: (message) => events.push(`error:${message}`)
    })

    controller
      .planStateRefresh({ deferFollowedCreationRolls: [rollActivity] })
      .renderAfterAppRender()
    releaseReveal()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, [
      'refreshFollowed:1',
      'waitForDiceReveal',
      'refreshFollowed:2'
    ])
  })

  it('reports deferred reveal wait failures', async () => {
    const events: string[] = []
    const controller = createCharacterCreationLifecycleController({
      controller: {
        openFollow: () => flow,
        refreshFollowed: () => true,
        shouldRefreshEditable: () => false
      },
      panel: {
        open: () => {},
        scrollToTop: () => {}
      },
      closeCharacterSheet: () => {},
      renderWizard: () => events.push('renderWizard'),
      waitForDiceReveal: async () => {
        throw new Error('Reveal failed')
      },
      reportError: (message) => events.push(`error:${message}`)
    })

    controller
      .planStateRefresh({ deferFollowedCreationRolls: [rollActivity] })
      .renderAfterAppRender()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(events, ['error:Reveal failed'])
  })
})
