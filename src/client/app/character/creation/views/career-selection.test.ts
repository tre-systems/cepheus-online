import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../../shared/ids'
import {
  applyCharacterCreationCareerPlan,
  createInitialCharacterDraft,
  selectCharacterCreationCareerPlan,
  type CharacterCreationFlow
} from '../flow'
import {
  renderCharacterCreationCareerPicker,
  renderCharacterCreationCareerRollButton,
  type CharacterCreationCareerSelectionDocument
} from './career-selection'
import {
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCareerSelectionViewModel
} from '../view'
import {
  asNode,
  type TestNode,
  testDocument
} from '../../../core/test-dom.helper'

const document =
  testDocument as unknown as CharacterCreationCareerSelectionDocument

const characteristics = {
  str: 7,
  dex: 8,
  end: 6,
  int: 9,
  edu: 7,
  soc: 5
}

const flow = (
  planOverrides: Partial<
    NonNullable<CharacterCreationFlow['draft']['careerPlan']>
  > = {}
): CharacterCreationFlow => ({
  step: 'career',
  draft: applyCharacterCreationCareerPlan(
    createInitialCharacterDraft(asCharacterId('career-selection-1'), {
      name: 'Iona Vesh',
      characteristics,
      careerPlan: planOverrides.career
        ? selectCharacterCreationCareerPlan(planOverrides.career)
        : null
    }),
    planOverrides.career
      ? {
          ...selectCharacterCreationCareerPlan(planOverrides.career),
          ...planOverrides
        }
      : {
          ...selectCharacterCreationCareerPlan('Merchant'),
          career: ''
        }
  )
})

const walk = (node: TestNode): TestNode[] => [
  node,
  ...node.children.flatMap((child) => walk(child))
]

const careerSelectionViewModel = (
  planOverrides: Partial<
    NonNullable<CharacterCreationFlow['draft']['careerPlan']>
  > = {}
) => {
  const viewModel = deriveCharacterCreationCareerSelectionViewModel(
    flow(planOverrides)
  )
  if (viewModel === null) throw new Error('Expected career selection model')
  return viewModel
}

const careerRollViewModel = (
  planOverrides: Partial<
    NonNullable<CharacterCreationFlow['draft']['careerPlan']>
  >
) => {
  const viewModel = deriveCharacterCreationCareerRollButton(flow(planOverrides))
  if (viewModel === null) throw new Error('Expected career roll model')
  return viewModel
}

describe('character creation career selection view', () => {
  it('renders career choices and delegates qualification', async () => {
    const resolved: string[] = []
    let error = ''
    const node = asNode(
      renderCharacterCreationCareerPicker(
        document,
        careerSelectionViewModel(),
        {
          resolveCareerQualification: async (career) => {
            resolved.push(career)
            throw new Error('No qualification')
          },
          resolveFailedQualificationOption: async () => {},
          reportError: (message) => {
            error = message
          }
        }
      )
    )

    assert.equal(node.className, 'creation-career-picker')
    assert.equal(node.children[0]?.dataset.characterCreationField, 'career')
    assert.equal(node.children[7]?.children[0]?.textContent, 'Choose a career')
    const rows = walk(node).filter(
      (item) => item.className === 'creation-career-card'
    )
    const merchant = rows.find(
      (row) => row.children[0]?.children[0]?.textContent === 'Merchant'
    )
    if (!merchant) throw new Error('Expected Merchant career row')

    assert.equal(merchant.tagName, 'div')
    assert.equal(merchant.listeners.click, undefined)
    assert.equal(merchant.listeners.pointerdown, undefined)

    merchant.click()
    await Promise.resolve()
    assert.deepEqual(resolved, [])

    const qualify = merchant.children[1]
    assert.equal(qualify?.tagName, 'button')
    assert.equal(qualify?.className, 'creation-career-qualify')
    assert.equal(qualify?.textContent, 'Qualify')

    qualify?.click()
    await Promise.resolve()

    assert.deepEqual(resolved, ['Merchant'])
    assert.equal(error, 'No qualification')
  })

  it('renders failed qualification fallback actions', async () => {
    const selected: string[] = []
    let error = ''
    const node = asNode(
      renderCharacterCreationCareerPicker(
        document,
        careerSelectionViewModel({
          career: 'Merchant',
          qualificationRoll: 2,
          qualificationPassed: false,
          drafted: false
        }),
        {
          resolveCareerQualification: async () => {},
          resolveFailedQualificationOption: async (option) => {
            selected.push(option)
            if (option === 'Draft') throw new Error('No draft')
          },
          reportError: (message) => {
            error = message
          }
        }
      )
    )

    const buttons = walk(node).filter((item) => item.tagName === 'button')
    const drifter = buttons.find(
      (button) => button.textContent === 'Become a Drifter'
    )
    const draft = buttons.find((button) =>
      button.textContent.startsWith('Roll draft')
    )
    if (!drifter || !draft) throw new Error('Expected fallback buttons')

    drifter.click()
    await Promise.resolve()
    draft.click()
    await Promise.resolve()

    assert.deepEqual(selected, ['Drifter', 'Draft'])
    assert.equal(error, 'No draft')
  })

  it('renders later career roll buttons but hides qualification rolls', async () => {
    const qualification = renderCharacterCreationCareerRollButton(
      document,
      careerRollViewModel({ career: 'Merchant' }),
      {
        rollCareerCheck: async () => {},
        reportError: () => {}
      }
    )
    assert.equal(qualification, null)

    const rolled: string[] = []
    const survivalElement = renderCharacterCreationCareerRollButton(
      document,
      careerRollViewModel({
        career: 'Merchant',
        qualificationRoll: 8,
        qualificationPassed: true,
        survivalRoll: null
      }),
      {
        rollCareerCheck: async () => {
          rolled.push('career')
        },
        reportError: () => {}
      }
    )
    if (!survivalElement) throw new Error('Expected survival roll button')
    const survival = asNode(survivalElement)
    assert.equal(survival.children[0]?.textContent, 'Roll survival')

    survival.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(rolled, ['career'])
  })
})
