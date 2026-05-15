import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from '../flow'
import {
  renderCharacterCreationTermResolution,
  type CharacterCreationTermResolutionDocument
} from './term-resolution'
import { deriveCharacterCreationTermResolutionViewModel } from '../view'
import { asNode, testDocument } from '../../../core/test-dom.helper'

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
  const viewModel = (flow: CharacterCreationFlow) => {
    const model = deriveCharacterCreationTermResolutionViewModel(flow)
    if (!model) throw new Error('Expected term resolution view model')
    return model
  }

  it('derives no view model when no career is selected', () => {
    assert.equal(
      deriveCharacterCreationTermResolutionViewModel(baseFlow(null)),
      null
    )
  })

  it('renders blockers for unresolved checks, skill rolls, and death', () => {
    const unresolved = asNode(
      renderCharacterCreationTermResolution(
        document,
        viewModel(
          baseFlow(survivedPlan({ survivalRoll: null, survivalPassed: null }))
        ),
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
        viewModel(baseFlow(survivedPlan({ termSkillRolls: [] }))),
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
        viewModel(
          baseFlow(
            survivedPlan({
              survivalRoll: 3,
              survivalPassed: false,
              termSkillRolls: []
            })
          )
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

  it('hides local blockers when projected legal actions do not allow them', () => {
    assert.equal(
      deriveCharacterCreationTermResolutionViewModel(
        baseFlow(survivedPlan({ termSkillRolls: [] })),
        { availableActionKeys: new Set() }
      ),
      null
    )
    assert.equal(
      deriveCharacterCreationTermResolutionViewModel(
        baseFlow(
          survivedPlan({
            termSkillRolls: [],
            reenlistmentRoll: 7,
            reenlistmentOutcome: 'allowed'
          })
        ),
        { availableActionKeys: new Set(['reenlist']) }
      )?.actions[0]?.label,
      'Serve another term'
    )
  })

  it('renders reenlistment and completion actions', async () => {
    const completed: boolean[] = []
    const node = asNode(
      renderCharacterCreationTermResolution(
        document,
        viewModel(
          baseFlow(
            survivedPlan({
              reenlistmentRoll: 7,
              reenlistmentOutcome: 'allowed'
            })
          )
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
        viewModel(
          baseFlow(
            survivedPlan({
              reenlistmentRoll: 12,
              reenlistmentOutcome: 'forced'
            })
          )
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
