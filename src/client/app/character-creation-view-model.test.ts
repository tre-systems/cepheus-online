import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import type { CharacterCreationProjection } from '../../shared/state'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  deriveCharacterCreationViewModel,
  type CharacterCreationViewModel
} from './character-creation-view-model'

const characterId = asCharacterId('view-model-traveller')

const flow = (
  overrides: Partial<CharacterCreationFlow> = {}
): CharacterCreationFlow => ({
  step: 'homeworld',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Iona Vesh',
    characteristics: {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    },
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Admin-0'],
    pendingCascadeSkills: ['Gun Combat-0']
  }),
  ...overrides
})

const projection = (
  status: CharacterCreationProjection['state']['status'],
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: {
    status,
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
  history: [],
  ...overrides
})

describe('character creation view model', () => {
  it('derives an empty model without requiring DOM or flow state', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: null,
      readOnly: false
    })

    assert.equal(viewModel.mode, 'empty')
    assert.equal(viewModel.title, 'Create traveller')
    assert.equal(viewModel.characterId, null)
    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard, null)
    assert.equal(viewModel.projection.present, false)
    assert.equal(viewModel.pending.hasPendingResolution, false)
    assert.equal(
      viewModel.pending.summary,
      'No pending character creation choices'
    )
  })

  it('composes flow and projection details for editable rendering', () => {
    const currentFlow = flow()
    const currentProjection = projection('HOMEWORLD', {
      pendingCascadeSkills: ['Gun Combat-0'],
      history: [{ type: 'COMPLETE_HOMEWORLD' }]
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: currentProjection,
      readOnly: false
    })

    assert.equal(viewModel.mode, 'editable')
    assert.equal(viewModel.title, 'Iona Vesh')
    assert.equal(viewModel.characterId, characterId)
    assert.equal(viewModel.readOnly, false)
    assert.equal(viewModel.controlsDisabled, false)
    assert.equal(viewModel.projection.present, true)
    assert.equal(viewModel.projection.status, 'HOMEWORLD')
    assert.equal(viewModel.projection.step, 'homeworld')
    assert.equal(viewModel.projection.historyCount, 1)
    assert.equal(viewModel.wizard?.step, 'homeworld')
    assert.equal(viewModel.wizard?.projectedStepCurrent, true)
    assert.equal(viewModel.wizard?.controlsDisabled, false)
    assert.equal(viewModel.wizard?.nextStep.phase, 'Homeworld')
    assert.equal(viewModel.wizard?.characteristics, null)
    assert.equal(viewModel.wizard?.homeworld?.summary.lawLevel, 'No Law')
    assert.deepEqual(viewModel.wizard?.homeworld?.summary.tradeCodes, [
      'Asteroid'
    ])
    assert.equal(viewModel.wizard?.progress.length, 7)
    assert.deepEqual(viewModel.pending.backgroundCascadeSkills, [
      'Gun Combat-0'
    ])
    assert.deepEqual(viewModel.pending.projectionCascadeSkills, [
      'Gun Combat-0'
    ])
    assert.equal(viewModel.pending.hasCascadeChoices, true)
    assert.equal(
      viewModel.pending.summary,
      '1 background cascade choice pending'
    )
  })

  it('includes characteristic grid state for the characteristics step', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'characteristics',
        draft: createInitialCharacterDraft(characterId, {
          characteristics: {
            str: 7,
            dex: null,
            end: 8,
            int: null,
            edu: null,
            soc: null
          }
        })
      }),
      projection: projection('CHARACTERISTICS'),
      readOnly: false
    })

    assert.deepEqual(
      viewModel.wizard?.characteristics?.stats.map(
        ({ key, value, missing, rollLabel }) => ({
          key,
          value,
          missing,
          rollLabel
        })
      ),
      [
        { key: 'str', value: '7', missing: false, rollLabel: 'Roll Str' },
        { key: 'dex', value: '', missing: true, rollLabel: 'Roll Dex' },
        { key: 'end', value: '8', missing: false, rollLabel: 'Roll End' },
        { key: 'int', value: '', missing: true, rollLabel: 'Roll Int' },
        { key: 'edu', value: '', missing: true, rollLabel: 'Roll Edu' },
        { key: 'soc', value: '', missing: true, rollLabel: 'Roll Soc' }
      ]
    )
    assert.equal(viewModel.wizard?.homeworld, null)
  })

  it('captures read-only and pending aging state without changing flow identity', () => {
    const currentFlow = flow({
      step: 'career',
      draft: {
        ...flow().draft,
        pendingCascadeSkills: [],
        pendingTermCascadeSkills: ['Aircraft-1'],
        pendingAgingChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      }
    })
    const actionPlan: NonNullable<CharacterCreationViewModel['actionPlan']> = {
      title: 'Creation',
      status: 'Aging',
      summary: 'Advance the server-backed character creation state.',
      actions: []
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('AGING', {
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      }),
      readOnly: true,
      actionPlan
    })

    assert.equal(viewModel.flow, currentFlow)
    assert.equal(viewModel.mode, 'read-only')
    assert.equal(viewModel.controlsDisabled, true)
    assert.equal(viewModel.wizard?.controlsDisabled, true)
    assert.equal(viewModel.wizard?.projectedStep, 'career')
    assert.equal(viewModel.pending.hasPendingResolution, true)
    assert.deepEqual(viewModel.pending.termCascadeSkills, ['Aircraft-1'])
    assert.equal(viewModel.pending.agingChangeCount, 1)
    assert.equal(viewModel.actionPlan, actionPlan)
  })
})
