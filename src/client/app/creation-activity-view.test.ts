import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asEventId, asGameId, asUserId } from '../../shared/ids'
import type {
  CharacterCreationActivityDescriptor,
  DiceRollActivityDescriptor,
  LiveActivityDescriptor
} from '../../shared/live-activity'
import {
  deriveCreationActivityCard,
  deriveCreationActivityCards,
  MAX_CREATION_ACTIVITY_DETAIL_LENGTH,
  MAX_CREATION_ACTIVITY_TITLE_LENGTH
} from './creation-activity-view'

const baseActivity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('player-1'),
  createdAt: '2026-05-06T10:00:00.000Z'
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
  it('derives cards only for character creation activities', () => {
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
        details: 'Started Scout term',
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
        detail: 'Started Scout term',
        tone: 'neutral',
        seq: 13
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

  it('derives warning tone for mishaps and blocking outcomes', () => {
    assert.deepEqual(
      deriveCreationActivityCard(
        characterActivity({
          seq: 30,
          transition: 'SURVIVAL_FAILED',
          details: 'Survival failed',
          status: 'MISHAP'
        })
      ),
      {
        title: 'Survival failed',
        detail: 'Survival failed',
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
