import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asCharacterId,
  asGameId,
  asUserId,
  type CharacterId
} from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import { effect } from '../../../reactive'
import { createCharacterCreationController } from './controller'
import { type CharacterCreationFlow, createInitialCharacterDraft } from './flow'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')
const characterId = asCharacterId('char-1')

const creation = (
  status: CharacterCreationProjection['state']['status'] = 'HOMEWORLD'
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
  homeworld: undefined,
  backgroundSkills: [],
  pendingCascadeSkills: [],
  history: []
})

const stateWithCreation = (
  projected: CharacterCreationProjection | null
): GameState => ({
  id: gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: actorId,
  players: {},
  characters: {
    [characterId]: {
      id: characterId,
      ownerId: actorId,
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: null,
      characteristics: {
        str: 7,
        dex: 7,
        end: 7,
        int: 7,
        edu: 7,
        soc: 7
      },
      skills: [],
      equipment: [],
      credits: 0,
      creation: projected
    }
  },
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 1
})

const localFlow = {
  step: 'characteristics',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Scout',
    characteristics: {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: null,
      soc: null
    }
  })
} satisfies CharacterCreationFlow

describe('character creation controller', () => {
  it('stores local flow, read-only mode, and selected character through signals', () => {
    const controller = createCharacterCreationController({
      getState: () => null,
      isPanelOpen: () => false,
      closePanel: () => {}
    })
    const observed: Array<CharacterCreationFlow | null> = []
    const dispose = effect(() => {
      observed.push(controller.flowSignal.value)
    })

    assert.equal(controller.flow(), null)
    assert.equal(controller.readOnly(), false)
    assert.equal(controller.selectedCharacterId(), null)

    controller.setFlow(localFlow)
    controller.setReadOnly(true)
    controller.setSelectedCharacterId(characterId)

    assert.equal(controller.flow(), localFlow)
    assert.equal(controller.readOnly(), true)
    assert.equal(controller.selectedCharacterId(), characterId)
    assert.deepEqual(observed, [null, localFlow])

    dispose()
    controller.setFlow(null)
    assert.deepEqual(observed, [null, localFlow])
  })

  it('opens and refreshes a followed projected creation flow', () => {
    let currentState: GameState | null = stateWithCreation(
      creation('BASIC_TRAINING')
    )
    let panelClosed = false
    const controller = createCharacterCreationController({
      getState: () => currentState,
      isPanelOpen: () => true,
      closePanel: () => {
        panelClosed = true
      }
    })

    assert.equal(controller.openFollow(characterId)?.step, 'skills')
    assert.equal(controller.readOnly(), true)
    assert.equal(controller.selectedCharacterId(), characterId)

    currentState = stateWithCreation(creation('SKILLS_TRAINING'))
    assert.equal(controller.refreshFollowed(), true)
    assert.equal(controller.flow()?.step, 'career')

    currentState = stateWithCreation(null)
    assert.equal(controller.refreshFollowed(), false)
    assert.equal(controller.flow(), null)
    assert.equal(controller.readOnly(), false)
    assert.equal(controller.selectedCharacterId(), null)
    assert.equal(panelClosed, true)
  })

  it('opens read-only characteristics from the shared read model without legacy flow', () => {
    const projected = creation('CHARACTERISTICS')
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(projected),
      isPanelOpen: () => true,
      closePanel: () => {}
    })

    assert.equal(controller.openFollow(characterId)?.step, 'characteristics')
    assert.equal(controller.flow()?.step, 'characteristics')
    assert.equal(controller.readOnly(), true)
    assert.equal(controller.selectedCharacterId(), characterId)
    assert.equal(controller.currentProjection(), projected)
    assert.equal(controller.viewModel().mode, 'read-only')
    assert.equal(controller.viewModel().characterId, characterId)
    assert.equal(controller.viewModel().wizard?.step, 'characteristics')
    assert.equal(
      controller.viewModel().wizard?.characteristics?.stats[0]?.value,
      '7'
    )
  })

  it('opens read-only homeworld from the shared read model without legacy flow', () => {
    const projected = creation('HOMEWORLD')
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(projected),
      isPanelOpen: () => true,
      closePanel: () => {}
    })

    assert.equal(controller.openFollow(characterId)?.step, 'homeworld')
    assert.equal(controller.flow()?.step, 'homeworld')
    assert.equal(controller.readOnly(), true)
    assert.equal(controller.selectedCharacterId(), characterId)
    assert.equal(controller.currentProjection(), projected)
    assert.equal(controller.viewModel().mode, 'read-only')
    assert.equal(controller.viewModel().characterId, characterId)
    assert.equal(controller.viewModel().wizard?.step, 'homeworld')

    assert.equal(controller.refreshFollowed(), true)
    assert.equal(controller.flow()?.step, 'homeworld')
    assert.equal(controller.selectedCharacterId(), characterId)
    assert.equal(controller.viewModel().wizard?.step, 'homeworld')
  })

  it('updates multi-signal follow state atomically', () => {
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(creation('BASIC_TRAINING')),
      isPanelOpen: () => true,
      closePanel: () => {}
    })
    const observed: Array<{
      flowStep: string | null
      readOnly: boolean
      selected: CharacterId | null
    }> = []
    const dispose = effect(() => {
      observed.push({
        flowStep: controller.flowSignal.value?.step ?? null,
        readOnly: controller.readOnlySignal.value,
        selected: controller.selectedCharacterIdSignal.value
      })
    })

    controller.openFollow(characterId)

    assert.deepEqual(observed, [
      { flowStep: null, readOnly: false, selected: null },
      { flowStep: 'skills', readOnly: true, selected: characterId }
    ])

    dispose()
  })

  it('derives a projection-fed view model from controller state', () => {
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(creation('BASIC_TRAINING')),
      isPanelOpen: () => true,
      closePanel: () => {}
    })

    assert.equal(controller.viewModel().mode, 'empty')
    assert.equal(controller.viewModel().projection.present, false)

    controller.setFlow(localFlow)

    assert.equal(controller.viewModel().mode, 'editable')
    assert.equal(controller.viewModel().characterId, characterId)
    assert.equal(controller.viewModel().wizard?.step, 'characteristics')
    assert.equal(controller.viewModel().projection.status, 'BASIC_TRAINING')
    assert.equal(controller.viewModel().wizard?.projectedStep, 'skills')

    controller.setReadOnly(true)

    assert.equal(controller.viewModel().mode, 'read-only')
    assert.equal(controller.viewModel().controlsDisabled, true)
    assert.equal(controller.viewModel().wizard?.controlsDisabled, true)
  })

  it('publishes a coherent view model for batched follow updates', () => {
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(creation('BASIC_TRAINING')),
      isPanelOpen: () => true,
      closePanel: () => {}
    })
    const observed: Array<{
      mode: string
      step: string | null
      readOnly: boolean
      status: string | null
    }> = []
    const dispose = effect(() => {
      const viewModel = controller.viewModelSignal.value
      observed.push({
        mode: viewModel.mode,
        step: viewModel.flow?.step ?? null,
        readOnly: viewModel.readOnly,
        status: viewModel.projection.status
      })
    })

    controller.openFollow(characterId)

    assert.deepEqual(observed, [
      {
        mode: 'empty',
        step: null,
        readOnly: false,
        status: null
      },
      {
        mode: 'read-only',
        step: 'skills',
        readOnly: true,
        status: 'BASIC_TRAINING'
      }
    ])

    dispose()
  })

  it('does not clear editable flow when room state changes', () => {
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(creation('BASIC_TRAINING')),
      isPanelOpen: () => true,
      closePanel: () => {}
    })
    controller.setFlow(localFlow)

    assert.equal(controller.refreshFollowed(), false)
    assert.equal(controller.flow(), localFlow)
    assert.equal(controller.readOnly(), false)
  })

  it('syncs editable flow from projection when projection advances', () => {
    const completeCharacteristicsFlow = {
      ...localFlow,
      draft: {
        ...localFlow.draft,
        characteristics: {
          str: 7,
          dex: 7,
          end: 7,
          int: 7,
          edu: 7,
          soc: 7
        }
      }
    } satisfies CharacterCreationFlow
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(creation('BASIC_TRAINING')),
      isPanelOpen: () => true,
      closePanel: () => {}
    })
    controller.setFlow(completeCharacteristicsFlow)

    const reconciled = controller.reconcileEditableWithProjection(
      creation('BASIC_TRAINING')
    )

    assert.equal(reconciled?.step, 'skills')
    assert.equal(controller.shouldRefreshEditable(), true)
    assert.equal(
      controller.shouldRefreshEditable({ deferredRollCount: 1 }),
      false
    )
  })

  it('derives the current projection from the active flow character', () => {
    const projected = creation('BASIC_TRAINING')
    const controller = createCharacterCreationController({
      getState: () => stateWithCreation(projected),
      isPanelOpen: () => true,
      closePanel: () => {}
    })

    assert.equal(controller.currentProjection(), null)

    controller.setFlow(localFlow)

    assert.equal(controller.currentProjection(), projected)
  })

  it('clears read-only follow state without discarding editable flows', () => {
    const controller = createCharacterCreationController({
      getState: () => null,
      isPanelOpen: () => false,
      closePanel: () => {}
    })

    controller.setFlow(localFlow)
    controller.clearReadOnlyFollow()
    assert.equal(controller.flow(), localFlow)

    controller.setReadOnly(true)
    controller.setSelectedCharacterId(characterId)
    controller.clearReadOnlyFollow()
    assert.equal(controller.flow(), null)
    assert.equal(controller.readOnly(), false)
    assert.equal(controller.selectedCharacterId(), null)
  })
})
