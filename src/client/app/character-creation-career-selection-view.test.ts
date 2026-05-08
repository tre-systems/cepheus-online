import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  applyCharacterCreationCareerPlan,
  createInitialCharacterDraft,
  selectCharacterCreationCareerPlan,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  renderCharacterCreationCareerPicker,
  renderCharacterCreationCareerRollButton,
  type CharacterCreationCareerSelectionDocument
} from './character-creation-career-selection-view'
import { asNode, type TestNode, testDocument } from './test-dom.test-helper'

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

describe('character creation career selection view', () => {
  it('renders career choices and delegates qualification', async () => {
    const resolved: string[] = []
    let error = ''
    const node = asNode(
      renderCharacterCreationCareerPicker(document, flow(), {
        resolveCareerQualification: async (career) => {
          resolved.push(career)
          throw new Error('No qualification')
        },
        selectFailedQualificationCareer: () => {},
        reportError: (message) => {
          error = message
        }
      })
    )

    assert.equal(node.className, 'creation-career-picker')
    assert.equal(node.children[0]?.dataset.characterCreationField, 'career')
    assert.equal(node.children[7]?.children[0]?.textContent, 'Choose a career')
    const buttons = walk(node).filter((item) => item.tagName === 'button')
    const merchant = buttons.find(
      (button) => button.children[0]?.textContent === 'Merchant'
    )
    if (!merchant) throw new Error('Expected Merchant career button')

    merchant.click()
    await Promise.resolve()

    assert.deepEqual(resolved, ['Merchant'])
    assert.equal(error, 'No qualification')
  })

  it('renders failed qualification fallback actions', () => {
    const selected: Array<[string, boolean]> = []
    let error = ''
    const node = asNode(
      renderCharacterCreationCareerPicker(
        document,
        flow({
          career: 'Merchant',
          qualificationRoll: 2,
          qualificationPassed: false,
          drafted: false
        }),
        {
          resolveCareerQualification: async () => {},
          selectFailedQualificationCareer: (career, drafted) => {
            selected.push([career, drafted])
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
    draft.click()

    assert.deepEqual(selected, [['Drifter', false]])
    assert.equal(
      error,
      'Draft resolution is handled by the event-backed creator flow; choose Drifter here or restart from the shared creation actions.'
    )
  })

  it('renders later career roll buttons but hides qualification rolls', async () => {
    const qualification = renderCharacterCreationCareerRollButton(
      document,
      flow({ career: 'Merchant' }),
      {
        rollCareerCheck: async () => {},
        reportError: () => {}
      }
    )
    assert.equal(qualification, null)

    const rolled: string[] = []
    const survivalElement = renderCharacterCreationCareerRollButton(
      document,
      flow({
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
