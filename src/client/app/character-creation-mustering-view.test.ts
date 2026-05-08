import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationCompletedTerm,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  renderCharacterCreationMusteringOut,
  type CharacterCreationMusteringDocument
} from './character-creation-mustering-view'

type TestListener = (event: { preventDefault: () => void }) => void

class TestNode {
  tagName: string
  className = ''
  textContent = ''
  type = ''
  title = ''
  disabled = false
  children: TestNode[] = []
  listeners: Record<string, TestListener[]> = {}

  constructor(tagName: string) {
    this.tagName = tagName
  }

  append(...children: TestNode[]) {
    this.children.push(...children)
  }

  addEventListener(type: string, listener: TestListener) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ preventDefault: () => {} })
    }
  }
}

class TestDocument {
  createElement(tagName: string) {
    return new TestNode(tagName)
  }
}

const testDocument =
  new TestDocument() as unknown as CharacterCreationMusteringDocument
const asNode = (value: HTMLElement): TestNode => value as unknown as TestNode

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

describe('character creation mustering view', () => {
  it('renders remaining benefit rolls and existing benefits', () => {
    const node = asNode(
      renderCharacterCreationMusteringOut(testDocument, flow(), {
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
        flow({
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
})
