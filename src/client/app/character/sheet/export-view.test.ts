import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import {
  deriveCharacterUpp,
  derivePlainCharacterExport,
  formatUppCharacteristic,
  isCharacterCreationFinal
} from './export-view'

const character = (
  overrides: Partial<CharacterState> = {}
): CharacterState => ({
  id: asCharacterId('traveller-1'),
  ownerId: null,
  type: 'PLAYER',
  name: 'Iona Vesh',
  active: true,
  notes: 'Detached scout.',
  age: 34,
  characteristics: {
    str: 7,
    dex: 8,
    end: 9,
    int: 10,
    edu: 11,
    soc: 6
  },
  skills: ['Pilot-1', 'Vacc Suit-0'],
  equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
  credits: 1200,
  creation: finalizedCreation(),
  ...overrides
})

const finalizedCreation = (): CharacterCreationProjection => ({
  state: {
    status: 'PLAYABLE',
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
      completedBasicTraining: false,
      musteringOut: false,
      anagathics: false
    }
  ],
  careers: [{ name: 'Scout', rank: 0 }],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: true
})

describe('character sheet export view', () => {
  it('formats UPP characteristics with Traveller-style extended digits', () => {
    assert.equal(formatUppCharacteristic(9), '9')
    assert.equal(formatUppCharacteristic(10), 'A')
    assert.equal(formatUppCharacteristic(15), 'F')
    assert.equal(formatUppCharacteristic(null), '?')
    assert.equal(formatUppCharacteristic(-1), '?')
    assert.equal(
      deriveCharacterUpp({
        str: 7,
        dex: 8,
        end: 9,
        int: 10,
        edu: 11,
        soc: null
      }),
      '789AB?'
    )
  })

  it('detects finalized creation from either complete flag or playable state', () => {
    assert.equal(isCharacterCreationFinal(character()), true)
    assert.equal(
      isCharacterCreationFinal(
        character({
          creation: {
            ...finalizedCreation(),
            creationComplete: false
          }
        })
      ),
      true
    )
    assert.equal(isCharacterCreationFinal(character({ creation: null })), false)
  })

  it('derives a plain text export block for finalized characters', () => {
    assert.equal(
      derivePlainCharacterExport(character()),
      [
        'Iona Vesh',
        'UPP: 789AB6',
        'Type: PLAYER',
        'Age: 34',
        'Career: Scout',
        'Terms: 1',
        'Skills: Pilot-1, Vacc Suit-0',
        'Credits: Cr1200',
        'Equipment: Vacc Suit x1 (Carried)',
        'Notes:',
        'Detached scout.'
      ].join('\n')
    )
  })

  it('omits export text before creation is finalized', () => {
    assert.equal(
      derivePlainCharacterExport(
        character({
          creation: {
            ...finalizedCreation(),
            state: {
              status: 'ACTIVE',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            creationComplete: false
          }
        })
      ),
      null
    )
  })
})
