import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asNode,
  testDocument as sharedTestDocument
} from '../../../core/test-dom.helper'
import type { CharacterCreationInjuryResolutionViewModel } from '../view'
import {
  renderCharacterCreationInjuryResolution,
  type CharacterCreationInjuryResolutionDocument
} from './injury-resolution'

const testDocument =
  sharedTestDocument as unknown as CharacterCreationInjuryResolutionDocument

const severeInjuryViewModel =
  (): CharacterCreationInjuryResolutionViewModel => ({
    title: 'Merchant injury',
    message:
      'Injured in action. Treat as injury table result 2, or roll twice and take the lower result. Resolve this injury before mustering out.',
    choiceHint:
      'Severely injured: choose the physical characteristic that loses 1D6.',
    targets: [
      { characteristic: 'str', label: 'Strength', value: '7', modifier: '+0' },
      { characteristic: 'dex', label: 'Dexterity', value: '8', modifier: '+0' },
      { characteristic: 'end', label: 'Endurance', value: '6', modifier: '+0' }
    ],
    secondaryChoice: { mode: 'both_other_physical' },
    methods: [
      {
        method: 'fixed_result',
        label: 'Use injury table result 2',
        rollRequirement: { key: 'injury', dice: '1d6' }
      },
      {
        method: 'roll_twice_take_lower',
        label: 'Roll twice and take lower',
        rollRequirement: { key: 'injury', dice: '2d6' }
      }
    ]
  })

describe('character creation injury resolution view', () => {
  it('renders severe injury target guidance before method choices', () => {
    const node = asNode(
      renderCharacterCreationInjuryResolution(
        testDocument,
        severeInjuryViewModel(),
        { readOnly: false, resolveInjury: () => {} }
      )
    )

    assert.equal(node.className, 'creation-term-resolution')
    assert.equal(node.children[0]?.textContent, 'Merchant injury')
    assert.equal(
      node.children[2]?.textContent,
      'Severely injured: choose the physical characteristic that loses 1D6.'
    )
    assert.equal(node.children[2]?.className, 'creation-injury-choice-hint')
    assert.equal(node.children[3]?.className, 'creation-term-actions')
    assert.equal(
      node.children[3]?.children[0]?.textContent,
      'Use injury table result 2: Strength 7 +0'
    )
  })

  it('submits the selected characteristic and injury method', async () => {
    const resolved: string[] = []
    const node = asNode(
      renderCharacterCreationInjuryResolution(
        testDocument,
        severeInjuryViewModel(),
        {
          readOnly: false,
          resolveInjury: async (characteristic, secondaryChoice, method) => {
            resolved.push(`${method}:${secondaryChoice.mode}:${characteristic}`)
          }
        }
      )
    )

    node.children[3]?.children[4]?.click()
    await Promise.resolve()

    assert.deepEqual(resolved, [
      'roll_twice_take_lower:both_other_physical:dex'
    ])
  })
})
