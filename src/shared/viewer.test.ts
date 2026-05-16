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

  it('hides pre-reveal dice rolls and totals from referees', () => {
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

    assert.equal('rolls' in (filtered.diceLog[0] ?? {}), false)
    assert.equal('total' in (filtered.diceLog[0] ?? {}), false)
  })

  it('hides pre-reveal dice rolls and totals from the game owner', () => {
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

    assert.equal('rolls' in (filtered.diceLog[0] ?? {}), false)
    assert.equal('total' in (filtered.diceLog[0] ?? {}), false)
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
      age: 24,
      characteristics: {
        str: 7,
        dex: 7,
        end: 7,
        int: 7,
        edu: 8,
        soc: 7
      },
      skills: ['Vacc Suit-0', 'Pilot-1'],
      equipment: [
        {
          name: 'Low Passage',
          quantity: 1,
          notes: 'Mustering benefit: Scout'
        }
      ],
      credits: 7100,
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
            benefits: ['Low Passage', '10000'],
            complete: true,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: true,
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
                },
                {
                  rollEventId: asEventId('roll-1'),
                  career: 'Scout',
                  table: 'personalDevelopment',
                  roll: { expression: '1d6', rolls: [4], total: 4 },
                  tableRoll: 4,
                  rawSkill: '+1 Edu',
                  skill: null,
                  characteristic: { key: 'edu', modifier: 1 },
                  pendingCascadeSkill: null
                }
              ],
              advancement: {
                rollEventId: asEventId('roll-1'),
                skipped: false,
                passed: true,
                advancement: {
                  expression: '2d6',
                  rolls: [5, 4],
                  total: 9,
                  characteristic: null,
                  modifier: 0,
                  target: 8,
                  success: true
                },
                rank: {
                  career: 'Scout',
                  previousRank: 0,
                  newRank: 1,
                  title: 'Courier',
                  bonusSkill: null
                }
              },
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
                  debtCredits: 500,
                  extraServiceYears: 2,
                  injury: null
                }
              },
              aging: {
                rollEventId: asEventId('roll-1'),
                roll: { expression: '2d6', rolls: [3, 3], total: 6 },
                modifier: -1,
                age: 22,
                characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
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
                },
                {
                  rollEventId: asEventId('roll-1'),
                  career: 'Scout',
                  kind: 'cash',
                  roll: { expression: '2d6', rolls: [4, 6], total: 10 },
                  modifier: 0,
                  tableRoll: 10,
                  value: '10000',
                  credits: 10000
                }
              ]
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 1 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }],
        characteristicRolls: {
          str: {
            rollEventId: asEventId('roll-1'),
            value: 7
          }
        },
        pendingCascadeSkills: ['Pilot-1'],
        pendingDecisions: [
          { key: 'agingResolution' },
          { key: 'anagathicsDecision' },
          { key: 'injuryResolution' },
          { key: 'mishapResolution' }
        ],
        creationComplete: false,
        timeline: [
          {
            eventId: asEventId('game-1:4'),
            seq: 4,
            createdAt: '2026-05-03T00:00:02.000Z',
            eventType: 'CharacterCreationSurvivalResolved',
            rollEventId: asEventId('roll-1')
          }
        ],
        history: [
          { type: 'COMPLETE_HOMEWORLD' },
          {
            type: 'SURVIVAL_PASSED',
            canCommission: false,
            canAdvance: false,
            survival: {
              expression: '2d6',
              rolls: [3, 4],
              total: 7,
              characteristic: 'end',
              modifier: 0,
              target: 7,
              success: true
            }
          },
          {
            type: 'ROLL_TERM_SKILL',
            termSkill: {
              career: 'Scout',
              table: 'serviceSkills',
              roll: { expression: '1d6', rolls: [3], total: 3 },
              tableRoll: 3,
              rawSkill: 'Pilot*',
              skill: null,
              characteristic: null,
              pendingCascadeSkill: 'Pilot-1'
            }
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
      filtered.characters[asCharacterId('char-1')]?.characteristics.edu,
      7
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
    assert.equal(term?.facts?.aging, undefined)
    assert.equal(term?.facts?.advancement, undefined)
    assert.equal(term?.facts?.mishap, undefined)
    assert.equal(term?.facts?.injury, undefined)
    assert.equal(term?.facts?.musteringBenefits, undefined)
    assert.deepEqual(term?.skills, [])
    assert.deepEqual(term?.skillsAndTraining, ['Vacc Suit-0'])
    assert.deepEqual(filtered.characters[asCharacterId('char-1')]?.skills, [
      'Vacc Suit-0'
    ])
    assert.deepEqual(term?.benefits, [])
    assert.equal(filtered.characters[asCharacterId('char-1')]?.credits, 100)
    assert.equal(filtered.characters[asCharacterId('char-1')]?.age, 18)
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.equipment,
      []
    )
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation
        ?.pendingCascadeSkills,
      undefined
    )
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation
        ?.characteristicChanges,
      []
    )
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation?.pendingDecisions,
      undefined
    )
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation?.careers,
      [{ name: 'Scout', rank: 0 }]
    )
    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation?.history,
      [{ type: 'COMPLETE_HOMEWORLD' }]
    )
    assert.equal('survival' in (term ?? {}), false)
    assert.equal('advancement' in (term ?? {}), false)
    assert.equal('reEnlistment' in (term ?? {}), false)
    assert.equal(term?.anagathics, false)
    assert.equal(term?.anagathicsCost, undefined)
    assert.equal(term?.complete, false)
    assert.equal(term?.musteringOut, false)
    assert.deepEqual(
      state.characters[asCharacterId('char-1')]?.creation?.terms[0]?.facts
        ?.survival?.survival.rolls,
      [3, 4]
    )
    assert.equal(
      state.characters[asCharacterId('char-1')]?.characteristics.str,
      7
    )
    assert.equal(
      state.characters[asCharacterId('char-1')]?.characteristics.edu,
      8
    )
    assert.deepEqual(state.characters[asCharacterId('char-1')]?.skills, [
      'Vacc Suit-0',
      'Pilot-1'
    ])
    assert.equal(state.characters[asCharacterId('char-1')]?.credits, 7100)
    assert.equal(state.characters[asCharacterId('char-1')]?.age, 24)
    assert.equal(state.characters[asCharacterId('char-1')]?.equipment.length, 1)
    assert.equal(
      state.characters[asCharacterId('char-1')]?.creation?.history?.length,
      3
    )
  })

  it('redacts pre-reveal final term skill roll progress from top-level creation state', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: 18,
      characteristics: {
        str: 7,
        dex: 7,
        end: 7,
        int: 7,
        edu: 7,
        soc: 7
      },
      skills: ['Vacc Suit-0', 'Pilot-1'],
      equipment: [],
      credits: 0,
      creation: {
        state: {
          status: 'AGING',
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
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            facts: {
              basicTrainingSkills: ['Vacc Suit-0'],
              termSkillRolls: [
                {
                  rollEventId: asEventId('roll-1'),
                  career: 'Scout',
                  table: 'serviceSkills',
                  roll: { expression: '1d6', rolls: [3], total: 3 },
                  tableRoll: 3,
                  rawSkill: 'Pilot',
                  skill: 'Pilot-1',
                  characteristic: null,
                  pendingCascadeSkill: null
                }
              ]
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        requiredTermSkillCount: 1,
        creationComplete: false,
        actionPlan: {
          status: 'AGING',
          pendingDecisions: [],
          legalActions: []
        }
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

    const character = filtered.characters[asCharacterId('char-1')]
    const creation = character?.creation
    const term = creation?.terms[0]

    assert.equal(creation?.state.status, 'SKILLS_TRAINING')
    assert.equal(creation?.actionPlan, undefined)
    assert.equal(term?.facts?.termSkillRolls, undefined)
    assert.deepEqual(term?.skills, [])
    assert.deepEqual(term?.skillsAndTraining, ['Vacc Suit-0'])
    assert.deepEqual(character?.skills, ['Vacc Suit-0'])
  })

  it('redacts pre-reveal mustering benefit progress from top-level creation state', () => {
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
      credits: 1000,
      creation: {
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: [],
            benefits: ['1000'],
            complete: true,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false,
            facts: {
              musteringBenefits: [
                {
                  rollEventId: asEventId('roll-1'),
                  career: 'Scout',
                  kind: 'cash',
                  roll: { expression: '2d6', rolls: [1, 1], total: 2 },
                  modifier: 0,
                  tableRoll: 2,
                  value: '1000',
                  credits: 1000
                }
              ]
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false,
        actionPlan: {
          status: 'MUSTERING_OUT',
          pendingDecisions: [],
          legalActions: []
        }
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

    const character = filtered.characters[asCharacterId('char-1')]
    const creation = character?.creation
    const term = creation?.terms[0]

    assert.equal(creation?.state.status, 'MUSTERING_OUT')
    assert.equal(creation?.actionPlan, undefined)
    assert.equal(term?.facts?.musteringBenefits, undefined)
    assert.deepEqual(term?.benefits, [])
    assert.equal(character?.credits, 0)
  })

  it('redacts pre-reveal advancement progress from top-level creation state', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: 18,
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
            canAdvance: true
          }
        },
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            advancement: 9,
            facts: {
              advancement: {
                rollEventId: asEventId('roll-1'),
                skipped: false,
                passed: true,
                advancement: {
                  expression: '2d6',
                  rolls: [5, 4],
                  total: 9,
                  characteristic: null,
                  modifier: 0,
                  target: 8,
                  success: true
                },
                rank: {
                  career: 'Scout',
                  previousRank: 0,
                  newRank: 1,
                  title: 'Courier',
                  bonusSkill: null
                }
              }
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 1 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false,
        actionPlan: {
          status: 'SKILLS_TRAINING',
          pendingDecisions: [],
          legalActions: []
        }
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

    const creation = filtered.characters[asCharacterId('char-1')]?.creation
    const term = creation?.terms[0]
    assert.equal(creation?.state.status, 'ADVANCEMENT')
    assert.equal(creation?.actionPlan, undefined)
    assert.deepEqual(creation?.careers, [{ name: 'Scout', rank: 0 }])
    assert.equal(term?.facts?.advancement, undefined)
    assert.equal('advancement' in (term ?? {}), false)
  })

  it('redacts pre-reveal qualification success from top-level creation state', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Agent',
      active: true,
      notes: '',
      age: 18,
      characteristics: {
        str: 7,
        dex: 7,
        end: 7,
        int: 9,
        edu: 7,
        soc: 7
      },
      skills: [],
      equipment: [],
      credits: 0,
      creation: {
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Agent',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false,
            facts: {
              qualification: {
                rollEventId: asEventId('roll-1'),
                career: 'Agent',
                passed: true,
                previousCareerCount: 0,
                failedQualificationOptions: ['Draft', 'Drifter'],
                qualification: {
                  expression: '2d6',
                  rolls: [5, 4],
                  total: 9,
                  characteristic: 'soc',
                  modifier: 1,
                  target: 6,
                  success: true
                }
              }
            }
          }
        ],
        careers: [{ name: 'Agent', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false,
        actionPlan: {
          status: 'BASIC_TRAINING',
          pendingDecisions: [],
          legalActions: []
        }
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

    const creation = filtered.characters[asCharacterId('char-1')]?.creation
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.equal(creation?.actionPlan, undefined)
    assert.deepEqual(creation?.terms, [])
    assert.deepEqual(creation?.careers, [])
    assert.equal(creation?.failedToQualify, false)

    const refereeView = filterGameStateForViewer(
      state,
      {
        userId: asUserId('referee'),
        role: 'REFEREE'
      },
      { nowMs }
    )
    assert.equal(
      refereeView.characters[asCharacterId('char-1')]?.creation?.state.status,
      'CAREER_SELECTION'
    )
    assert.deepEqual(
      refereeView.characters[asCharacterId('char-1')]?.creation?.terms,
      []
    )
  })

  it('redacts pre-reveal failed qualification fallback state', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Rogue',
      active: true,
      notes: '',
      age: 18,
      characteristics: {
        str: 7,
        dex: 7,
        end: 7,
        int: 7,
        edu: 7,
        soc: 5
      },
      skills: [],
      equipment: [],
      credits: 0,
      creation: {
        state: {
          status: 'CAREER_SELECTION',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [],
        careers: [],
        canEnterDraft: true,
        failedToQualify: true,
        failedQualification: {
          rollEventId: asEventId('roll-1'),
          career: 'Rogue',
          passed: false,
          previousCareerCount: 0,
          failedQualificationOptions: ['Draft', 'Drifter'],
          qualification: {
            expression: '2d6',
            rolls: [1, 2],
            total: 3,
            characteristic: 'dex',
            modifier: -1,
            target: 5,
            success: false
          }
        },
        characteristicChanges: [],
        creationComplete: false,
        actionPlan: {
          status: 'CAREER_SELECTION',
          pendingDecisions: [],
          legalActions: []
        }
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

    const creation = filtered.characters[asCharacterId('char-1')]?.creation
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.equal(creation?.actionPlan, undefined)
    assert.equal(creation?.failedToQualify, false)
    assert.equal(creation?.failedQualification, undefined)
  })

  it('redacts pre-reveal draft career assignment from top-level creation state', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Draftee',
      active: true,
      notes: '',
      age: 18,
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
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Navy',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false,
            draft: 1,
            facts: {
              draft: {
                rollEventId: asEventId('roll-1'),
                roll: { expression: '1d6', rolls: [4], total: 4 },
                tableRoll: 4,
                acceptedCareer: 'Navy'
              }
            }
          }
        ],
        careers: [{ name: 'Navy', rank: 0 }],
        canEnterDraft: false,
        failedToQualify: false,
        failedQualification: null,
        characteristicChanges: [],
        creationComplete: false,
        actionPlan: {
          status: 'BASIC_TRAINING',
          pendingDecisions: [],
          legalActions: []
        }
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

    const creation = filtered.characters[asCharacterId('char-1')]?.creation
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.equal(creation?.actionPlan, undefined)
    assert.deepEqual(creation?.terms, [])
    assert.deepEqual(creation?.careers, [])
  })

  it('keeps revealed failed qualification fallback while draft outcome is hidden', () => {
    const state = buildState()
    addDiceRoll(state, pastRevealAt)
    state.diceLog.push({
      id: 'roll-2',
      actorId: asUserId('player'),
      createdAt: '2026-05-03T00:00:02.000Z',
      revealAt: futureRevealAt,
      expression: '1d6',
      reason: 'Draft',
      rolls: [4],
      total: 4
    })
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Draftee',
      active: true,
      notes: '',
      age: 18,
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
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Navy',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false,
            draft: 1,
            facts: {
              draft: {
                rollEventId: asEventId('roll-2'),
                roll: { expression: '1d6', rolls: [4], total: 4 },
                tableRoll: 4,
                acceptedCareer: 'Navy'
              }
            }
          }
        ],
        careers: [{ name: 'Navy', rank: 0 }],
        canEnterDraft: false,
        failedToQualify: false,
        failedQualification: null,
        characteristicChanges: [],
        creationComplete: false,
        timeline: [
          {
            eventId: asEventId('game-1:3'),
            seq: 3,
            createdAt: '2026-05-03T00:00:01.000Z',
            eventType: 'CharacterCreationQualificationResolved',
            rollEventId: asEventId('roll-1')
          },
          {
            eventId: asEventId('game-1:4'),
            seq: 4,
            createdAt: '2026-05-03T00:00:02.000Z',
            eventType: 'CharacterCreationDraftResolved',
            rollEventId: asEventId('roll-2')
          }
        ],
        actionPlan: {
          status: 'BASIC_TRAINING',
          pendingDecisions: [],
          legalActions: []
        }
      }
    }

    for (const role of ['PLAYER', 'SPECTATOR'] as const) {
      const filtered = filterGameStateForViewer(
        state,
        {
          userId: asUserId(role.toLowerCase()),
          role
        },
        { nowMs }
      )

      const creation = filtered.characters[asCharacterId('char-1')]?.creation
      assert.equal(creation?.state.status, 'CAREER_SELECTION')
      assert.equal(creation?.canEnterDraft, true)
      assert.equal(creation?.failedToQualify, true)
      assert.deepEqual(creation?.terms, [])
      assert.deepEqual(creation?.careers, [])
      assert.deepEqual(creation?.actionPlan?.legalActions, [
        {
          key: 'selectCareer',
          status: 'CAREER_SELECTION',
          commandTypes: [
            'ResolveCharacterCreationQualification',
            'ResolveCharacterCreationDraft',
            'EnterCharacterCreationDrifter'
          ],
          failedQualificationOptions: [
            { option: 'Drifter' },
            {
              option: 'Draft',
              rollRequirement: { key: 'draft', dice: '1d6' }
            }
          ]
        }
      ])
    }
  })

  it('does not expose failed qualification fallback when qualification and draft are hidden', () => {
    const state = buildState()
    addDiceRoll(state, futureRevealAt)
    state.diceLog.push({
      id: 'roll-2',
      actorId: asUserId('player'),
      createdAt: '2026-05-03T00:00:02.000Z',
      revealAt: futureRevealAt,
      expression: '1d6',
      reason: 'Draft',
      rolls: [4],
      total: 4
    })
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Draftee',
      active: true,
      notes: '',
      age: 18,
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
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Navy',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false,
            draft: 1,
            facts: {
              draft: {
                rollEventId: asEventId('roll-2'),
                roll: { expression: '1d6', rolls: [4], total: 4 },
                tableRoll: 4,
                acceptedCareer: 'Navy'
              }
            }
          }
        ],
        careers: [{ name: 'Navy', rank: 0 }],
        canEnterDraft: false,
        failedToQualify: false,
        failedQualification: null,
        characteristicChanges: [],
        creationComplete: false,
        timeline: [
          {
            eventId: asEventId('game-1:3'),
            seq: 3,
            createdAt: '2026-05-03T00:00:01.000Z',
            eventType: 'CharacterCreationQualificationResolved',
            rollEventId: asEventId('roll-1')
          },
          {
            eventId: asEventId('game-1:4'),
            seq: 4,
            createdAt: '2026-05-03T00:00:02.000Z',
            eventType: 'CharacterCreationDraftResolved',
            rollEventId: asEventId('roll-2')
          }
        ],
        actionPlan: {
          status: 'BASIC_TRAINING',
          pendingDecisions: [],
          legalActions: []
        }
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

    const creation = filtered.characters[asCharacterId('char-1')]?.creation
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.equal(creation?.canEnterDraft, true)
    assert.equal(creation?.failedToQualify, false)
    assert.equal(creation?.actionPlan, undefined)
    assert.deepEqual(creation?.terms, [])
    assert.deepEqual(creation?.careers, [])
  })

  it('redacts pre-reveal aging progress from top-level creation state', () => {
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
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            facts: {
              aging: {
                rollEventId: asEventId('roll-1'),
                roll: { expression: '2d6', rolls: [6, 6], total: 12 },
                modifier: -1,
                age: 22,
                characteristicChanges: []
              }
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false,
        actionPlan: {
          status: 'REENLISTMENT',
          pendingDecisions: [],
          legalActions: []
        }
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

    const creation = filtered.characters[asCharacterId('char-1')]?.creation
    const term = creation?.terms[0]
    assert.equal(filtered.characters[asCharacterId('char-1')]?.age, 18)
    assert.equal(creation?.state.status, 'AGING')
    assert.equal(creation?.actionPlan, undefined)
    assert.equal(term?.facts?.aging, undefined)
  })

  it('redacts pre-reveal failed anagathics progress from top-level creation state', () => {
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
      skills: ['Vacc Suit-0'],
      equipment: [],
      credits: -5000,
      creation: {
        state: {
          status: 'MISHAP',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            facts: {
              basicTrainingSkills: ['Vacc Suit-0'],
              anagathicsDecision: {
                rollEventId: asEventId('roll-1'),
                useAnagathics: true,
                termIndex: 0,
                passed: false,
                survival: {
                  expression: '2d6',
                  rolls: [1, 1],
                  total: 2,
                  characteristic: 'end',
                  modifier: 0,
                  target: 7,
                  success: false
                }
              }
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        pendingDecisions: [{ key: 'mishapResolution' }],
        creationComplete: false,
        actionPlan: {
          status: 'MISHAP',
          pendingDecisions: [{ key: 'mishapResolution' }],
          legalActions: [
            {
              key: 'resolveMishap',
              status: 'MISHAP',
              commandTypes: ['ResolveCharacterCreationMishap']
            }
          ]
        }
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

    const character = filtered.characters[asCharacterId('char-1')]
    const creation = character?.creation
    const term = creation?.terms[0]
    assert.equal(creation?.state.status, 'AGING')
    assert.equal(creation?.actionPlan, undefined)
    assert.equal(creation?.pendingDecisions, undefined)
    assert.equal(term?.facts?.anagathicsDecision, undefined)
  })

  it('keeps roll-dependent creation history visible after reveal', () => {
    const state = buildState()
    addDiceRoll(state, pastRevealAt)
    state.characters[asCharacterId('char-1')] = {
      id: asCharacterId('char-1'),
      ownerId: asUserId('player'),
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: 18,
      characteristics: {
        str: 7,
        dex: null,
        end: null,
        int: null,
        edu: null,
        soc: null
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
        terms: [],
        careers: [],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false,
        timeline: [
          {
            eventId: asEventId('game-1:4'),
            seq: 4,
            createdAt: '2026-05-03T00:00:02.000Z',
            eventType: 'CharacterCreationSurvivalResolved',
            rollEventId: asEventId('roll-1')
          }
        ],
        history: [
          {
            type: 'SURVIVAL_PASSED',
            canCommission: false,
            canAdvance: false,
            survival: {
              expression: '2d6',
              rolls: [3, 4],
              total: 7,
              characteristic: 'end',
              modifier: 0,
              target: 7,
              success: true
            }
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

    assert.deepEqual(
      filtered.characters[asCharacterId('char-1')]?.creation?.history,
      state.characters[asCharacterId('char-1')]?.creation?.history
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

  it('hides pre-reveal dice and roll-dependent activity details from owners and referees', () => {
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
      assert.equal('rolls' in diceActivity, false)
      assert.equal('total' in diceActivity, false)
      assert.equal(creationActivity?.type, 'characterCreation')
      if (creationActivity?.type !== 'characterCreation') return
      assert.equal('details' in creationActivity, false)
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
