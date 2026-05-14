import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationCompletedTerm,
  type CharacterCreationFlow
} from '../flow'
import {
  renderCharacterCreationMusteringOut,
  type CharacterCreationMusteringDocument
} from './mustering'
import { deriveCharacterCreationMusteringOutViewModel } from '../view'
import {
  asNode,
  testDocument as sharedTestDocument
} from '../../../core/test-dom.helper'

const testDocument =
  sharedTestDocument as unknown as CharacterCreationMusteringDocument

const completedTerm = (): CharacterCreationCompletedTerm => ({
  career: 'Scout',
  drafted: false,
  age: 22,
  qualificationRoll: 8,
  survivalRoll: 9,
  survivalPassed: true,
  canCommission: false,
  commissionRoll: null,
  commissionPassed: null,
  canAdvance: false,
  advancementRoll: null,
  advancementPassed: null,
  termSkillRolls: [],
  agingRoll: null,
  agingSelections: [],
  reenlistmentRoll: 7,
  reenlistmentOutcome: 'allowed'
})

const flow = (overrides: Partial<CharacterCreationFlow['draft']> = {}) =>
  ({
    step: 'equipment',
    draft: createInitialCharacterDraft(asCharacterId('scout-1'), {
      name: 'Scout',
      characteristics: {
        str: 7,
        dex: 8,
        end: 6,
        int: 9,
        edu: 7,
        soc: 5
      },
      completedTerms: [completedTerm()],
      ...overrides
    })
  }) satisfies CharacterCreationFlow

const musteringViewModel = (
  overrides: Partial<CharacterCreationFlow['draft']> = {}
) => deriveCharacterCreationMusteringOutViewModel(flow(overrides))

describe('character creation mustering view', () => {
  it('renders remaining benefit rolls and existing benefits', () => {
    const node = asNode(
      renderCharacterCreationMusteringOut(testDocument, musteringViewModel(), {
        rollMusteringBenefit: async () => {},
        reportError: () => {}
      })
    )

    assert.equal(node.className, 'creation-mustering-out')
    assert.equal(node.children[0]?.textContent, 'Mustering out')
    assert.equal(node.children[1]?.textContent, '1 benefit roll remaining.')
    assert.equal(node.children[3]?.className, 'creation-term-actions')
    assert.equal(node.children[3]?.children[0]?.textContent, 'Roll cash')
    assert.equal(node.children[3]?.children[1]?.textContent, 'Roll benefit')
  })

  it('disables cash after three cash benefits and reports roll errors', async () => {
    const rolled: string[] = []
    let error = ''
    const node = asNode(
      renderCharacterCreationMusteringOut(
        testDocument,
        musteringViewModel({
          completedTerms: [
            completedTerm(),
            completedTerm(),
            completedTerm(),
            completedTerm()
          ],
          musteringBenefits: [
            {
              career: 'Scout',
              kind: 'cash',
              roll: 1,
              value: '10000',
              credits: 10000
            },
            {
              career: 'Scout',
              kind: 'cash',
              roll: 2,
              value: '10000',
              credits: 10000
            },
            {
              career: 'Scout',
              kind: 'cash',
              roll: 3,
              value: '20000',
              credits: 20000
            }
          ]
        }),
        {
          rollMusteringBenefit: async (kind) => {
            rolled.push(kind)
            throw new Error('No benefit')
          },
          reportError: (message) => {
            error = message
          }
        }
      )
    )

    const actions = node.children[3]
    assert.equal(actions?.children[0]?.disabled, true)
    assert.equal(actions?.children[1]?.disabled, false)

    actions?.children[1]?.click()
    await Promise.resolve()

    assert.deepEqual(rolled, ['material'])
    assert.equal(error, 'No benefit')
  })

  it('suppresses repeated benefit rolls while a roll is pending', async () => {
    const rolled: string[] = []
    let resolveRoll: () => void = () => {}
    const node = asNode(
      renderCharacterCreationMusteringOut(testDocument, musteringViewModel(), {
        rollMusteringBenefit: (kind) => {
          rolled.push(kind)
          return new Promise<void>((resolve) => {
            resolveRoll = resolve
          })
        },
        reportError: (message) => rolled.push(message)
      })
    )

    const benefit = node.children[3]?.children[1]
    benefit?.click()
    benefit?.click()

    assert.deepEqual(rolled, ['material'])
    assert.equal(benefit?.disabled, true)

    resolveRoll()
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(benefit?.disabled, false)
    benefit?.click()

    assert.deepEqual(rolled, ['material', 'material'])
  })
})
