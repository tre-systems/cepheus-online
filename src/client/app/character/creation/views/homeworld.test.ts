import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from '../flow'
import {
  renderCharacterCreationCascadeChoice,
  renderCharacterCreationHomeworld,
  renderCharacterCreationTermCascadeChoices,
  type CharacterCreationHomeworldDocument
} from './homeworld'
import {
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationTermCascadeChoicesViewModel,
  type CharacterCreationPendingCascadeChoiceViewModel
} from '../view'
import {
  asNode,
  type TestNode,
  testDocument
} from '../../../core/test-dom.helper'

const document = testDocument as unknown as CharacterCreationHomeworldDocument

const flow = (
  overrides: Partial<CharacterCreationFlow['draft']> = {}
): CharacterCreationFlow => ({
  step: 'homeworld',
  draft: createInitialCharacterDraft(asCharacterId('homeworld-1'), {
    name: 'Iona Vesh',
    characteristics: {
      str: 7,
      dex: 8,
      end: 6,
      int: 9,
      edu: 7,
      soc: 5
    },
    homeworld: {
      lawLevel: 'Low Law',
      tradeCodes: ['Industrial']
    },
    ...overrides
  })
})

const walk = (node: TestNode): TestNode[] => [
  node,
  ...node.children.flatMap((child) => walk(child))
]

const viewModel = (overrides: Partial<CharacterCreationFlow['draft']> = {}) =>
  deriveCharacterCreationHomeworldViewModel(flow(overrides))

const termCascadeViewModel = (
  overrides: Partial<CharacterCreationFlow['draft']> = {}
) => {
  const model = deriveCharacterCreationTermCascadeChoicesViewModel({
    ...flow(overrides),
    step: 'career'
  })
  if (!model) throw new Error('Expected term cascade view model')
  return model
}

describe('character creation homeworld view', () => {
  it('renders homeworld select fields with parent sync metadata', () => {
    const node = asNode(
      renderCharacterCreationHomeworld(document, viewModel(), {
        toggleBackgroundSkill: () => {},
        resolveCascadeSkill: () => {}
      })
    )

    assert.equal(node.className, 'creation-homeworld')
    const fieldGrid = node.children[0]
    assert.equal(fieldGrid?.className, 'creation-homeworld-fields')
    const lawField = fieldGrid?.children[0]
    const lawSelect = lawField?.children[1]
    assert.equal(lawField?.children[0]?.textContent, 'Law level *')
    assert.equal(
      lawSelect?.dataset.characterCreationField,
      'homeworld.lawLevel'
    )
    assert.equal(lawSelect?.children[0]?.textContent, 'Select law level')
  })

  it('renders background skill state and delegates selection clicks', () => {
    const selected: Array<{
      label: string
      selected: boolean
      cascade: boolean
    }> = []
    const node = asNode(
      renderCharacterCreationHomeworld(document, viewModel(), {
        toggleBackgroundSkill: (option) => selected.push(option),
        resolveCascadeSkill: () => {}
      })
    )

    const buttons = walk(node).filter((item) => item.tagName === 'button')
    const selectable = buttons.find(
      (button) => button.title === 'Select background skill'
    )
    if (!selectable) throw new Error('Expected selectable background skill')

    selectable.click()

    assert.deepEqual(selected, [
      {
        label: selectable.textContent,
        selected: false,
        cascade: false
      }
    ])
  })

  it('delegates background cascade choices without owning flow mutation', () => {
    const choices: Array<{
      scope: string
      cascadeSkill: string
      selection: string
    }> = []
    const cascade = {
      open: true,
      cascadeSkill: 'Gun Combat-0',
      title: 'Choose Gun Combat',
      prompt: 'Resolve Gun Combat-0 into a specialty.',
      label: 'Gun Combat',
      level: 0,
      options: [
        { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false }
      ]
    } satisfies CharacterCreationPendingCascadeChoiceViewModel

    const node = asNode(
      renderCharacterCreationCascadeChoice(document, cascade, 'background', {
        resolveCascadeSkill: (choice) => choices.push(choice)
      })
    )

    assert.equal(node.className, 'creation-cascade-choice')
    assert.equal(node.children[0]?.textContent, 'Choose Gun Combat')
    node.children[2]?.children[0]?.click()

    assert.deepEqual(choices, [
      {
        scope: 'background',
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Pistol'
      }
    ])
  })

  it('renders term cascade choices through the same cascade renderer', () => {
    const choices: Array<{
      scope: string
      cascadeSkill: string
      selection: string
    }> = []
    const node = asNode(
      renderCharacterCreationTermCascadeChoices(
        document,
        termCascadeViewModel({ pendingTermCascadeSkills: ['Gun Combat-0'] }),
        { resolveCascadeSkill: (choice) => choices.push(choice) }
      )
    )

    assert.equal(node.className, 'creation-term-skills')
    assert.equal(node.children[0]?.textContent, 'Choose a specialty')
    const cascadePanel = node.children[2]
    assert.equal(cascadePanel?.className, 'creation-cascade-choice')
    cascadePanel?.children[1]?.children[0]?.click()

    assert.equal(choices[0]?.scope, 'term')
    assert.equal(choices[0]?.cascadeSkill, 'Gun Combat-0')
    assert.equal(typeof choices[0]?.selection, 'string')
  })
})
