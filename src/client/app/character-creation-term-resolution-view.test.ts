import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  renderCharacterCreationTermResolution,
  type CharacterCreationTermResolutionDocument
} from './character-creation-term-resolution-view'
import { asNode, testDocument } from './test-dom.test-helper'

const document =
  testDocument as unknown as CharacterCreationTermResolutionDocument

const baseFlow = (
  careerPlan: NonNullable<CharacterCreationFlow['draft']['careerPlan']> | null,
  overrides: Partial<CharacterCreationFlow['draft']> = {}
): CharacterCreationFlow => ({
  step: 'career',
  draft: createInitialCharacterDraft(asCharacterId('char-1'), {
    name: 'Scout',
    age: 22,
    characteristics: {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    },
    skills: ['Pilot-0', 'Survival-0'],
    careerPlan,
    ...overrides
  })
})

const survivedPlan = (
  overrides: Partial<
    NonNullable<CharacterCreationFlow['draft']['careerPlan']>
  > = {}
): NonNullable<CharacterCreationFlow['draft']['careerPlan']> => ({
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
  termSkillRolls: [
    { table: 'serviceSkills', roll: 1, skill: 'Pilot' },
    { table: 'serviceSkills', roll: 2, skill: 'Survival' }
  ],
  ...overrides
})

describe('character creation term resolution view', () => {
  it('returns an empty fragment when no career is selected', () => {
    const node = asNode(
      renderCharacterCreationTermResolution(document, baseFlow(null), {
        completeTerm: () => {}
      })
    )

    assert.equal(node.tagName, '#fragment')
  })

  it('renders blockers for unresolved checks, skill rolls, and death', () => {
    const unresolved = asNode(
      renderCharacterCreationTermResolution(
        document,
        baseFlow(survivedPlan({ survivalRoll: null, survivalPassed: null })),
        { completeTerm: () => {} }
      )
    )
    assert.equal(
      unresolved.children[1]?.textContent,
      'Roll each required check. The next roll appears above.'
    )

    const skills = asNode(
      renderCharacterCreationTermResolution(
        document,
        baseFlow(survivedPlan({ termSkillRolls: [] })),
        { completeTerm: () => {} }
      )
    )
    assert.equal(
      skills.children[1]?.textContent,
      'Roll this term’s skills before deciding what happens next.'
    )

    const dead = asNode(
      renderCharacterCreationTermResolution(
        document,
        baseFlow(
          survivedPlan({
            survivalRoll: 3,
            survivalPassed: false,
            termSkillRolls: []
          })
        ),
        { completeTerm: () => {} }
      )
    )
    assert.equal(
      dead.children[1]?.textContent,
      'Killed in service. This character cannot muster out or become playable.'
    )
    assert.equal(dead.children.length, 2)
  })

  it('renders reenlistment and completion actions', async () => {
    const completed: boolean[] = []
    const node = asNode(
      renderCharacterCreationTermResolution(
        document,
        baseFlow(
          survivedPlan({ reenlistmentRoll: 7, reenlistmentOutcome: 'allowed' })
        ),
        {
          completeTerm: (continueCareer) => {
            completed.push(continueCareer)
          }
        }
      )
    )

    const actions = node.children[2]
    assert.equal(actions?.children[0]?.textContent, 'Serve another term')
    assert.equal(actions?.children[1]?.textContent, 'Muster out')

    actions?.children[0]?.click()
    actions?.children[1]?.click()
    await Promise.resolve()

    assert.deepEqual(completed, [true, false])
  })

  it('uses required-term copy for forced reenlistment', () => {
    const completed: boolean[] = []
    const node = asNode(
      renderCharacterCreationTermResolution(
        document,
        baseFlow(
          survivedPlan({ reenlistmentRoll: 12, reenlistmentOutcome: 'forced' })
        ),
        {
          completeTerm: (continueCareer) => {
            completed.push(continueCareer)
          }
        }
      )
    )

    assert.equal(
      node.children[2]?.children[0]?.textContent,
      'Serve required term'
    )
    node.children[2]?.children[0]?.click()
    assert.deepEqual(completed, [true])
  })
})
