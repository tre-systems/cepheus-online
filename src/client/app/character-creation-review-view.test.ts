import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  renderCharacterCreationReview,
  renderCharacterCreationTermHistory,
  type CharacterCreationReviewDocument
} from './character-creation-review-view'

class TestNode {
  tagName: string
  className = ''
  textContent = ''
  children: TestNode[] = []

  constructor(tagName: string) {
    this.tagName = tagName
  }

  append(...children: TestNode[]) {
    this.children.push(...children)
  }
}

class TestDocument {
  createElement(tagName: string) {
    return new TestNode(tagName)
  }

  createDocumentFragment() {
    return new TestNode('#fragment')
  }
}

const testDocument =
  new TestDocument() as unknown as CharacterCreationReviewDocument
const asNode = (value: HTMLElement | DocumentFragment): TestNode =>
  value as unknown as TestNode

const completeFlow = (): CharacterCreationFlow => ({
  step: 'review',
  draft: {
    ...createInitialCharacterDraft(asCharacterId('iona-vesh'), {
      characterType: 'PLAYER',
      name: 'Iona Vesh',
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
      equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Detached scout.'
    }),
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Zero-G-0'],
    pendingCascadeSkills: [],
    careerPlan: {
      career: 'Scout',
      qualificationRoll: 8,
      qualificationPassed: true,
      survivalRoll: 9,
      survivalPassed: true,
      commissionRoll: null,
      commissionPassed: null,
      advancementRoll: null,
      advancementPassed: null,
      canCommission: false,
      canAdvance: false,
      drafted: false,
      termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Pilot' }],
      agingRoll: 0,
      agingMessage: 'Character aged to 34.',
      agingSelections: [],
      reenlistmentRoll: 7,
      reenlistmentOutcome: 'allowed'
    },
    completedTerms: [
      {
        career: 'Scout',
        drafted: false,
        age: 34,
        qualificationRoll: 8,
        survivalRoll: 9,
        survivalPassed: true,
        canCommission: false,
        commissionRoll: null,
        commissionPassed: null,
        canAdvance: false,
        advancementRoll: null,
        advancementPassed: null,
        termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Pilot' }],
        agingRoll: 0,
        agingMessage: 'Character aged to 34.',
        agingSelections: [],
        reenlistmentRoll: 7,
        reenlistmentOutcome: 'allowed'
      }
    ],
    musteringBenefits: [
      {
        career: 'Scout',
        kind: 'cash',
        roll: 2,
        value: '10000',
        credits: 10000
      }
    ]
  }
})

describe('character creation review view', () => {
  it('returns an empty fragment when no terms are complete', () => {
    const flow = completeFlow()
    flow.draft.completedTerms = []

    const node = asNode(renderCharacterCreationTermHistory(testDocument, flow))

    assert.equal(node.tagName, '#fragment')
    assert.deepEqual(node.children, [])
  })

  it('renders completed term history', () => {
    const node = asNode(
      renderCharacterCreationTermHistory(testDocument, completeFlow())
    )

    assert.equal(node.className, 'creation-term-history')
    assert.equal(node.children[0]?.textContent, 'Terms served')
    assert.equal(
      node.children[1]?.children[0]?.textContent,
      '1. Scout: survived; training Pilot (1); aging 0 Character aged to 34.; reenlistment 7 allowed'
    )
  })

  it('renders review summary sections from a character creation flow', () => {
    const node = asNode(
      renderCharacterCreationReview(testDocument, completeFlow())
    )

    assert.equal(node.className, 'character-creation-review')
    assert.equal(node.children[0]?.textContent, 'Iona Vesh')
    assert.equal(node.children[1]?.textContent, 'PLAYER')
    const firstSection = node.children[2]
    assert.equal(firstSection?.tagName, 'dl')
    assert.equal(firstSection?.children[0]?.textContent, 'Basics')
    assert.equal(firstSection?.children[1]?.textContent, 'Name: Iona Vesh')
  })
})
