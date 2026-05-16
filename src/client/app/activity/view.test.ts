import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asUserId
} from '../../../shared/ids'
import type {
  CharacterCreationActivityDescriptor,
  DiceRollActivityDescriptor,
  LiveActivityDescriptor
} from '../../../shared/live-activity'
import type { GameState } from '../../../shared/state'
import { applyServerMessage } from '../../game-commands'
import {
  deriveCreationActivityCard,
  deriveCreationActivityCards,
  deriveCreationActivityCardsFromApplication,
  MAX_CREATION_ACTIVITY_DETAIL_LENGTH,
  MAX_CREATION_ACTIVITY_TITLE_LENGTH,
  SRD_CREATION_ACTIVITY_MILESTONE_TRANSITIONS
} from './view'

const baseActivity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('player-1'),
  createdAt: '2026-05-06T10:00:00.000Z'
}

const acceptedState: GameState = {
  id: asGameId('game-1'),
  slug: 'game-1',
  name: 'Game 1',
  ownerId: asUserId('player-1'),
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: asBoardId('main-board'),
  eventSeq: 51
}

const characterActivity = (
  overrides: Partial<CharacterCreationActivityDescriptor> = {}
): CharacterCreationActivityDescriptor => ({
  ...baseActivity,
  id: asEventId(`game-1:${overrides.seq ?? 1}`),
  eventId: asEventId(`game-1:${overrides.seq ?? 1}`),
  seq: 1,
  type: 'characterCreation',
  characterId: asCharacterId('character-1'),
  transition: 'STARTED',
  details: 'Started character creation',
  status: 'CHARACTERISTICS',
  creationComplete: false,
  ...overrides
})

const diceActivity = (
  overrides: Partial<DiceRollActivityDescriptor> = {}
): DiceRollActivityDescriptor => ({
  ...baseActivity,
  id: asEventId(`game-1:${overrides.seq ?? 2}`),
  eventId: asEventId(`game-1:${overrides.seq ?? 2}`),
  seq: 2,
  type: 'diceRoll',
  expression: '2d6',
  reason: 'Career survival',
  rolls: [3, 4],
  total: 7,
  reveal: {
    revealAt: '2026-05-06T10:00:02.500Z',
    delayMs: 2500
  },
  ...overrides
})

describe('creation activity view model', () => {
  it('derives cards for semantic character creation milestones', () => {
    const activities: readonly LiveActivityDescriptor[] = [
      diceActivity({ seq: 10 }),
      characterActivity({
        seq: 11,
        transition: 'HOMEWORLD_SET',
        details: 'Homeworld: Regina; trade codes Hi; 3 background skills',
        status: 'HOMEWORLD'
      }),
      diceActivity({ seq: 12 }),
      characterActivity({
        seq: 13,
        transition: 'CAREER_TERM_STARTED',
        details: 'Term started; Scout',
        status: 'CAREER_SELECTION'
      })
    ]

    assert.deepEqual(deriveCreationActivityCards(activities), [
      {
        title: 'Homeworld selected',
        detail: 'Homeworld: Regina; trade codes Hi; 3 background skills',
        tone: 'neutral',
        seq: 11
      },
      {
        title: 'Career term started',
        detail: 'Term started; Scout',
        tone: 'neutral',
        seq: 13
      }
    ])
  })

  it('derives follower setup cards from semantic creation facts', () => {
    const activities: readonly LiveActivityDescriptor[] = [
      characterActivity({
        seq: 20,
        transition: 'SET_CHARACTERISTICS',
        details: 'Characteristics assigned',
        status: 'HOMEWORLD'
      }),
      characterActivity({
        seq: 21,
        transition: 'BACKGROUND_SKILL_SELECTED',
        details: 'Background skill selected',
        status: 'HOMEWORLD'
      })
    ]

    assert.deepEqual(deriveCreationActivityCards(activities), [
      {
        title: 'Characteristics assigned',
        detail: 'Characteristics assigned',
        tone: 'neutral',
        seq: 20
      },
      {
        title: 'Background skill selected',
        detail: 'Background skill selected',
        tone: 'neutral',
        seq: 21
      }
    ])
  })

  it('does not derive transient cards from redacted pre-reveal activity', () => {
    const activities: readonly LiveActivityDescriptor[] = [
      characterActivity({
        seq: 22,
        transition: 'PENDING_REVEAL',
        details: undefined,
        status: 'ACTIVE',
        creationComplete: false
      })
    ]

    assert.deepEqual(deriveCreationActivityCards(activities), [])
  })

  it('labels semantic characteristic completion as assigned characteristics', () => {
    assert.deepEqual(
      deriveCreationActivityCard(
        characterActivity({
          seq: 22,
          transition: 'CharacterCreationCharacteristicsCompleted',
          details: 'Characteristics assigned',
          status: 'HOMEWORLD'
        })
      ),
      {
        title: 'Characteristics assigned',
        detail: 'Characteristics assigned',
        tone: 'neutral',
        seq: 22
      }
    )
  })

  it('suppresses cards authored by the current viewer actor', () => {
    const activities: readonly LiveActivityDescriptor[] = [
      characterActivity({
        seq: 30,
        actorId: asUserId('local-user'),
        transition: 'SET_CHARACTERISTICS',
        details: 'Characteristics assigned',
        status: 'HOMEWORLD'
      }),
      characterActivity({
        seq: 31,
        actorId: asUserId('spectated-user'),
        transition: 'SURVIVAL_PASSED',
        details: 'Survival passed',
        status: 'COMMISSION'
      })
    ]

    assert.deepEqual(
      deriveCreationActivityCards(activities, { viewerActorId: 'local-user' }),
      [
        {
          title: 'Survival passed',
          detail: 'Survival passed',
          tone: 'success',
          seq: 31
        }
      ]
    )
  })

  it('derives spectator cards for survival death and mustering benefit outcomes', () => {
    const activities: readonly LiveActivityDescriptor[] = [
      characterActivity({
        seq: 40,
        actorId: asUserId('local-user'),
        transition: 'FINISH_MUSTERING',
        details: 'Mustering benefit; Scout; cash; Cr10000; table roll 3',
        status: 'MUSTERING_OUT'
      }),
      characterActivity({
        seq: 41,
        actorId: asUserId('spectated-user'),
        transition: 'SURVIVAL_FAILED',
        details: 'Killed in service; total 3; target 7+; DM 0',
        status: 'DECEASED'
      }),
      characterActivity({
        seq: 42,
        actorId: asUserId('spectated-user'),
        transition: 'FINISH_MUSTERING',
        details: 'Mustering benefit; Merchant; cash; Cr20000; table roll 4',
        status: 'MUSTERING_OUT'
      }),
      characterActivity({
        seq: 43,
        actorId: asUserId('spectated-user'),
        transition: 'FINISH_MUSTERING',
        details:
          'Mustering benefit; Scout; material; Low Passage; table roll 5',
        status: 'MUSTERING_OUT'
      }),
      characterActivity({
        seq: 44,
        actorId: asUserId('spectated-user'),
        transition: 'FINISH_MUSTERING',
        details: 'Mustering out complete',
        status: 'ACTIVE'
      })
    ]

    assert.deepEqual(
      deriveCreationActivityCards(activities, { viewerActorId: 'local-user' }),
      [
        {
          title: 'Killed in service',
          detail: 'Killed in service; total 3; target 7+; DM 0',
          tone: 'warning',
          seq: 41
        },
        {
          title: 'Mustering benefit',
          detail: 'Mustering benefit; Merchant; cash; Cr20000; table roll 4',
          tone: 'success',
          seq: 42
        },
        {
          title: 'Mustering benefit',
          detail:
            'Mustering benefit; Scout; material; Low Passage; table roll 5',
          tone: 'success',
          seq: 43
        },
        {
          title: 'Mustering complete',
          detail: 'Mustering out complete',
          tone: 'success',
          seq: 44
        }
      ]
    )
  })

  it('derives transient cards from accepted command live activities', () => {
    const creation = characterActivity({
      seq: 50,
      transition: 'COMPLETE_BASIC_TRAINING',
      details: 'Basic training complete',
      status: 'SKILLS_TRAINING'
    })
    const dice = diceActivity({ seq: 51, total: 9, rolls: [4, 5] })
    const application = applyServerMessage(null, {
      type: 'commandAccepted',
      requestId: 'req-creation-activity',
      state: acceptedState,
      eventSeq: 51,
      liveActivities: [creation, dice]
    })

    assert.deepEqual(deriveCreationActivityCardsFromApplication(application), [
      {
        title: 'Basic training complete',
        detail: 'Basic training complete',
        tone: 'success',
        seq: 50
      }
    ])
    assert.deepEqual(application.diceRollActivities, [
      {
        id: 'game-1:51',
        revealAt: '2026-05-06T10:00:02.500Z',
        rolls: [4, 5],
        total: 9
      }
    ])
  })

  it('derives success tone for completed and positive milestones', () => {
    assert.equal(
      deriveCreationActivityCard(
        characterActivity({
          transition: 'SURVIVAL_PASSED',
          details: 'Survival passed',
          status: 'COMMISSION'
        })
      ).tone,
      'success'
    )

    assert.deepEqual(
      deriveCreationActivityCard(
        characterActivity({
          seq: 20,
          transition: 'FINALIZED',
          details: 'Finalized character; age 34; 8 skills',
          status: 'PLAYABLE',
          creationComplete: true
        })
      ),
      {
        title: 'Character finalized',
        detail: 'Finalized character; age 34; 8 skills',
        tone: 'success',
        seq: 20
      }
    )
  })

  it('has compact cards for SRD character creation milestones', () => {
    const cards = SRD_CREATION_ACTIVITY_MILESTONE_TRANSITIONS.map(
      (transition, index) =>
        deriveCreationActivityCard(
          characterActivity({
            seq: 100 + index,
            transition,
            details: `${transition} detail`,
            status: transition === 'FINALIZED' ? 'PLAYABLE' : 'ACTIVE',
            creationComplete: transition === 'FINALIZED'
          })
        )
    )

    assert.deepEqual(
      cards.map((card) => card.title),
      [
        'Characteristics assigned',
        'Homeworld selected',
        'Homeworld complete',
        'Background skill selected',
        'Cascade skill resolved',
        'Career selected',
        'Qualification passed',
        'Qualification failed',
        'Draft resolved',
        'Entered Drifter',
        'Career term started',
        'Basic training complete',
        'Survival passed',
        'Killed in service',
        'Mishap resolved',
        'Injury resolved',
        'Commission earned',
        'Commission missed',
        'Commission earned',
        'Commission skipped',
        'Advancement earned',
        'Advancement missed',
        'Advancement earned',
        'Advancement skipped',
        'Aging resolved',
        'Aging losses resolved',
        'Anagathics decided',
        'Term skill gained',
        'Term cascade resolved',
        'Skills complete',
        'Reenlistment allowed',
        'Reenlistment forced',
        'Reenlisted',
        'Left career',
        'Reenlistment blocked',
        'Forced reenlistment',
        'Career continued',
        'Mustering complete',
        'Creation complete',
        'Character finalized'
      ]
    )
    assert.deepEqual(
      cards.map((card) => card.tone),
      [
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'success',
        'warning',
        'success',
        'success',
        'neutral',
        'success',
        'success',
        'warning',
        'warning',
        'warning',
        'success',
        'warning',
        'success',
        'neutral',
        'success',
        'warning',
        'success',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'neutral',
        'warning',
        'neutral',
        'neutral',
        'warning',
        'warning',
        'neutral',
        'success',
        'success',
        'success'
      ]
    )
    assert.equal(
      cards.every(
        (card, index) =>
          card.detail ===
          `${SRD_CREATION_ACTIVITY_MILESTONE_TRANSITIONS[index]} detail`
      ),
      true
    )
  })

  it('derives warning tone for mishaps and blocking outcomes', () => {
    assert.deepEqual(
      deriveCreationActivityCard(
        characterActivity({
          seq: 30,
          transition: 'SURVIVAL_FAILED',
          details: 'Killed in service',
          status: 'DECEASED'
        })
      ),
      {
        title: 'Killed in service',
        detail: 'Killed in service',
        tone: 'warning',
        seq: 30
      }
    )

    assert.equal(
      deriveCreationActivityCard(
        characterActivity({
          transition: 'REENLIST_BLOCKED',
          details: 'Reenlistment blocked',
          status: 'REENLISTMENT'
        })
      ).tone,
      'warning'
    )
  })

  it('falls back cleanly for unknown transition labels', () => {
    assert.deepEqual(
      deriveCreationActivityCard(
        characterActivity({
          seq: 40,
          transition: 'CUSTOM_OWNER_EVENT',
          details: undefined,
          status: 'ACTIVE'
        })
      ),
      {
        title: 'Custom owner event',
        detail: 'Character creation updated',
        tone: 'neutral',
        seq: 40
      }
    )
  })

  it('bounds and compacts display text', () => {
    const card = deriveCreationActivityCard(
      characterActivity({
        transition: `CUSTOM_${'TITLE_'.repeat(20)}EVENT`,
        details: `Resolved   ${'long '.repeat(40)}detail`,
        status: 'ACTIVE'
      })
    )

    assert.equal(card.title.length, MAX_CREATION_ACTIVITY_TITLE_LENGTH)
    assert.equal(card.detail.length, MAX_CREATION_ACTIVITY_DETAIL_LENGTH)
    assert.equal(card.title.endsWith('...'), true)
    assert.equal(card.detail.endsWith('...'), true)
    assert.equal(card.detail.includes('  '), false)
  })
})
