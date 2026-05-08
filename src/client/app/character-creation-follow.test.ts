import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterCreationProjection, GameState } from '../../shared/state'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  projectedCharacterCreation,
  refreshFollowedCharacterCreationFlowFromState,
  shouldRefreshEditableCharacterCreationFlow,
  syncCharacterCreationFlowFromRoomState
} from './character-creation-follow'

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

const fallbackFlow = {
  step: 'characteristics',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Fallback',
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

describe('character creation follow helpers', () => {
  it('finds projected creation state by character id', () => {
    const projected = creation('HOMEWORLD')

    assert.equal(
      projectedCharacterCreation(stateWithCreation(projected), characterId),
      projected
    )
    assert.equal(projectedCharacterCreation(null, characterId), null)
  })

  it('syncs flow from projection before falling back to local flow', () => {
    const projectedFlow = syncCharacterCreationFlowFromRoomState({
      currentFlow: null,
      roomState: stateWithCreation(creation('HOMEWORLD')),
      characterId,
      fallbackFlow
    })

    assert.equal(projectedFlow?.step, 'homeworld')

    const fallback = syncCharacterCreationFlowFromRoomState({
      currentFlow: null,
      roomState: stateWithCreation(null),
      characterId,
      fallbackFlow
    })

    assert.equal(fallback, fallbackFlow)
  })

  it('refreshes followed read-only flows and closes missing projections', () => {
    const refreshed = refreshFollowedCharacterCreationFlowFromState({
      state: stateWithCreation(creation('BASIC_TRAINING')),
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })

    assert.equal(refreshed.flow?.step, 'skills')
    assert.equal(refreshed.readOnly, true)
    assert.equal(refreshed.shouldRender, true)
    assert.equal(refreshed.shouldClose, false)

    const missing = refreshFollowedCharacterCreationFlowFromState({
      state: stateWithCreation(null),
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })

    assert.equal(missing.flow, null)
    assert.equal(missing.readOnly, false)
    assert.equal(missing.shouldClose, true)
  })

  it('refreshes editable flows only when no dice reveal deferral is pending', () => {
    assert.equal(
      shouldRefreshEditableCharacterCreationFlow({
        readOnly: false,
        panelOpen: true,
        flow: fallbackFlow,
        deferredRollCount: 0
      }),
      true
    )
    assert.equal(
      shouldRefreshEditableCharacterCreationFlow({
        readOnly: false,
        panelOpen: true,
        flow: fallbackFlow,
        deferredRollCount: 1
      }),
      false
    )
  })
})
