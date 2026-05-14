import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import {
  deriveCharacteristicExportLine,
  deriveCharacterUpp,
  derivePlainCharacterExport,
  formatUppCharacteristic,
  isCharacterCreationFinal,
  sortSkillsForExport
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
  skills: ['Vacc Suit-0', 'Pilot-1', 'Broker-2'],
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
      skills: ['Pilot-1'],
      skillsAndTraining: ['Vacc Suit-0'],
      benefits: ['Low Passage'],
      facts: {
        qualification: {
          career: 'Scout',
          passed: true,
          previousCareerCount: 0,
          failedQualificationOptions: [],
          qualification: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8,
            characteristic: 'int',
            modifier: 1,
            target: 6,
            success: true
          }
        },
        survival: {
          passed: true,
          canCommission: false,
          canAdvance: true,
          survival: {
            expression: '2d6',
            rolls: [4, 3],
            total: 7,
            characteristic: 'end',
            modifier: 0,
            target: 7,
            success: true
          }
        },
        advancement: {
          skipped: false,
          passed: true,
          advancement: {
            expression: '2d6',
            rolls: [6, 4],
            total: 10,
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
            bonusSkill: null
          }
        },
        aging: {
          roll: { expression: '2d6', rolls: [6, 5], total: 11 },
          modifier: 0,
          age: 34,
          characteristicChanges: []
        },
        anagathicsDecision: { useAnagathics: false, termIndex: 0 },
        reenlistment: {
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
        musteringBenefits: [
          {
            career: 'Scout',
            kind: 'material',
            roll: { expression: '2d6', rolls: [1, 2], total: 3 },
            modifier: 1,
            tableRoll: 4,
            value: 'Low Passage',
            credits: 0,
            materialItem: 'Low Passage'
          }
        ]
      },
      complete: true,
      canReenlist: true,
      completedBasicTraining: false,
      musteringOut: false,
      anagathics: false
    }
  ],
  careers: [{ name: 'Scout', rank: 1 }],
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

  it('formats characteristic and skill export helpers for table use', () => {
    assert.equal(
      deriveCharacteristicExportLine(character().characteristics),
      'Str 7, Dex 8, End 9 (+1), Int 10 (+1), Edu 11 (+1), Soc 6'
    )
    assert.deepEqual(sortSkillsForExport(['Pilot-1', 'Broker-2', 'Admin-0']), [
      'Broker-2',
      'Pilot-1',
      'Admin-0'
    ])
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
        'Characteristics: Str 7, Dex 8, End 9 (+1), Int 10 (+1), Edu 11 (+1), Soc 6',
        'Type: PLAYER',
        'Age: 34',
        'Homeworld: Unspecified',
        'Careers: Scout rank 1 (Courier)',
        'Terms: 1',
        'Skills: Broker-2, Pilot-1, Vacc Suit-0',
        'Credits: Cr1200',
        'Equipment: Vacc Suit x1 (Carried)',
        'Career History:',
        '- Term 1: Scout - qualified passed 8; survival passed 7; advancement passed 10 to rank 1 (Courier); skills Pilot-1, Vacc Suit-0; aging 11: no effect; no anagathics; reenlistment 10: allowed; benefits Low Passage (roll 3 +1 DM = table 4); term complete',
        'Notes:',
        'Detached scout.'
      ].join('\n')
    )
  })

  it('includes projected anagathics cost in term history exports', () => {
    const creation = finalizedCreation()
    const term = creation.terms[0]
    term.anagathics = true
    term.anagathicsCost = 20000
    term.facts = {
      ...term.facts,
      anagathicsDecision: { useAnagathics: true, termIndex: 0 }
    }

    assert.equal(
      /used anagathics \(Cr20000\)/.test(
        derivePlainCharacterExport(character({ creation })) ?? ''
      ),
      true
    )
  })

  it('formats material characteristic gains in term history exports', () => {
    const creation = finalizedCreation()
    creation.terms[0].facts = {
      ...creation.terms[0].facts,
      musteringBenefits: [
        {
          career: 'Aerospace',
          kind: 'material',
          roll: { expression: '2d6', rolls: [4, 4], total: 8 },
          modifier: 0,
          tableRoll: 8,
          value: '+1 Soc',
          credits: 0,
          materialItem: null
        }
      ]
    }

    assert.equal(
      /benefits Soc \+1 \(roll 8\)/.test(
        derivePlainCharacterExport(character({ creation })) ?? ''
      ),
      true
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
