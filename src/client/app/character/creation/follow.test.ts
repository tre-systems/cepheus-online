import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import { type CharacterCreationFlow, createInitialCharacterDraft } from './flow'
import {
  canRenderReadOnlyFollowFromReadModel,
  projectedCharacterCreation,
  refreshFollowedCharacterCreationFlowFromState,
  shouldRefreshEditableCharacterCreationFlow,
  syncCharacterCreationFlowFromRoomState
} from './follow'
import { deriveCharacterCreationViewModel } from './model'

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

  it('does not preserve stale current flow when an authoritative response lacks projection', () => {
    const staleFlow = {
      ...fallbackFlow,
      step: 'career' as const
    }

    const synced = syncCharacterCreationFlowFromRoomState({
      currentFlow: staleFlow,
      roomState: stateWithCreation(null),
      characterId,
      fallbackFlow: null
    })

    assert.equal(synced, null)
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

  it('hydrates mustering benefits from projected semantic facts', () => {
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
        diceRoll: 11,
        modifier: 0,
        tableRoll: 11,
        value: 'Low Passage',
        credits: 0
      }
    ])
  })

  it('syncs mustering equipment setup from the projection', () => {
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

    assert.equal(syncedFlow === equipmentFlow, false)
    assert.equal(syncedFlow?.step, 'equipment')
    assert.equal(syncedFlow?.draft.name, 'Scout')
  })

  it('does not preserve stale local review flow over active projection', () => {
    const reviewFlow = {
      ...fallbackFlow,
      step: 'review' as const
    }
    const syncedFlow = syncCharacterCreationFlowFromRoomState({
      currentFlow: reviewFlow,
      roomState: stateWithCreation(creation('ACTIVE')),
      characterId,
      fallbackFlow: reviewFlow
    })

    assert.equal(syncedFlow === reviewFlow, false)
    assert.equal(syncedFlow?.step, 'review')
    assert.equal(syncedFlow?.draft.name, 'Scout')
  })

  it('refreshes followed read-only flows and closes missing projections', () => {
    const refreshed = refreshFollowedCharacterCreationFlowFromState({
      state: stateWithCreation(creation('BASIC_TRAINING')),
      currentFlow: null,
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })

    assert.equal(refreshed.flow, null)
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

  it('keeps early read-only follow statuses on the shared read model without legacy flow', () => {
    for (const status of [
      'CHARACTERISTICS',
      'HOMEWORLD',
      'CAREER_SELECTION',
      'BASIC_TRAINING',
      'SKILLS_TRAINING',
      'MUSTERING_OUT',
      'PLAYABLE',
      'DECEASED'
    ] as const) {
      const characterState = stateWithCreation(creation(status)).characters[
        characterId
      ]
      assert.equal(canRenderReadOnlyFollowFromReadModel(characterState), true)

      const refreshed = refreshFollowedCharacterCreationFlowFromState({
        state: stateWithCreation(creation(status)),
        currentFlow: fallbackFlow,
        selectedCharacterId: characterId,
        readOnly: true,
        panelOpen: true
      })

      assert.equal(refreshed.flow, null)
      assert.equal(refreshed.readOnly, true)
      assert.equal(refreshed.shouldRender, true)
      assert.equal(refreshed.shouldClose, false)
    }
  })

  it('fails closed for read-only follow statuses that are not read-model backed', () => {
    const unsupportedCreation = creation('HOMEWORLD')
    unsupportedCreation.state.status =
      'LEGACY_COMPATIBILITY_ONLY' as CharacterCreationProjection['state']['status']

    const characterState =
      stateWithCreation(unsupportedCreation).characters[characterId]
    assert.equal(canRenderReadOnlyFollowFromReadModel(characterState), false)

    const refreshed = refreshFollowedCharacterCreationFlowFromState({
      state: stateWithCreation(unsupportedCreation),
      currentFlow: fallbackFlow,
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })

    assert.equal(refreshed.flow, null)
    assert.equal(refreshed.readOnly, false)
    assert.equal(refreshed.shouldRender, false)
    assert.equal(refreshed.shouldClose, true)
  })

  it('refreshes followed mustering equipment setup from the projection', () => {
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

    assert.equal(refreshed.flow === equipmentFlow, false)
    assert.equal(refreshed.flow, null)
    assert.equal(refreshed.shouldRender, true)
  })

  it('derives followed final summaries from projected facts before stale aggregates', () => {
    const projected = creation('PLAYABLE')
    projected.creationComplete = true
    projected.terms = [
      {
        career: 'Scout',
        skills: ['Legacy Skill-6'],
        skillsAndTraining: ['Legacy Training-5'],
        benefits: ['Legacy Benefit'],
        survival: 2,
        advancement: 2,
        reEnlistment: 2,
        complete: true,
        canReenlist: false,
        completedBasicTraining: true,
        musteringOut: true,
        anagathics: false,
        facts: {
          survival: {
            passed: true,
            canCommission: false,
            canAdvance: true,
            survival: {
              expression: '2d6',
              rolls: [5, 5],
              total: 10,
              characteristic: 'end',
              modifier: 1,
              target: 7,
              success: true
            }
          },
          advancement: {
            skipped: false,
            passed: true,
            advancement: {
              expression: '2d6',
              rolls: [6, 5],
              total: 11,
              characteristic: 'edu',
              modifier: 1,
              target: 8,
              success: true
            },
            rank: {
              career: 'Scout',
              previousRank: 0,
              newRank: 1,
              title: 'Courier',
              bonusSkill: 'Pilot-1'
            }
          },
          termSkillRolls: [
            {
              career: 'Scout',
              table: 'serviceSkills',
              roll: { expression: '1d6', rolls: [3], total: 3 },
              tableRoll: 3,
              rawSkill: 'Gambling',
              skill: 'Gambling-1',
              characteristic: null,
              pendingCascadeSkill: null
            }
          ],
          reenlistment: {
            outcome: 'allowed',
            reenlistment: {
              expression: '2d6',
              rolls: [5, 4],
              total: 9,
              characteristic: null,
              modifier: 0,
              target: 6,
              success: true,
              outcome: 'allowed'
            }
          },
          musteringBenefits: [
            {
              career: 'Scout',
              kind: 'material',
              roll: { expression: '2d6', rolls: [2, 2], total: 4 },
              modifier: 0,
              tableRoll: 4,
              value: 'Blade',
              credits: 0,
              materialItem: 'Blade'
            }
          ]
        }
      }
    ]
    projected.careers = [{ name: 'Scout', rank: 1 }]

    const roomState = stateWithCreation(projected)
    const refreshed = refreshFollowedCharacterCreationFlowFromState({
      state: roomState,
      currentFlow: fallbackFlow,
      selectedCharacterId: characterId,
      readOnly: true,
      panelOpen: true
    })
    assert.equal(refreshed.flow, null)

    const summary = deriveCharacterCreationViewModel({
      flow: null,
      projection: projected,
      character: roomState.characters[characterId],
      readOnly: true
    }).wizard?.review
    if (!summary) throw new Error('Expected followed final summary')
    const career = summary.sections.find((section) => section.key === 'career')
    const careerHistory = summary.sections.find(
      (section) => section.key === 'career-history'
    )
    const skills = summary.sections.find((section) => section.key === 'skills')
    const mustering = summary.sections.find(
      (section) => section.key === 'mustering-out'
    )

    assert.deepEqual(careerHistory?.items, [
      {
        label: 'Term 1',
        value:
          'Scout, survived, advanced, rank Courier, rank skill Pilot-1, training Gambling-1 (3)'
      }
    ])
    assert.deepEqual(career?.items, [
      { label: 'Career', value: 'Scout' },
      { label: 'Qualification', value: 'Not set' },
      { label: 'Survival', value: '10 (passed)' },
      { label: 'Commission', value: 'Not available' },
      { label: 'Advancement', value: '11 (passed)' }
    ])
    assert.deepEqual(skills?.items, [{ label: 'Skills', value: 'Gambling-1' }])
    assert.deepEqual(mustering?.items, [
      { label: 'Benefit 1', value: 'Scout material: Blade (Roll 4)' }
    ])
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
