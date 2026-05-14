import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import { createInitialCharacterDraft, type CharacterCreationFlow } from './flow'
import {
  projectedCharacterCreation,
  refreshFollowedCharacterCreationFlowFromState,
  shouldRefreshEditableCharacterCreationFlow,
  syncCharacterCreationFlowFromRoomState
} from './follow'

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

  it('replaces stale local editable flow after the server projection advances', () => {
    const staleHomeworldFlow = {
      ...fallbackFlow,
      step: 'homeworld' as const
    }

    const syncedFlow = syncCharacterCreationFlowFromRoomState({
      currentFlow: staleHomeworldFlow,
      roomState: stateWithCreation(creation('BASIC_TRAINING')),
      characterId,
      fallbackFlow: staleHomeworldFlow
    })

    assert.equal(syncedFlow?.step, 'skills')
    assert.equal(syncedFlow === staleHomeworldFlow, false)
  })

  it('hydrates mustering benefits from projected semantic history', () => {
    const projectedFlow = syncCharacterCreationFlowFromRoomState({
      currentFlow: null,
      roomState: stateWithCreation({
        ...creation('MUSTERING_OUT'),
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: [],
            benefits: ['Low Passage'],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false,
            facts: {
              musteringBenefits: [
                {
                  career: 'Scout',
                  kind: 'material',
                  roll: {
                    expression: '2d6',
                    rolls: [5, 6],
                    total: 11
                  },
                  modifier: 0,
                  tableRoll: 11,
                  value: 'Low Passage',
                  credits: 0
                }
              ]
            }
          }
        ],
        history: [
          {
            type: 'FINISH_MUSTERING',
            musteringBenefit: {
              career: 'Scout',
              kind: 'material',
              roll: {
                expression: '2d6',
                rolls: [5, 6],
                total: 11
              },
              modifier: 0,
              tableRoll: 11,
              value: 'Low Passage',
              credits: 0,
              materialItem: 'Low Passage'
            }
          }
        ]
      }),
      characterId,
      fallbackFlow
    })

    assert.deepEqual(projectedFlow?.draft.musteringBenefits, [
      {
        career: 'Scout',
        kind: 'material',
        roll: 11,
        value: 'Low Passage',
        credits: 0
      }
    ])
  })

  it('keeps local post-career review setup ahead of an older projection step', () => {
    const equipmentFlow = {
      ...fallbackFlow,
      step: 'equipment' as const
    }
    const syncedFlow = syncCharacterCreationFlowFromRoomState({
      currentFlow: equipmentFlow,
      roomState: stateWithCreation(creation('MUSTERING_OUT')),
      characterId,
      fallbackFlow: equipmentFlow
    })

    assert.equal(syncedFlow, equipmentFlow)
  })

  it('refreshes followed read-only flows and closes missing projections', () => {
    const refreshed = refreshFollowedCharacterCreationFlowFromState({
      state: stateWithCreation(creation('BASIC_TRAINING')),
      currentFlow: null,
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
      currentFlow: null,
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })

    assert.equal(missing.flow, null)
    assert.equal(missing.readOnly, false)
    assert.equal(missing.shouldClose, true)
  })

  it('keeps followed post-career equipment setup ahead of an older projection step', () => {
    const equipmentFlow = {
      ...fallbackFlow,
      step: 'equipment' as const
    }
    const refreshed = refreshFollowedCharacterCreationFlowFromState({
      state: stateWithCreation(creation('MUSTERING_OUT')),
      currentFlow: equipmentFlow,
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })

    assert.equal(refreshed.flow, equipmentFlow)
    assert.equal(refreshed.shouldRender, true)
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
