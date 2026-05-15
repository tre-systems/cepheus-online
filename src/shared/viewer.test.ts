import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asPieceId,
  asUserId
} from './ids'
import type { LiveActivityDescriptor } from './live-activity'
import type { GameState } from './state'
import {
  filterGameStateForViewer,
  filterLiveActivitiesForViewer,
  isActorRefereeOrOwner
} from './viewer'

const nowMs = Date.parse('2026-05-03T00:00:03.000Z')
const gameId = asGameId('game-1')
const futureRevealAt = '2026-05-03T00:00:04.500Z'
const pastRevealAt = '2026-05-03T00:00:02.500Z'

const buildState = (): GameState => ({
  id: gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: asUserId('referee'),
  players: {
    [asUserId('referee')]: {
      userId: asUserId('referee'),
      role: 'REFEREE'
    }
  },
  characters: {},
  boards: {},
  pieces: {
    [asPieceId('hidden')]: {
      id: asPieceId('hidden'),
      boardId: asBoardId('board-1'),
      characterId: null,
      imageAssetId: null,
      name: 'Hidden scout',
      x: 0,
      y: 0,
      z: 0,
      width: 50,
      height: 50,
      scale: 1,
      visibility: 'HIDDEN',
      freedom: 'LOCKED'
    },
    [asPieceId('visible')]: {
      id: asPieceId('visible'),
      boardId: asBoardId('board-1'),
      characterId: null,
      imageAssetId: '/assets/counters/TroopsBlackOnGreen.png',
      name: 'Visible scout',
      x: 0,
      y: 0,
      z: 0,
      width: 50,
      height: 50,
      scale: 1,
      visibility: 'VISIBLE',
      freedom: 'LOCKED'
    }
  },
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 2
})

const addDiceRoll = (state: GameState, revealAt: string): void => {
  state.diceLog.push({
    id: 'roll-1',
    actorId: asUserId('player'),
    createdAt: '2026-05-03T00:00:01.000Z',
    revealAt,
    expression: '2d6',
    reason: 'Spot ambush',
    rolls: [3, 4],
    total: 7
  })
}

const buildLiveActivities = (
  createdAt = '2026-05-03T00:00:02.000Z',
  revealAt = futureRevealAt
): LiveActivityDescriptor[] => [
  {
    id: asEventId('game-1:3'),
    eventId: asEventId('game-1:3'),
    gameId,
    seq: 3,
    actorId: asUserId('player'),
    createdAt,
    type: 'diceRoll',
    expression: '2d6',
    reason: 'Scout survival',
    rolls: [3, 4],
    total: 7,
    reveal: {
      revealAt,
      delayMs: 2500
    }
  },
  {
    id: asEventId('game-1:4'),
    eventId: asEventId('game-1:4'),
    gameId,
    seq: 4,
    actorId: asUserId('player'),
    createdAt,
    type: 'characterCreation',
    characterId: asCharacterId('char-1'),
    transition: 'SURVIVAL_PASSED',
    details:
      'Survival passed; total 7; target 7+; DM 0; commission unavailable; advancement unavailable',
    status: 'SKILLS_TRAINING',
    creationComplete: false
  }
]

describe('viewer filtering', () => {
  it('keeps referee state complete', () => {
    const state = buildState()
    const filtered = filterGameStateForViewer(state, {
      userId: asUserId('referee'),
      role: 'PLAYER'
    })

    assert.deepEqual(Object.keys(filtered.pieces).sort(), ['hidden', 'visible'])
  })

  it('removes hidden pieces from player projections', () => {
    const state = buildState()
    const filtered = filterGameStateForViewer(state, {
      userId: asUserId('player'),
      role: 'PLAYER'
    })

    assert.deepEqual(Object.keys(filtered.pieces), ['visible'])
    assert.deepEqual(Object.keys(state.pieces).sort(), ['hidden', 'visible'])
  })

  it('keeps pre-reveal dice rolls and totals visible to referees', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)

    const filtered = filterGameStateForViewer(
      state,
      {
        userId: asUserId('referee'),
        role: 'PLAYER'
      },
      { nowMs }
    )

    assert.deepEqual(filtered.diceLog[0]?.rolls, [3, 4])
    assert.equal(filtered.diceLog[0]?.total, 7)
  })

  it('keeps pre-reveal dice rolls and totals visible to the game owner', () => {
    const state = buildState()
    state.ownerId = asUserId('owner')
    state.players[asUserId('owner')] = {
      userId: asUserId('owner'),
      role: 'PLAYER'
    }
    addDiceRoll(state, futureRevealAt)

    const filtered = filterGameStateForViewer(
      state,
      {
        userId: asUserId('owner'),
        role: 'SPECTATOR'
      },
      { nowMs }
    )

    assert.deepEqual(filtered.diceLog[0]?.rolls, [3, 4])
    assert.equal(filtered.diceLog[0]?.total, 7)
  })

  it('redacts pre-reveal dice rolls and totals from players and spectators', () => {
    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const state = buildState()
      addDiceRoll(state, futureRevealAt)

      const filtered = filterGameStateForViewer(
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      assert.equal('rolls' in filtered.diceLog[0], false)
      assert.equal('total' in filtered.diceLog[0], false)
      assert.deepEqual(state.diceLog[0]?.rolls, [3, 4])
      assert.equal(state.diceLog[0]?.total, 7)
    }
  })

  it('reveals dice rolls and totals to players and spectators after reveal', () => {
    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const state = buildState()
      addDiceRoll(state, pastRevealAt)

      const filtered = filterGameStateForViewer(
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      assert.deepEqual(filtered.diceLog[0]?.rolls, [3, 4])
      assert.equal(filtered.diceLog[0]?.total, 7)
    }
  })

  it('redacts pre-reveal character creation roll facts from player state', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: 22,
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
      creation: {
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Scout',
            skills: ['Pilot-1'],
            skillsAndTraining: ['Vacc Suit-0', 'Pilot-1'],
            benefits: ['Low Passage'],
            complete: true,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 7,
            advancement: 9,
            reEnlistment: 10,
            facts: {
              basicTrainingSkills: ['Vacc Suit-0'],
              survival: {
                rollEventId: asEventId('roll-1'),
                passed: true,
                survival: {
                  expression: '2d6',
                  rolls: [3, 4],
                  total: 7,
                  characteristic: 'end',
                  modifier: 0,
                  target: 7,
                  success: true
                },
                canCommission: false,
                canAdvance: false
              },
              termSkillRolls: [
                {
                  rollEventId: asEventId('roll-1'),
                  career: 'Scout',
                  table: 'serviceSkills',
                  roll: { expression: '1d6', rolls: [3], total: 3 },
                  tableRoll: 3,
                  rawSkill: 'Pilot*',
                  skill: null,
                  characteristic: null,
                  pendingCascadeSkill: 'Pilot-1'
                }
              ],
              reenlistment: {
                rollEventId: asEventId('roll-1'),
                outcome: 'allowed',
                reenlistment: {
                  expression: '2d6',
                  rolls: [5, 5],
                  total: 10,
                  characteristic: null,
                  modifier: 0,
                  target: 6,
                  success: true,
                  outcome: 'allowed'
                }
              },
              anagathicsDecision: {
                rollEventId: asEventId('roll-1'),
                useAnagathics: true,
                termIndex: 0,
                passed: true,
                survival: {
                  expression: '2d6',
                  rolls: [5, 4],
                  total: 9,
                  characteristic: 'end',
                  modifier: 0,
                  target: 6,
                  success: true
                },
                cost: 2500,
                costRoll: {
                  expression: '1d6',
                  rolls: [2],
                  total: 2
                }
              },
              mishap: {
                rollEventId: asEventId('roll-1'),
                roll: { expression: '1d6', rolls: [4], total: 4 },
                outcome: {
                  career: 'Scout',
                  roll: 4,
                  id: 'dishonorable_discharge',
                  description: 'Dishonorable discharge.',
                  discharge: 'dishonorable',
                  benefitEffect: 'lose_all',
                  debtCredits: 0,
                  extraServiceYears: 0,
                  injury: null
                }
              },
              injury: {
                rollEventId: asEventId('roll-1'),
                injuryRoll: { expression: '1d6', rolls: [2], total: 2 },
                severityRoll: { expression: '1d6', rolls: [4], total: 4 },
                outcome: {
                  career: 'Scout',
                  roll: 2,
                  id: 'severely_injured',
                  description:
                    'Severely injured. Reduce one physical characteristic by 1D6.',
                  crisisRisk: true
                },
                selectedLosses: [{ characteristic: 'str', modifier: -4 }],
                characteristicPatch: { str: 3 }
              },
              musteringBenefits: [
                {
                  rollEventId: asEventId('roll-1'),
                  career: 'Scout',
                  kind: 'material',
                  roll: { expression: '2d6', rolls: [5, 6], total: 11 },
                  modifier: 0,
                  tableRoll: 11,
                  value: 'Low Passage',
                  credits: 0
                }
              ]
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        characteristicRolls: {
          str: {
            rollEventId: asEventId('roll-1'),
            value: 7
          }
        },
        pendingCascadeSkills: ['Pilot-1'],
        creationComplete: false,
        timeline: [
          {
            eventId: asEventId('game-1:4'),
            seq: 4,
            createdAt: '2026-05-03T00:00:02.000Z',
            eventType: 'CharacterCreationSurvivalResolved',
            rollEventId: asEventId('roll-1')
          }
        ]
      }
    }

    const filtered = filterGameStateForViewer(
      state,
      {
        userId: asUserId('spectator'),
        role: 'SPECTATOR'
      },
      { nowMs }
    )

    const term =
      filtered.characters[asCharacterId('char-1')]?.creation?.terms[0]
    assert.equal(
      filtered.characters[asCharacterId('char-1')]?.characteristics.str,
      null
    )
    assert.equal(
      filtered.characters[asCharacterId('char-1')]?.creation
        ?.characteristicRolls,
      undefined
    )
    assert.equal(term?.facts?.survival, undefined)
    assert.equal(term?.facts?.termSkillRolls, undefined)
    assert.equal(term?.facts?.reenlistment, undefined)
    assert.equal(term?.facts?.anagathicsDecision, undefined)
    assert.equal(term?.facts?.mishap, undefined)
    assert.equal(term?.facts?.injury, undefined)
    assert.equal(term?.facts?.musteringBenefits, undefined)
    assert.deepEqual(term?.skills, [])
    assert.deepEqual(term?.skillsAndTraining, ['Vacc Suit-0'])
    assert.deepEqual(term?.benefits, [])
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation
        ?.pendingCascadeSkills,
      undefined
    )
    assert.equal('survival' in (term ?? {}), false)
    assert.equal('reEnlistment' in (term ?? {}), false)
    assert.deepEqual(
      state.characters[asCharacterId('char-1')]?.creation?.terms[0]?.facts
        ?.survival?.survival.rolls,
      [3, 4]
    )
    assert.equal(
      state.characters[asCharacterId('char-1')]?.characteristics.str,
      7
    )
  })

  it('redacts pre-reveal dice and roll-dependent activity details from players and spectators', () => {
    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const state = buildState()
      const filtered = filterLiveActivitiesForViewer(
        buildLiveActivities(),
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      const diceActivity = filtered[0]
      const creationActivity = filtered[1]

      assert.equal(diceActivity?.type, 'diceRoll')
      if (diceActivity?.type !== 'diceRoll') return
      assert.equal('rolls' in diceActivity, false)
      assert.equal('total' in diceActivity, false)
      assert.equal('rollsOmitted' in diceActivity, false)
      assert.equal(creationActivity?.type, 'characterCreation')
      if (creationActivity?.type !== 'characterCreation') return
      assert.equal('details' in creationActivity, false)
    }
  })

  it('uses explicit character creation reveal metadata when filtering activity details', () => {
    const state = buildState()
    const activities = buildLiveActivities(
      '2026-05-03T00:00:00.000Z',
      pastRevealAt
    )
    const creationActivity = activities[1]

    assert.equal(creationActivity?.type, 'characterCreation')
    if (creationActivity?.type !== 'characterCreation') return

    creationActivity.reveal = {
      rollEventId: asEventId('game-1:3'),
      revealAt: futureRevealAt,
      delayMs: 2500
    }

    const filtered = filterLiveActivitiesForViewer(
      activities,
      state,
      {
        userId: asUserId('player'),
        role: 'PLAYER'
      },
      { nowMs }
    )

    const diceActivity = filtered[0]
    const filteredCreationActivity = filtered[1]

    assert.equal(diceActivity?.type, 'diceRoll')
    if (diceActivity?.type !== 'diceRoll') return
    assert.deepEqual(diceActivity.rolls, [3, 4])
    assert.equal(diceActivity.total, 7)
    assert.equal(filteredCreationActivity?.type, 'characterCreation')
    if (filteredCreationActivity?.type !== 'characterCreation') return
    assert.equal('details' in filteredCreationActivity, false)
    assert.deepEqual(filteredCreationActivity.reveal, {
      rollEventId: asEventId('game-1:3'),
      revealAt: futureRevealAt,
      delayMs: 2500
    })
  })

  it('redacts explicit reveal metadata activity details without relying on transition names', () => {
    const state = buildState()
    const activities = buildLiveActivities()
    const creationActivity = activities[1]

    assert.equal(creationActivity?.type, 'characterCreation')
    if (creationActivity?.type !== 'characterCreation') return

    creationActivity.transition = 'BACKGROUND_SKILL_SELECTED'
    creationActivity.details = 'Background skill: Admin'
    creationActivity.reveal = {
      rollEventId: asEventId('game-1:3'),
      revealAt: futureRevealAt,
      delayMs: 2500
    }

    const filtered = filterLiveActivitiesForViewer(
      activities,
      state,
      {
        userId: asUserId('player'),
        role: 'PLAYER'
      },
      { nowMs }
    )

    const filteredCreationActivity = filtered[1]

    assert.equal(filteredCreationActivity?.type, 'characterCreation')
    if (filteredCreationActivity?.type !== 'characterCreation') return
    assert.equal('details' in filteredCreationActivity, false)
    assert.deepEqual(filteredCreationActivity.reveal, {
      rollEventId: asEventId('game-1:3'),
      revealAt: futureRevealAt,
      delayMs: 2500
    })
  })

  it('keeps legacy characteristic completion details safe before fallback reveal', () => {
    const state = buildState()
    const activities = buildLiveActivities(
      '2026-05-03T00:00:02.000Z',
      pastRevealAt
    )
    const creationActivity = activities[1]

    assert.equal(creationActivity?.type, 'characterCreation')
    if (creationActivity?.type !== 'characterCreation') return

    creationActivity.transition = 'SET_CHARACTERISTICS'
    creationActivity.details = 'Characteristics assigned'

    const filtered = filterLiveActivitiesForViewer(
      activities,
      state,
      {
        userId: asUserId('player'),
        role: 'PLAYER'
      },
      { nowMs }
    )

    const diceActivity = filtered[0]
    const filteredCreationActivity = filtered[1]

    assert.equal(diceActivity?.type, 'diceRoll')
    if (diceActivity?.type !== 'diceRoll') return
    assert.deepEqual(diceActivity.rolls, [3, 4])
    assert.equal(diceActivity.total, 7)
    assert.equal(filteredCreationActivity?.type, 'characterCreation')
    if (filteredCreationActivity?.type !== 'characterCreation') return
    assert.equal('details' in filteredCreationActivity, false)
  })

  it('keeps pre-reveal dice and roll-dependent activity details visible to owners and referees', () => {
    const state = buildState()
    state.ownerId = asUserId('owner')
    state.players[asUserId('owner')] = {
      userId: asUserId('owner'),
      role: 'PLAYER'
    }

    for (const viewer of [
      { userId: asUserId('referee'), role: 'REFEREE' as const },
      { userId: asUserId('owner'), role: 'PLAYER' as const }
    ]) {
      const filtered = filterLiveActivitiesForViewer(
        buildLiveActivities(),
        state,
        viewer,
        { nowMs }
      )

      const diceActivity = filtered[0]
      const creationActivity = filtered[1]

      assert.equal(diceActivity?.type, 'diceRoll')
      if (diceActivity?.type !== 'diceRoll') return
      assert.deepEqual(diceActivity.rolls, [3, 4])
      assert.equal(diceActivity.total, 7)
      assert.equal(creationActivity?.type, 'characterCreation')
      if (creationActivity?.type !== 'characterCreation') return
      assert.equal(
        creationActivity.details,
        'Survival passed; total 7; target 7+; DM 0; commission unavailable; advancement unavailable'
      )
    }
  })

  it('reveals dice and roll-dependent activity details to players and spectators after reveal', () => {
    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const state = buildState()
      const filtered = filterLiveActivitiesForViewer(
        buildLiveActivities(
          '2026-05-03T00:00:00.000Z',
          '2026-05-03T00:00:02.500Z'
        ),
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      const diceActivity = filtered[0]
      const creationActivity = filtered[1]

      assert.equal(diceActivity?.type, 'diceRoll')
      if (diceActivity?.type !== 'diceRoll') return
      assert.deepEqual(diceActivity.rolls, [3, 4])
      assert.equal(diceActivity.total, 7)
      assert.equal(creationActivity?.type, 'characterCreation')
      if (creationActivity?.type !== 'characterCreation') return
      assert.equal(
        creationActivity.details,
        'Survival passed; total 7; target 7+; DM 0; commission unavailable; advancement unavailable'
      )
    }
  })

  it('derives actor referee authority from owner or room role', () => {
    const state = buildState()
    state.players[asUserId('assistant-referee')] = {
      userId: asUserId('assistant-referee'),
      role: 'REFEREE'
    }
    state.players[asUserId('player')] = {
      userId: asUserId('player'),
      role: 'PLAYER'
    }

    assert.equal(isActorRefereeOrOwner(state, asUserId('referee')), true)
    assert.equal(
      isActorRefereeOrOwner(state, asUserId('assistant-referee')),
      true
    )
    assert.equal(isActorRefereeOrOwner(state, asUserId('player')), false)
    assert.equal(isActorRefereeOrOwner(state, asUserId('stranger')), false)
    assert.equal(isActorRefereeOrOwner(null, asUserId('referee')), false)
  })
})
