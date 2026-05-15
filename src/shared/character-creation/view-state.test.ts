import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asEventId, asUserId } from '../ids'
import type { CharacterCreationProjection, CharacterState } from '../state'
import { createCareerCreationState } from './state-machine'
import { deriveCareerCreationActionPlan } from './legal-actions'
import {
  deriveCharacterCreationProjectionReadModel,
  deriveCharacterCreationReadModel
} from './view-state'

const creationContext = {
  canCommission: false,
  canAdvance: false
}

const projection = (
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: createCareerCreationState('HOMEWORLD', creationContext),
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  history: [],
  ...overrides
})

const character = (
  creation: CharacterCreationProjection | null
): CharacterState => ({
  id: asCharacterId('traveller-1'),
  ownerId: asUserId('owner-1'),
  type: 'PLAYER',
  name: 'Iona Vesh',
  active: true,
  notes: '',
  age: 22,
  characteristics: {
    str: 7,
    dex: null,
    end: 8,
    int: null,
    edu: 9,
    soc: null
  },
  skills: ['Admin-0'],
  equipment: [{ name: 'Blade', quantity: 1, notes: 'Issued' }],
  credits: 1000,
  creation
})

describe('character creation shared view state', () => {
  it('derives canonical projection state, pending decisions, and legal actions', () => {
    const projected = projection({
      backgroundSkills: ['Admin-0'],
      backgroundSkillAllowance: 2,
      timeline: [
        {
          eventId: asEventId('event-1'),
          seq: 1,
          createdAt: '2026-05-14T10:00:00.000Z',
          eventType: 'CharacterCreationHomeworldSet'
        }
      ],
      history: [{ type: 'SET_CHARACTERISTICS' }]
    })
    const readModel = deriveCharacterCreationProjectionReadModel(projected)

    assert.equal(readModel.status, 'HOMEWORLD')
    assert.equal(readModel.statusLabel, 'Homeworld')
    assert.equal(readModel.step, 'homeworld')
    assert.equal(readModel.isActive, true)
    assert.equal(readModel.creationComplete, false)
    assert.equal(readModel.historyCount, 1)
    assert.equal(readModel.timelineCount, 1)
    assert.deepEqual(readModel.timeline, [
      {
        eventId: asEventId('event-1'),
        seq: 1,
        createdAt: '2026-05-14T10:00:00.000Z',
        eventType: 'CharacterCreationHomeworldSet'
      }
    ])
    assert.deepEqual(readModel.pendingDecisions, [
      { key: 'homeworldSkillSelection' }
    ])
    assert.deepEqual(
      readModel.actionPlan.legalActions.map((action) => action.key),
      []
    )
    assert.deepEqual(
      readModel.actionPlan,
      deriveCareerCreationActionPlan(projected)
    )
  })

  it('uses a materialized projection action plan when one is present', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        actionPlan: {
          status: 'HOMEWORLD',
          pendingDecisions: [],
          legalActions: [
            {
              key: 'completeHomeworld',
              status: 'HOMEWORLD',
              commandTypes: ['CompleteCharacterCreationHomeworld']
            }
          ]
        }
      })
    )

    assert.deepEqual(
      readModel.actionPlan.legalActions.map((action) => action.key),
      ['completeHomeworld']
    )
  })

  it('derives cascade choices through the projection read model', () => {
    const readModel = deriveCharacterCreationProjectionReadModel(
      projection({
        pendingCascadeSkills: ['Gun Combat-0']
      })
    )

    assert.deepEqual(readModel.actionPlan.cascadeSkillChoices, [
      {
        cascadeSkill: 'Gun Combat-0',
        label: 'Gun Combat',
        level: 0,
        options: [
          { value: 'Archery-0', label: 'Archery', cascade: false },
          { value: 'Energy Pistol-0', label: 'Energy Pistol', cascade: false },
          { value: 'Energy Rifle-0', label: 'Energy Rifle', cascade: false },
          { value: 'Shotgun-0', label: 'Shotgun', cascade: false },
          { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false },
          { value: 'Slug Rifle-0', label: 'Slug Rifle', cascade: false }
        ]
      }
    ])
  })

  it('derives sheet preview and progress counters from a character', () => {
    const readModel = deriveCharacterCreationReadModel(
      character(
        projection({
          state: createCareerCreationState('SKILLS_TRAINING', creationContext),
          terms: [
            {
              career: 'Scout',
              skills: ['Pilot-1'],
              skillsAndTraining: ['Pilot-1'],
              benefits: [],
              complete: false,
              canReenlist: false,
              completedBasicTraining: true,
              musteringOut: false,
              anagathics: false,
              survival: 8
            }
          ]
        })
      )
    )

    if (!readModel) throw new Error('Expected character creation read model')

    assert.equal(readModel.characterId, asCharacterId('traveller-1'))
    assert.equal(readModel.name, 'Iona Vesh')
    assert.equal(readModel.ownerId, asUserId('owner-1'))
    assert.equal(readModel.rolledCharacteristicCount, 3)
    assert.equal(readModel.termCount, 1)
    assert.equal(readModel.activeTerm?.career, 'Scout')
    assert.deepEqual(readModel.sheet, {
      age: 22,
      characteristics: {
        str: 7,
        dex: null,
        end: 8,
        int: null,
        edu: 9,
        soc: null
      },
      skills: ['Admin-0'],
      equipment: [{ name: 'Blade', quantity: 1, notes: 'Issued' }],
      credits: 1000
    })
  })
})
