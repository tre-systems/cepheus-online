import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from '../flow'
import {
  renderCharacterCreationCharacteristicGrid,
  type CharacterCreationCharacteristicsDocument
} from './characteristics'
import { deriveCharacterCreationCharacteristicGridViewModel } from '../view'
import { asNode, testDocument } from '../../../core/test-dom.helper'

const document =
  testDocument as unknown as CharacterCreationCharacteristicsDocument

const flow = (
  characteristics: CharacterCreationFlow['draft']['characteristics']
): CharacterCreationFlow => ({
  step: 'characteristics',
  draft: createInitialCharacterDraft(asCharacterId('char-1'), {
    name: 'Scout',
    characteristics
  })
})

const viewModel = (
  characteristics: CharacterCreationFlow['draft']['characteristics']
) => {
  const model = deriveCharacterCreationCharacteristicGridViewModel(
    flow(characteristics)
  )
  if (model === null) throw new Error('Expected characteristic grid view model')
  return model
}

describe('character creation characteristics view', () => {
  it('renders roll buttons for missing characteristics', async () => {
    const rolled: string[] = []
    let error = ''
    const node = asNode(
      renderCharacterCreationCharacteristicGrid(
        document,
        viewModel({
          str: null,
          dex: null,
          end: null,
          int: null,
          edu: null,
          soc: null
        }),
        {
          rollCharacteristic: async (key) => {
            rolled.push(key)
            throw new Error('Roll failed')
          },
          reportError: (message) => {
            error = message
          }
        }
      )
    )

    assert.equal(node.className, 'creation-stat-grid dice-stat-grid')
    assert.equal(node.children.length, 6)
    const strButton = node.children[0]?.children[1]?.children[0]
    assert.equal(strButton?.className, 'stat-die-button')
    assert.equal(strButton?.dataset['attr:aria-label'], 'Roll Str')

    strButton?.click()
    await Promise.resolve()

    assert.deepEqual(rolled, ['str'])
    assert.equal(error, 'Roll failed')
  })

  it('renders values and modifiers for assigned characteristics', () => {
    const node = asNode(
      renderCharacterCreationCharacteristicGrid(
        document,
        viewModel({
          str: 6,
          dex: 9,
          end: 7,
          int: 8,
          edu: 12,
          soc: 4
        }),
        {
          rollCharacteristic: async () => {},
          reportError: () => {}
        }
      )
    )

    assert.equal(node.children[0]?.children[1]?.children[0]?.textContent, '6')
    assert.equal(node.children[1]?.children[1]?.children[1]?.textContent, '+1')
    assert.equal(node.children[4]?.children[1]?.children[1]?.textContent, '+2')
    assert.equal(node.children[5]?.children[1]?.children[1]?.textContent, '-1')
  })
})
