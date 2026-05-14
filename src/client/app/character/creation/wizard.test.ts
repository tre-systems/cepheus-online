import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../shared/ids'
import type { CharacterCreationProjection } from '../../../../shared/state'
import { createInitialCharacterDraft } from './flow'
import { createCharacterCreationController } from './controller'
import { createCharacterCreationWizardController } from './wizard'

const completeCharacteristics = {
  str: 7,
  dex: 8,
  end: 6,
  int: 9,
  edu: 7,
  soc: 5
}

const homeworldProjection = (): CharacterCreationProjection => ({
  state: {
    status: 'HOMEWORLD',
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  homeworld: undefined,
  backgroundSkills: [],
  pendingCascadeSkills: [],
  history: []
})

const fieldsRoot = (
  fields: Array<{ key: string; value: string }> = []
): HTMLElement =>
  ({
    querySelectorAll: () =>
      fields.map(({ key, value }) => ({
        value,
        dataset: { characterCreationField: key }
      }))
  }) as unknown as HTMLElement

const createHarness = ({
  fields = [],
  projection = homeworldProjection()
}: {
  fields?: Array<{ key: string; value: string }>
  projection?: CharacterCreationProjection | null
} = {}) => {
  let panelOpen = false
  let sheetClosed = false
  let selectedPiece: string | null = 'piece-1'
  let published = 0
  let rendered = 0
  let scrolled = 0
  let error = ''
  let homeworldProgress = 0
  let finished = 0

  const controller = createCharacterCreationController({
    getState: () => null,
    isPanelOpen: () => panelOpen,
    closePanel: () => {
      panelOpen = false
    }
  })

  const wizard = createCharacterCreationWizardController({
    controller,
    fieldsRoot: fieldsRoot(fields),
    panel: {
      isOpen: () => panelOpen,
      show: () => {
        panelOpen = true
      },
      open: () => {
        panelOpen = true
      },
      scrollToTop: () => {
        scrolled += 1
      }
    },
    getState: () => null,
    getSeed: () => ({
      name: 'Scout',
      credits: 0,
      equipment: [],
      notes: ''
    }),
    currentProjection: () => projection,
    homeworldPublisher: {
      publishProgress: async () => {
        homeworldProgress += 1
      }
    },
    selectPiece: (pieceId) => {
      selectedPiece = pieceId
    },
    closeCharacterSheet: () => {
      sheetClosed = true
    },
    ensurePublished: async () => {
      published += 1
    },
    finish: async () => {
      finished += 1
    },
    renderWizard: () => {
      rendered += 1
    },
    setError: (message) => {
      error = message
    }
  })

  return {
    controller,
    wizard,
    stats: () => ({
      panelOpen,
      sheetClosed,
      selectedPiece,
      published,
      rendered,
      scrolled,
      error,
      homeworldProgress,
      finished
    })
  }
}

describe('character creation wizard controller', () => {
  it('starts a new editable flow and publishes it', async () => {
    const { controller, wizard, stats } = createHarness()

    await wizard.startNew()

    assert.equal(controller.readOnly(), false)
    assert.equal(controller.flow()?.step, 'characteristics')
    assert.equal(controller.flow()?.draft.name, 'Scout')
    assert.deepEqual(stats(), {
      panelOpen: true,
      sheetClosed: true,
      selectedPiece: null,
      published: 1,
      rendered: 1,
      scrolled: 1,
      error: '',
      homeworldProgress: 0,
      finished: 0
    })
  })

  it('syncs fields and advances valid local setup steps', async () => {
    const characterId = asCharacterId('char-1')
    const { controller, wizard, stats } = createHarness({
      fields: [{ key: 'name', value: 'Ada' }]
    })
    controller.setFlow({
      step: 'characteristics',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Scout',
        characteristics: completeCharacteristics
      })
    })

    wizard.syncFields()
    assert.equal(controller.flow()?.draft.name, 'Ada')

    await wizard.advance()
    assert.equal(controller.flow()?.step, 'homeworld')
    assert.equal(stats().rendered, 1)
    assert.equal(stats().scrolled, 1)

    wizard.back()
    assert.equal(controller.flow()?.step, 'characteristics')
    assert.equal(stats().rendered, 2)
    assert.equal(stats().error, '')
  })

  it('publishes valid homeworld progress without auto-advancing past server projection', () => {
    const characterId = asCharacterId('char-1')
    const { controller, wizard, stats } = createHarness()
    controller.setFlow({
      step: 'homeworld',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Scout',
        characteristics: completeCharacteristics,
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid', 'Industrial']
        },
        backgroundSkills: ['Zero-G-0', 'Broker-0', 'Slug Rifle-0'],
        pendingCascadeSkills: []
      })
    })

    assert.equal(wizard.autoAdvanceSetup(), false)
    assert.equal(controller.flow()?.step, 'homeworld')
    assert.equal(stats().homeworldProgress, 1)
  })

  it('delegates review completion to the finish callback', async () => {
    const characterId = asCharacterId('char-1')
    const { controller, wizard, stats } = createHarness()
    controller.setFlow({
      step: 'review',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Scout',
        characteristics: completeCharacteristics,
        homeworld: {
          lawLevel: 'Low Law',
          tradeCodes: ['Agricultural']
        },
        backgroundSkills: ['Admin', 'Animals']
      })
    })

    await wizard.advance()

    assert.equal(stats().finished, 1)
  })
})
