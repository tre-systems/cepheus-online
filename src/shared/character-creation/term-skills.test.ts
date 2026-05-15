import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCareerTerm } from './term-lifecycle'
import {
  deriveCareerTermSkillFactValues,
  deriveCareerTermSkillRollSummaries,
  deriveCareerTermTrainingSkillsFromFacts,
  hasProjectedCareerTermFacts,
  resolveCareerTermCascadeSkill
} from './term-skills'
import type { CareerCreationTermSkillFact, CareerTerm } from './types'

const termSkillFact = (
  overrides: Partial<CareerCreationTermSkillFact> = {}
): CareerCreationTermSkillFact => ({
  career: 'Scout',
  table: 'serviceSkills',
  roll: { expression: '1d6', rolls: [1], total: 1 },
  tableRoll: 1,
  rawSkill: 'Pilot',
  skill: 'Pilot-1',
  characteristic: null,
  pendingCascadeSkill: null,
  ...overrides
})

const term = (overrides: Partial<CareerTerm> = {}): CareerTerm => ({
  ...createCareerTerm({ career: 'Scout' }),
  ...overrides
})

describe('career term skill facts', () => {
  it('treats an empty facts object as projection-owned', () => {
    assert.equal(hasProjectedCareerTermFacts(term({ facts: {} })), true)
    assert.equal(hasProjectedCareerTermFacts(term({ facts: undefined })), false)
  })

  it('resolves nested cascade choices without leaking unresolved placeholders', () => {
    const projected = term({
      facts: {
        termSkillRolls: [
          termSkillFact({
            rawSkill: 'Gun Combat*',
            skill: null,
            pendingCascadeSkill: 'Gun Combat-1'
          })
        ],
        termCascadeSelections: [
          { cascadeSkill: 'Gun Combat-1', selection: 'Energy Weapon*' },
          { cascadeSkill: 'Energy Weapon-1', selection: 'Energy Rifle' }
        ]
      }
    })

    assert.equal(
      resolveCareerTermCascadeSkill(projected, 'Gun Combat-1'),
      'Energy Rifle-1'
    )
    assert.deepEqual(deriveCareerTermSkillFactValues(projected), [
      'Energy Rifle-1'
    ])
    assert.deepEqual(deriveCareerTermSkillRollSummaries(projected), [
      {
        table: 'serviceSkills',
        roll: 1,
        skill: 'Energy Rifle-1'
      }
    ])
  })

  it('can preserve pending cascades and characteristic gains for server state', () => {
    const projected = term({
      facts: {
        basicTrainingSkills: ['Vacc Suit-0'],
        termSkillRolls: [
          termSkillFact({
            rawSkill: 'Gun Combat*',
            skill: null,
            pendingCascadeSkill: 'Gun Combat-1'
          }),
          termSkillFact({
            rawSkill: '+1 Str',
            skill: null,
            characteristic: { key: 'str', modifier: 1 }
          })
        ]
      }
    })

    assert.deepEqual(deriveCareerTermTrainingSkillsFromFacts(projected), [
      'Vacc Suit-0'
    ])
    assert.deepEqual(
      deriveCareerTermTrainingSkillsFromFacts(projected, {
        includePendingCascade: true,
        includeCharacteristicGain: true
      }),
      ['Vacc Suit-0', 'Gun Combat-1', '+1 Str']
    )
  })
})
