import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import type { ClientDiceRollActivity } from '../game-commands'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import { createCharacterCreationLifecycleController } from './character-creation-lifecycle-controller'

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
