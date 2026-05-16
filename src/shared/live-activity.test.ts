import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import type { EventEnvelope } from './events'
import { asCharacterId, asEventId, asGameId, asUserId } from './ids'
import {
  deriveCharacterCreationActivityRevealAt,
  deriveLiveActivities,
  deriveLiveActivity,
  deriveLiveActivityRevealAt,
  deriveLiveDiceRollRevealTarget,
  LIVE_DICE_RESULT_REVEAL_DELAY_MS,
  type LiveActivityDescriptor,
  MAX_LIVE_ACTIVITY_ROLLS,
  MAX_LIVE_ACTIVITY_TEXT_LENGTH
} from './live-activity'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')
const characterId = asCharacterId('char-1')

const envelope = (
  seq: number,
  event: EventEnvelope['event']
): EventEnvelope => ({
  version: 1,
  id: asEventId(`${gameId}:${seq}`),
  gameId,
  seq,
  actorId,
  createdAt: `2026-05-03T00:00:${String(seq).padStart(2, '0')}.000Z`,
  event
})

type LiveActivityDescriptorFixture = {
  readonly name: string
  readonly event: EventEnvelope['event']
  readonly activity: LiveActivityDescriptor
  readonly maxSerializedBytes: number
}

const loadFixture = <T>(name: string): T => {
  const file = path.join('src', 'shared', '__fixtures__', 'protocol', name)

  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

const serializedBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length

const liveActivityDescriptorFixtures = loadFixture<
  LiveActivityDescriptorFixture[]
>('live-activity-descriptors.json')

describe('live activity derivation', () => {
  for (const fixture of liveActivityDescriptorFixtures) {
    it(`matches protocol fixture: ${fixture.name}`, () => {
      const activity = deriveLiveActivity(
        envelope(fixture.activity.seq, fixture.event)
      )

      assert.deepEqual(activity, fixture.activity)
      assert.equal(
        serializedBytes(activity) <= fixture.maxSerializedBytes,
        true
      )
    })
  }

  it('derives viewer-safe dice roll activity with delayed reveal metadata', () => {
    const activity = deriveLiveActivity(
      envelope(2, {
        type: 'DiceRolled',
        expression: '2d6+1',
        reason: 'Vacc Suit check',
        rolls: [3, 5],
        total: 9
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:2'),
      eventId: asEventId('game-1:2'),
      gameId,
      seq: 2,
      actorId,
      createdAt: '2026-05-03T00:00:02.000Z',
      type: 'diceRoll',
      expression: '2d6+1',
      reason: 'Vacc Suit check',
      rolls: [3, 5],
      total: 9,
      reveal: {
        revealAt: '2026-05-03T00:00:04.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      }
    })
  })

  it('derives semantic mishap and death character creation activity', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCreationMishapResolved',
        characterId,
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(4, {
        type: 'CharacterCreationInjuryResolved',
        characterId,
        outcome: {
          career: 'Scout',
          roll: 2,
          id: 'severely_injured',
          description:
            'Severely injured. Reduce one physical characteristic by 1D6.',
          crisisRisk: true
        },
        selectedLosses: [{ characteristic: 'str', modifier: -4 }],
        characteristicPatch: { str: 3 },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCreationDeathConfirmed',
        characterId,
        state: {
          status: 'DECEASED',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details, activity.status]
          : null
      ),
      [
        ['MISHAP_RESOLVED', 'Mishap resolved', 'MUSTERING_OUT'],
        [
          'INJURY_RESOLVED',
          'Severely injured. Reduce one physical characteristic by 1D6.; 1 characteristic change',
          'MUSTERING_OUT'
        ],
        ['DEATH_CONFIRMED', 'Death confirmed', 'DECEASED']
      ]
    )
  })

  it('derives the shared dice reveal target from tactical and creation roll activity', () => {
    const activities = [
      deriveLiveActivity(
        envelope(2, {
          type: 'DiceRolled',
          expression: '2d6',
          reason: 'Table roll',
          rolls: [3, 5],
          total: 8
        })
      ),
      deriveLiveActivity(
        envelope(3, {
          type: 'DiceRolled',
          expression: '2d6',
          reason: 'Scout survival',
          rolls: [4, 4],
          total: 8
        })
      )
    ]

    assert.deepEqual(
      activities.map((activity) => activity?.type),
      ['diceRoll', 'diceRoll']
    )
    assert.deepEqual(
      activities.map((activity) =>
        activity ? deriveLiveDiceRollRevealTarget(activity) : null
      ),
      [
        {
          id: 'game-1:2',
          revealAt: '2026-05-03T00:00:04.500Z',
          rolls: [3, 5],
          total: 8
        },
        {
          id: 'game-1:3',
          revealAt: '2026-05-03T00:00:05.500Z',
          rolls: [4, 4],
          total: 8
        }
      ]
    )
  })

  it('derives compact character creation transition activity', () => {
    const activity = deriveLiveActivity(
      envelope(3, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          drafted: false
        },
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:3'),
      eventId: asEventId('game-1:3'),
      gameId,
      seq: 3,
      actorId,
      createdAt: '2026-05-03T00:00:03.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SELECT_CAREER',
      details: 'Career selected; new career; qualified',
      reveal: {
        revealAt: '2026-05-03T00:00:05.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      },
      status: 'BASIC_TRAINING',
      creationComplete: false
    })
  })

  it('derives character creation reveal timing from explicit metadata when present', () => {
    const activity: LiveActivityDescriptor = {
      id: asEventId('game-1:3'),
      eventId: asEventId('game-1:3'),
      gameId,
      seq: 3,
      actorId,
      createdAt: '2026-05-03T00:00:00.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SURVIVAL_PASSED',
      details:
        'Survival passed; total 8; target 7+; DM 0; commission unavailable; advancement unavailable',
      reveal: {
        rollEventId: asEventId('game-1:2'),
        revealAt: '2026-05-03T00:00:04.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      },
      status: 'SKILLS_TRAINING',
      creationComplete: false
    }

    assert.equal(
      deriveCharacterCreationActivityRevealAt(activity),
      '2026-05-03T00:00:04.500Z'
    )
  })

  it('keeps character creation reveal timing compatible without explicit metadata', () => {
    const activity: LiveActivityDescriptor = {
      id: asEventId('game-1:3'),
      eventId: asEventId('game-1:3'),
      gameId,
      seq: 3,
      actorId,
      createdAt: '2026-05-03T00:00:03.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SURVIVAL_PASSED',
      details:
        'Survival passed; total 8; target 7+; DM 0; commission unavailable; advancement unavailable',
      status: 'SKILLS_TRAINING',
      creationComplete: false
    }

    assert.equal(
      deriveCharacterCreationActivityRevealAt(activity),
      '2026-05-03T00:00:05.500Z'
    )
  })

  it('derives direct characteristic completion activity', () => {
    const activity = deriveLiveActivity(
      envelope(3, {
        type: 'CharacterCreationCharacteristicsCompleted',
        characterId,
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:3'),
      eventId: asEventId('game-1:3'),
      gameId,
      seq: 3,
      actorId,
      createdAt: '2026-05-03T00:00:03.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SET_CHARACTERISTICS',
      details: 'Characteristics assigned',
      status: 'HOMEWORLD',
      creationComplete: false
    })
  })

  it('derives semantic characteristic roll activity with reveal metadata', () => {
    const activity = deriveLiveActivity(
      envelope(5, {
        type: 'CharacterCreationCharacteristicRolled',
        characterId,
        rollEventId: asEventId('game-1:4'),
        characteristic: 'soc',
        value: 9,
        characteristicsComplete: true,
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:5'),
      eventId: asEventId('game-1:5'),
      gameId,
      seq: 5,
      actorId,
      createdAt: '2026-05-03T00:00:05.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'CHARACTERISTIC_ROLLED',
      details: 'SOC characteristic 9',
      reveal: {
        rollEventId: asEventId('game-1:4'),
        revealAt: '2026-05-03T00:00:07.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      },
      status: 'HOMEWORLD',
      creationComplete: false
    })
  })

  it('derives semantic characteristic completion with reveal metadata', () => {
    const activity = deriveLiveActivity(
      envelope(6, {
        type: 'CharacterCreationCharacteristicsCompleted',
        characterId,
        rollEventId: asEventId('game-1:4'),
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:6'),
      eventId: asEventId('game-1:6'),
      gameId,
      seq: 6,
      actorId,
      createdAt: '2026-05-03T00:00:06.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SET_CHARACTERISTICS',
      details: 'Characteristics assigned',
      reveal: {
        rollEventId: asEventId('game-1:4'),
        revealAt: '2026-05-03T00:00:08.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      },
      status: 'HOMEWORLD',
      creationComplete: false
    })
  })

  it('derives compact semantic survival activity', () => {
    const activity = deriveLiveActivity(
      envelope(6, {
        type: 'CharacterCreationSurvivalResolved',
        characterId,
        rollEventId: asEventId('game-1:5'),
        passed: true,
        survival: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: 'end',
          modifier: 0,
          target: 7,
          success: true
        },
        canCommission: false,
        canAdvance: false,
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:6'),
      eventId: asEventId('game-1:6'),
      gameId,
      seq: 6,
      actorId,
      createdAt: '2026-05-03T00:00:06.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'SURVIVAL_PASSED',
      details:
        'Survival passed; total 8; target 7+; DM 0; commission unavailable; advancement unavailable',
      reveal: {
        rollEventId: asEventId('game-1:5'),
        revealAt: '2026-05-03T00:00:08.500Z',
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      },
      status: 'SKILLS_TRAINING',
      creationComplete: false
    })
  })

  it('derives compact semantic commission activity', () => {
    const activity = deriveLiveActivity(
      envelope(7, {
        type: 'CharacterCreationCommissionResolved',
        characterId,
        passed: true,
        commission: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: 'int',
          modifier: 0,
          target: 5,
          success: true
        },
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.deepEqual(activity, {
      id: asEventId('game-1:7'),
      eventId: asEventId('game-1:7'),
      gameId,
      seq: 7,
      actorId,
      createdAt: '2026-05-03T00:00:07.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'COMMISSION_PASSED',
      details: 'Commission earned; total 8; target 5+; DM 0',
      status: 'SKILLS_TRAINING',
      creationComplete: false
    })
  })

  it('derives skipped commission and advancement activity from semantic events', () => {
    const activities = deriveLiveActivities([
      envelope(8, {
        type: 'CharacterCreationCommissionSkipped',
        characterId,
        state: {
          status: 'ADVANCEMENT',
          context: {
            canCommission: false,
            canAdvance: true
          }
        },
        creationComplete: false
      }),
      envelope(9, {
        type: 'CharacterCreationAdvancementSkipped',
        characterId,
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details, activity.status]
          : null
      ),
      [
        ['SKIP_COMMISSION', 'Commission skipped', 'ADVANCEMENT'],
        ['SKIP_ADVANCEMENT', 'Advancement skipped', 'SKILLS_TRAINING']
      ]
    )
  })

  it('derives compact activity details for SRD character creation milestones', () => {
    const activities = deriveLiveActivities([
      envelope(1, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          drafted: true
        },
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(2, {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Draft',
        acceptedCareer: 'Navy',
        career: 'Navy',
        drafted: true
      }),
      envelope(3, {
        type: 'CharacterCreationBasicTrainingCompleted',
        characterId,
        trainingSkills: ['Vacc Suit-0'],
        state: {
          status: 'SURVIVAL',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(4, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SURVIVAL_FAILED'
        },
        state: {
          status: 'DECEASED',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SURVIVAL_PASSED',
          canCommission: true,
          canAdvance: true
        },
        state: {
          status: 'COMMISSION',
          context: {
            canCommission: true,
            canAdvance: true
          }
        },
        creationComplete: false
      }),
      envelope(6, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'COMPLETE_COMMISSION'
        },
        state: {
          status: 'ADVANCEMENT',
          context: {
            canCommission: true,
            canAdvance: true
          }
        },
        creationComplete: false
      }),
      envelope(7, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'COMPLETE_ADVANCEMENT'
        },
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: true,
            canAdvance: true
          }
        },
        creationComplete: false
      }),
      envelope(8, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'COMPLETE_AGING'
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(9, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'REENLIST'
        },
        state: {
          status: 'CAREER_SELECTION',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(10, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'FINISH_MUSTERING'
        },
        state: {
          status: 'ACTIVE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(11, {
        type: 'CharacterCreationFinalized',
        characterId,
        notes: '',
        age: 38,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Admin-1'],
        equipment: [],
        credits: 5000
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details]
          : null
      ),
      [
        [
          'SELECT_CAREER',
          'Career selected; new career; drafted after failed qualification'
        ],
        ['CAREER_TERM_STARTED', 'Term started; Draft -> Navy; drafted'],
        [
          'COMPLETE_BASIC_TRAINING',
          'Basic training complete; 1 skill; Vacc Suit-0'
        ],
        ['SURVIVAL_FAILED', 'Killed in service'],
        [
          'SURVIVAL_PASSED',
          'Survival passed; commission available; advancement available'
        ],
        ['COMPLETE_COMMISSION', 'Commission earned'],
        ['COMPLETE_ADVANCEMENT', 'Advancement earned'],
        ['COMPLETE_AGING', 'Aging resolved'],
        ['REENLIST', 'Reenlisted for another term'],
        ['FINISH_MUSTERING', 'Mustering out complete'],
        ['FINALIZED', 'Finalized character; age 38; 1 skill; 0 equipment items']
      ]
    )
  })

  it('derives homeworld and background skill activity details', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCreationHomeworldSet',
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: '9',
          tradeCodes: ['Ri', 'Cp']
        },
        backgroundSkills: ['Admin-0', 'Streetwise-0'],
        pendingCascadeSkills: ['Gun Combat']
      }),
      envelope(4, {
        type: 'CharacterCreationBackgroundSkillSelected',
        characterId,
        skill: 'Vacc Suit-0',
        backgroundSkills: ['Admin-0', 'Streetwise-0', 'Vacc Suit-0'],
        pendingCascadeSkills: ['Gun Combat']
      }),
      envelope(5, {
        type: 'CharacterCreationCascadeSkillResolved',
        characterId,
        cascadeSkill: 'Gun Combat',
        selection: 'Slug Rifle-0',
        backgroundSkills: [
          'Admin-0',
          'Streetwise-0',
          'Vacc Suit-0',
          'Slug Rifle-0'
        ],
        pendingCascadeSkills: []
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? {
              transition: activity.transition,
              details: activity.details,
              status: activity.status,
              creationComplete: activity.creationComplete
            }
          : null
      ),
      [
        {
          transition: 'HOMEWORLD_SET',
          details:
            'Homeworld: Regina; trade codes Ri, Cp; 2 background skills; 1 pending cascade',
          status: 'HOMEWORLD',
          creationComplete: false
        },
        {
          transition: 'BACKGROUND_SKILL_SELECTED',
          details:
            'Background skill: Vacc Suit-0; 3 background skills selected; 1 pending cascade',
          status: 'HOMEWORLD',
          creationComplete: false
        },
        {
          transition: 'CASCADE_SKILL_RESOLVED',
          details: 'Gun Combat: Slug Rifle-0; 0 pending cascades',
          status: 'HOMEWORLD',
          creationComplete: false
        }
      ]
    )
  })

  it('derives career term and roll outcome activity details', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Draft',
        acceptedCareer: 'Scout',
        career: 'Scout',
        drafted: true
      }),
      envelope(4, {
        type: 'CharacterCreationBasicTrainingCompleted',
        characterId,
        trainingSkills: ['Vacc Suit-0', 'Pilot-0'],
        state: {
          status: 'SURVIVAL',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SURVIVAL_PASSED',
          canCommission: true,
          canAdvance: false
        },
        state: {
          status: 'COMMISSION',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(6, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: { type: 'REENLIST_BLOCKED' },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(7, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: { type: 'FINISH_MUSTERING' },
        state: {
          status: 'ACTIVE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details, activity.status]
          : null
      ),
      [
        [
          'CAREER_TERM_STARTED',
          'Term started; Draft -> Scout; drafted',
          'CAREER_SELECTION'
        ],
        [
          'COMPLETE_BASIC_TRAINING',
          'Basic training complete; 2 skills; Vacc Suit-0, Pilot-0',
          'SURVIVAL'
        ],
        [
          'SURVIVAL_PASSED',
          'Survival passed; commission available; advancement unavailable',
          'COMMISSION'
        ],
        ['REENLIST_BLOCKED', 'Reenlistment blocked', 'MUSTERING_OUT'],
        ['FINISH_MUSTERING', 'Mustering out complete', 'ACTIVE']
      ]
    )
  })

  it('derives compact qualification, draft, and Drifter activity details', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCreationQualificationResolved',
        characterId,
        career: 'Scout',
        passed: false,
        qualification: {
          expression: '2d6',
          rolls: [1, 2],
          total: 3,
          characteristic: 'int',
          modifier: 0,
          target: 5,
          success: false
        },
        previousCareerCount: 1,
        failedQualificationOptions: ['Drifter', 'Draft'],
        state: {
          status: 'CAREER_SELECTION',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(4, {
        type: 'CharacterCreationDraftResolved',
        characterId,
        draft: {
          roll: {
            expression: '1d6',
            rolls: [4],
            total: 4
          },
          tableRoll: 4,
          acceptedCareer: 'Merchant'
        },
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCreationDrifterEntered',
        characterId,
        acceptedCareer: 'Drifter',
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(activities, [
      {
        id: asEventId('game-1:3'),
        eventId: asEventId('game-1:3'),
        gameId,
        seq: 3,
        actorId,
        createdAt: '2026-05-03T00:00:03.000Z',
        type: 'characterCreation',
        characterId,
        transition: 'CAREER_QUALIFICATION_FAILED',
        details: 'Scout; qualification 3; failed; fallback Drifter or Draft',
        status: 'CAREER_SELECTION',
        creationComplete: false
      },
      {
        id: asEventId('game-1:4'),
        eventId: asEventId('game-1:4'),
        gameId,
        seq: 4,
        actorId,
        createdAt: '2026-05-03T00:00:04.000Z',
        type: 'characterCreation',
        characterId,
        transition: 'DRAFT_RESOLVED',
        details: 'Draft 4; Merchant',
        status: 'BASIC_TRAINING',
        creationComplete: false
      },
      {
        id: asEventId('game-1:5'),
        eventId: asEventId('game-1:5'),
        gameId,
        seq: 5,
        actorId,
        createdAt: '2026-05-03T00:00:05.000Z',
        type: 'characterCreation',
        characterId,
        transition: 'DRIFTER_ENTERED',
        details: 'Entered Drifter',
        status: 'BASIC_TRAINING',
        creationComplete: false
      }
    ])

    const payload = JSON.stringify(activities)
    assert.equal(payload.includes('previousCareerCount'), false)
    assert.equal(payload.includes('rolls'), false)
    assert.equal(payload.includes('expression'), false)
    assert.equal(payload.includes('target'), false)
    assert.equal(payload.includes('context'), false)
    assert.equal(payload.includes('canCommission'), false)
    assert.equal(payload.includes('canAdvance'), false)
    for (const activity of activities) {
      assert.deepEqual(Object.keys(activity).sort(), [
        'actorId',
        'characterId',
        'createdAt',
        'creationComplete',
        'details',
        'eventId',
        'gameId',
        'id',
        'seq',
        'status',
        'transition',
        'type'
      ])
    }
  })

  it('derives failed qualification, anagathics, and mustering benefit details', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SELECT_CAREER',
          isNewCareer: true,
          qualification: {
            expression: '2d6',
            rolls: [1, 2],
            total: 3,
            characteristic: 'edu',
            modifier: 0,
            target: 6,
            success: false
          },
          failedQualificationOptions: ['Drifter', 'Draft']
        },
        state: {
          status: 'CAREER_SELECTION',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(4, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'COMPLETE_AGING',
          aging: {
            roll: {
              expression: '2d6',
              rolls: [2, 3],
              total: 5
            },
            modifier: -1,
            age: 34,
            characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
          }
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCreationAgingResolved',
        characterId,
        aging: {
          roll: {
            expression: '2d6',
            rolls: [1, 1],
            total: 2
          },
          modifier: -3,
          age: 38,
          characteristicChanges: [
            { type: 'PHYSICAL', modifier: -1 },
            { type: 'PHYSICAL', modifier: -1 }
          ]
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(6, {
        type: 'CharacterCreationReenlistmentResolved',
        characterId,
        outcome: 'allowed',
        reenlistment: {
          expression: '2d6',
          rolls: [3, 4],
          total: 7,
          characteristic: null,
          modifier: 0,
          target: 6,
          success: true,
          outcome: 'allowed'
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(7, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'FINISH_MUSTERING',
          musteringBenefit: {
            career: 'Merchant',
            kind: 'cash',
            roll: {
              expression: '2d6',
              rolls: [3, 1],
              total: 4
            },
            modifier: 0,
            tableRoll: 4,
            value: '20000',
            credits: 20000
          }
        },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details, activity.status]
          : null
      ),
      [
        [
          'SELECT_CAREER',
          'Career selected; new career; qualification failed; fallback Drifter or Draft',
          'CAREER_SELECTION'
        ],
        [
          'COMPLETE_AGING',
          'Aging resolved; age 34; aging/anagathics modifier -1; 1 characteristic change',
          'REENLISTMENT'
        ],
        [
          'COMPLETE_AGING',
          'Aging resolved; age 38; aging/anagathics modifier -3; 2 characteristic changes',
          'REENLISTMENT'
        ],
        [
          'REENLIST_ALLOWED',
          'Reenlistment allowed; total 7; target 6+; DM 0',
          'REENLISTMENT'
        ],
        [
          'FINISH_MUSTERING',
          'Mustering benefit; Merchant; cash; Cr20000; table roll 4',
          'MUSTERING_OUT'
        ]
      ]
    )
  })

  it('derives semantic mustering benefit and completion details', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCreationMusteringBenefitRolled',
        characterId,
        musteringBenefit: {
          career: 'Scout',
          kind: 'material',
          roll: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8
          },
          modifier: 0,
          tableRoll: 8,
          value: '-',
          credits: 0,
          materialItem: null
        },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(4, {
        type: 'CharacterCreationMusteringCompleted',
        characterId,
        state: {
          status: 'ACTIVE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details, activity.status]
          : null
      ),
      [
        [
          'FINISH_MUSTERING',
          'Mustering benefit; Scout; material; -; table roll 8',
          'MUSTERING_OUT'
        ],
        ['FINISH_MUSTERING', 'Mustering out complete', 'ACTIVE']
      ]
    )
  })

  it('derives semantic aging-loss and skills-completion activity details', () => {
    const activities = deriveLiveActivities([
      envelope(3, {
        type: 'CharacterCreationAgingLossesResolved',
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', characteristic: 'str', modifier: -1 },
          { type: 'PHYSICAL', characteristic: 'dex', modifier: -1 }
        ],
        characteristicPatch: {
          str: 6,
          dex: 7
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(4, {
        type: 'CharacterCreationSkillsCompleted',
        characterId,
        state: {
          status: 'AGING',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    assert.deepEqual(
      activities.map((activity) =>
        activity.type === 'characterCreation'
          ? [activity.transition, activity.details, activity.status]
          : null
      ),
      [
        [
          'AGING_LOSSES_RESOLVED',
          'Aging losses applied; 2 selections',
          'REENLISTMENT'
        ],
        ['COMPLETE_SKILLS', 'Skills and training complete', 'AGING']
      ]
    )
  })

  it('attaches delayed reveal metadata to semantic character roll activity', () => {
    const state = {
      status: 'SKILLS_TRAINING' as const,
      context: {
        canCommission: true,
        canAdvance: true
      }
    }
    const check = {
      expression: '2d6' as const,
      rolls: [4, 4],
      total: 8,
      characteristic: 'int' as const,
      modifier: 1,
      target: 7,
      success: true
    }
    const cases: EventEnvelope['event'][] = [
      {
        type: 'CharacterCreationQualificationResolved',
        characterId,
        rollEventId: asEventId('game-1:1'),
        career: 'Scout',
        passed: true,
        qualification: check,
        previousCareerCount: 0,
        failedQualificationOptions: [],
        state,
        creationComplete: false
      },
      {
        type: 'CharacterCreationDraftResolved',
        characterId,
        rollEventId: asEventId('game-1:2'),
        draft: {
          roll: {
            expression: '1d6',
            rolls: [4],
            total: 4
          },
          tableRoll: 4,
          acceptedCareer: 'Merchant'
        },
        state,
        creationComplete: false
      },
      {
        type: 'CharacterCreationCommissionResolved',
        characterId,
        rollEventId: asEventId('game-1:3'),
        passed: true,
        commission: check,
        state,
        creationComplete: false
      },
      {
        type: 'CharacterCreationAdvancementResolved',
        characterId,
        rollEventId: asEventId('game-1:4'),
        passed: true,
        advancement: check,
        rank: null,
        state,
        creationComplete: false
      },
      {
        type: 'CharacterCreationAgingResolved',
        characterId,
        rollEventId: asEventId('game-1:5'),
        aging: {
          roll: {
            expression: '2d6',
            rolls: [3, 4],
            total: 7
          },
          modifier: -1,
          age: 34,
          characteristicChanges: []
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      },
      {
        type: 'CharacterCreationReenlistmentResolved',
        characterId,
        rollEventId: asEventId('game-1:6'),
        outcome: 'allowed',
        reenlistment: {
          expression: '2d6',
          rolls: [3, 4],
          total: 7,
          characteristic: null,
          modifier: 0,
          target: 6,
          success: true,
          outcome: 'allowed'
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      },
      {
        type: 'CharacterCreationTermSkillRolled',
        characterId,
        rollEventId: asEventId('game-1:7'),
        termSkill: {
          career: 'Merchant',
          table: 'serviceSkills',
          roll: {
            expression: '1d6',
            rolls: [1],
            total: 1
          },
          tableRoll: 1,
          rawSkill: 'Broker',
          skill: 'Broker-1',
          characteristic: null,
          pendingCascadeSkill: null
        },
        termSkills: ['Broker-1'],
        skillsAndTraining: ['Broker-0', 'Broker-1'],
        pendingCascadeSkills: [],
        state,
        creationComplete: false
      },
      {
        type: 'CharacterCreationMusteringBenefitRolled',
        characterId,
        rollEventId: asEventId('game-1:8'),
        musteringBenefit: {
          career: 'Merchant',
          kind: 'cash',
          roll: {
            expression: '1d6',
            rolls: [4],
            total: 4
          },
          modifier: 0,
          tableRoll: 4,
          value: '20000',
          credits: 20000
        },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      },
      {
        type: 'CharacterCreationAnagathicsDecided',
        characterId,
        rollEventId: asEventId('game-1:9'),
        useAnagathics: true,
        termIndex: 0,
        passed: true,
        survival: {
          expression: '2d6',
          rolls: [4, 5],
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
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      },
      {
        type: 'CharacterCreationMishapResolved',
        characterId,
        rollEventId: asEventId('game-1:10'),
        mishap: {
          roll: {
            expression: '1d6',
            rolls: [3],
            total: 3
          },
          outcome: {
            career: 'Merchant',
            roll: 3,
            id: 'legal_battle_debt',
            description: 'Legal battle; Cr10000 debt.',
            discharge: 'honorable',
            benefitEffect: 'forfeit_current_term',
            debtCredits: 10000,
            extraServiceYears: 0,
            injury: null
          }
        },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      },
      {
        type: 'CharacterCreationInjuryResolved',
        characterId,
        rollEventId: asEventId('game-1:11'),
        severityRoll: {
          expression: '1d6',
          rolls: [4],
          total: 4
        },
        outcome: {
          career: 'Scout',
          roll: 2,
          id: 'severely_injured',
          description:
            'Severely injured. Reduce one physical characteristic by 1D6.',
          crisisRisk: true
        },
        selectedLosses: [{ characteristic: 'str', modifier: -4 }],
        characteristicPatch: { str: 3 },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ]

    for (const [index, event] of cases.entries()) {
      const activity = deriveLiveActivity(envelope(index + 2, event))

      assert.equal(activity?.type, 'characterCreation')
      if (activity?.type !== 'characterCreation') continue
      assert.deepEqual(activity.reveal, {
        rollEventId: asEventId(`game-1:${index + 1}`),
        revealAt: deriveLiveActivityRevealAt(activity.createdAt),
        delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
      })
    }
  })

  it('derives finalization summary without full sheet details', () => {
    const activity = deriveLiveActivity(
      envelope(3, {
        type: 'CharacterCreationFinalized',
        characterId,
        notes: 'Private notes stay off the activity payload.',
        age: 34,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Pilot-1', 'Vacc Suit-0'],
        equipment: [{ name: 'Vacc suit', quantity: 1, notes: 'Carried' }],
        credits: 1200
      })
    )

    assert.equal(activity?.type, 'characterCreation')
    if (activity?.type !== 'characterCreation') return
    assert.deepEqual(activity, {
      id: asEventId('game-1:3'),
      eventId: asEventId('game-1:3'),
      gameId,
      seq: 3,
      actorId,
      createdAt: '2026-05-03T00:00:03.000Z',
      type: 'characterCreation',
      characterId,
      transition: 'FINALIZED',
      details: 'Finalized character; age 34; 2 skills; 1 equipment item',
      status: 'PLAYABLE',
      creationComplete: true
    })
    assert.equal(JSON.stringify(activity).includes('Private notes'), false)
    assert.equal(JSON.stringify(activity).includes('Pilot-1'), false)
    assert.equal(JSON.stringify(activity).includes('str'), false)
    assert.equal(JSON.stringify(activity).includes('1200'), false)
  })

  it('filters unrelated events from derived live activities', () => {
    const activities = deriveLiveActivities([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
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
          history: []
        }
      })
    ])

    assert.equal(activities.length, 1)
    assert.equal(activities[0]?.type, 'characterCreation')
    assert.equal(activities[0]?.seq, 2)
  })

  it('bounds oversized dice roll activity payloads', () => {
    const longExpression = '2d6+'.repeat(40)
    const longReason = 'A very long dice roll reason. '.repeat(20)
    const rolls = Array.from(
      { length: MAX_LIVE_ACTIVITY_ROLLS + 5 },
      (_, i) => (i % 6) + 1
    )

    const activity = deriveLiveActivity(
      envelope(4, {
        type: 'DiceRolled',
        expression: longExpression,
        reason: longReason,
        rolls,
        total: rolls.reduce((sum, roll) => sum + roll, 0)
      })
    )

    assert.equal(activity?.type, 'diceRoll')
    if (activity?.type !== 'diceRoll') return
    assert.equal(activity.expression.length, MAX_LIVE_ACTIVITY_TEXT_LENGTH)
    assert.equal(activity.reason.length, MAX_LIVE_ACTIVITY_TEXT_LENGTH)
    assert.equal(activity.rolls.length, MAX_LIVE_ACTIVITY_ROLLS)
    assert.equal(activity.rollsOmitted, 5)
    assert.equal(serializedBytes(activity) < 700, true)
  })

  it('does not leak full creation event state into character activity', () => {
    const activity = deriveLiveActivity(
      envelope(5, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: {
          type: 'SURVIVAL_PASSED',
          canCommission: true,
          canAdvance: false
        },
        state: {
          status: 'ADVANCEMENT',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    )

    assert.equal(activity?.type, 'characterCreation')
    assert.deepEqual(Object.keys(activity ?? {}).sort(), [
      'actorId',
      'characterId',
      'createdAt',
      'creationComplete',
      'details',
      'eventId',
      'gameId',
      'id',
      'reveal',
      'seq',
      'status',
      'transition',
      'type'
    ])
  })
})
