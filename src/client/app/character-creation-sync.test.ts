import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterCharacteristics
} from '../../shared/state'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  characterCreationCharacteristicsComplete,
  characterCreationStepIndex,
  shouldSyncEditableCharacterCreationFlowWithProjection
} from './character-creation-sync'

const completeCharacteristics = (): CharacterCharacteristics => ({
  str: 7,
  dex: 8,
  end: 9,
  int: 6,
  edu: 7,
  soc: 5
})

const flow = (
  step: CharacterCreationFlow['step'],
  characteristics: Partial<CharacterCharacteristics> = completeCharacteristics()
): CharacterCreationFlow => ({
  step,
  draft: createInitialCharacterDraft(asCharacterId(`char-${step}`), {
    characteristics: {
      str: characteristics.str ?? null,
      dex: characteristics.dex ?? null,
      end: characteristics.end ?? null,
      int: characteristics.int ?? null,
      edu: characteristics.edu ?? null,
      soc: characteristics.soc ?? null
    }
  })
})

const creation = (
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
  history: [],
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  creationComplete: false,
  homeworld: null,
  backgroundSkills: [],
  pendingCascadeSkills: [],
  characteristicChanges: [],
  ...overrides
})

describe('character creation sync helpers', () => {
  it('orders wizard steps with unknown values last', () => {
    assert.equal(characterCreationStepIndex('basics'), 0)
    assert.equal(characterCreationStepIndex('review'), 6)
    assert.equal(characterCreationStepIndex('not-a-step'), 7)
  })

  it('recognizes complete characteristic rolls', () => {
    assert.equal(characterCreationCharacteristicsComplete(flow('career')), true)
    assert.equal(
      characterCreationCharacteristicsComplete(
        flow('characteristics', {
          str: 7
        })
      ),
      false
    )
  })

  it('does not sync read-only or missing flows', () => {
    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: flow('career'),
        creation: creation('HOMEWORLD'),
        readOnly: true
      }),
      false
    )
    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: null,
        creation: creation('HOMEWORLD'),
        readOnly: false
      }),
      false
    )
  })

  it('syncs when the server projection moves backward or ahead after characteristics complete', () => {
    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: flow('career'),
        creation: creation('HOMEWORLD'),
        readOnly: false
      }),
      true
    )
    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: flow('characteristics'),
        creation: creation('HOMEWORLD'),
        readOnly: false
      }),
      true
    )
  })

  it('keeps incomplete characteristic local state until all stats are rolled', () => {
    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: flow('characteristics', { str: 7 }),
        creation: creation('HOMEWORLD'),
        readOnly: false
      }),
      false
    )
  })

  it('syncs pending cascade and basic training projection changes', () => {
    const current = flow('career')
    current.draft.pendingTermCascadeSkills = ['Gun Combat']

    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: current,
        creation: creation('SKILLS_TRAINING', {
          pendingCascadeSkills: ['Aircraft']
        }),
        readOnly: false
      }),
      true
    )
    assert.equal(
      shouldSyncEditableCharacterCreationFlowWithProjection({
        flow: current,
        creation: creation('BASIC_TRAINING'),
        readOnly: false
      }),
      true
    )
  })
})
