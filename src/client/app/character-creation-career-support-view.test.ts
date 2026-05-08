import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  applyCharacterCreationAgingRoll,
  applyCharacterCreationCareerPlan,
  createInitialCharacterDraft,
  selectCharacterCreationCareerPlan,
  type CharacterCreationCompletedTerm,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  renderCharacterCreationAgingChoices,
  renderCharacterCreationAgingRollButton,
  renderCharacterCreationAnagathicsDecision,
  renderCharacterCreationReenlistmentRollButton,
  renderCharacterCreationTermSkillTables,
  type CharacterCreationCareerSupportDocument
} from './character-creation-career-support-view'
import { asNode, testDocument } from './test-dom.test-helper'

const document =
  testDocument as unknown as CharacterCreationCareerSupportDocument

const characteristics = {
  str: 7,
  dex: 8,
  end: 6,
  int: 9,
  edu: 7,
  soc: 5
}

const completedTerm = (): CharacterCreationCompletedTerm => ({
  career: 'Merchant',
  drafted: false,
  age: 22,
  qualificationRoll: 8,
  survivalRoll: 8,
  survivalPassed: true,
  canCommission: false,
  commissionRoll: null,
  commissionPassed: null,
  canAdvance: false,
  advancementRoll: null,
  advancementPassed: null,
  termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }],
  anagathics: false,
  agingRoll: null,
  agingSelections: [],
  reenlistmentRoll: 7,
  reenlistmentOutcome: 'allowed'
})

const careerFlow = (
  overrides: Partial<CharacterCreationFlow['draft']> = {},
  planOverrides: Partial<
    NonNullable<CharacterCreationFlow['draft']['careerPlan']>
  > = {}
): CharacterCreationFlow => ({
  step: 'career',
  draft: applyCharacterCreationCareerPlan(
    createInitialCharacterDraft(asCharacterId('career-support-1'), {
      name: 'Iona Vesh',
      characteristics,
      careerPlan: selectCharacterCreationCareerPlan('Merchant'),
      ...overrides
    }),
    {
      ...selectCharacterCreationCareerPlan('Merchant'),
      qualificationRoll: 8,
      qualificationPassed: true,
      survivalRoll: 8,
      survivalPassed: true,
      canCommission: true,
      commissionRoll: 8,
      commissionPassed: true,
      canAdvance: false,
      advancementRoll: null,
      advancementPassed: null,
      termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }],
      ...planOverrides
    }
  )
})

describe('character creation career support view', () => {
  it('renders term skill tables and reports roll errors', async () => {
    const flow = careerFlow({}, { termSkillRolls: [] })
    const rolled: string[] = []
    let error = ''

    const node = asNode(
      renderCharacterCreationTermSkillTables(document, flow, {
        rollTermSkill: async (table) => {
          rolled.push(table)
          throw new Error('No roll')
        },
        reportError: (message) => {
          error = message
        }
      })
    )

    assert.equal(node.className, 'creation-term-skills')
    assert.equal(node.children[0]?.textContent, 'Skills and training')
    assert.equal(node.children[2]?.textContent, '0/1 rolled')
    const actions = node.children[3]
    assert.equal(actions?.className, 'creation-term-actions')
    assert.equal(actions?.children.length, 4)
    assert.equal(actions?.children[3]?.textContent, 'Advanced education')
    assert.equal(actions?.children[3]?.disabled, true)

    actions?.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(rolled, ['personalDevelopment'])
    assert.equal(error, 'No roll')
  })

  it('renders reenlistment and aging roll buttons through callbacks', async () => {
    const events: string[] = []

    const reenlistmentElement = renderCharacterCreationReenlistmentRollButton(
      document,
      careerFlow({ age: 22 }, { anagathics: false }),
      {
        rollReenlistment: async () => {
          events.push('reenlist')
        },
        reportError: (message) => events.push(message)
      }
    )
    if (!reenlistmentElement) throw new Error('Expected reenlistment button')
    const reenlistment = asNode(reenlistmentElement)
    assert.equal(reenlistment.children[0]?.textContent, 'Roll reenlistment')
    reenlistment.children[0]?.click()
    await Promise.resolve()

    const agingElement = renderCharacterCreationAgingRollButton(
      document,
      careerFlow(
        {
          completedTerms: [completedTerm(), completedTerm(), completedTerm()]
        },
        { anagathics: false }
      ),
      {
        rollAging: async () => {
          events.push('aging')
        },
        reportError: (message) => events.push(message)
      }
    )
    if (!agingElement) throw new Error('Expected aging button')
    const aging = asNode(agingElement)
    assert.equal(aging.children[0]?.textContent, 'Roll aging')
    assert.equal(
      /Iona Vesh aging/.test(aging.children[1]?.textContent ?? ''),
      true
    )
    aging.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(events, ['reenlist', 'aging'])
  })

  it('renders aging choices without owning flow mutation', () => {
    const aged = applyCharacterCreationAgingRoll(
      careerFlow(
        { completedTerms: [completedTerm(), completedTerm(), completedTerm()] },
        { anagathics: true }
      ),
      -2
    ).flow
    const selections: Array<[number, string]> = []

    const node = asNode(
      renderCharacterCreationAgingChoices(document, aged, {
        applyAgingChange: (index, characteristic) => {
          selections.push([index, characteristic])
        }
      })
    )

    assert.equal(node.className, 'creation-term-skills')
    assert.equal(node.children[0]?.textContent, 'Aging effects')
    const firstRow = node.children[2]
    assert.equal(firstRow?.children[0]?.textContent, 'physical -1')
    firstRow?.children[1]?.click()

    assert.deepEqual(selections, [[0, 'str']])
  })

  it('renders anagathics decisions through callbacks', async () => {
    const decisions: boolean[] = []
    const node = asNode(
      renderCharacterCreationAnagathicsDecision(document, careerFlow(), {
        decideAnagathics: async (useAnagathics) => {
          decisions.push(useAnagathics)
        },
        reportError: () => {}
      })
    )

    assert.equal(node.className, 'creation-term-resolution')
    assert.equal(node.children[0]?.textContent, 'Anagathics')
    const actions = node.children[2]
    assert.equal(actions?.children[0]?.textContent, 'Use anagathics')
    assert.equal(actions?.children[1]?.textContent, 'Skip')

    actions?.children[0]?.click()
    actions?.children[1]?.click()
    await Promise.resolve()

    assert.deepEqual(decisions, [true, false])
  })
})
