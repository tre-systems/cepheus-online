import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  renderCharacterCreationBasicTrainingButton,
  renderCharacterCreationCharacteristicRollButton,
  renderCharacterCreationDeath,
  renderCharacterCreationDraftFields,
  renderCharacterCreationNextStep,
  type CharacterCreationRendererDocument
} from './character-creation-renderer'
import { deriveCharacterCreationNextStepViewModel } from './character-creation-view'
import { asNode, testDocument, type TestNode } from './test-dom.test-helper'

const document = testDocument as unknown as CharacterCreationRendererDocument

const characterId = asCharacterId('creation-renderer-1')

const characteristics = {
  str: 7,
  dex: 8,
  end: 7,
  int: 9,
  edu: 8,
  soc: 6
}

const completeFlow = (
  step: CharacterCreationFlow['step']
): CharacterCreationFlow => ({
  step,
  draft: {
    ...createInitialCharacterDraft(characterId, {
      characterType: 'PLAYER',
      name: 'Iona Vesh',
      age: 34,
      characteristics,
      skills: ['Pilot-1', 'Vacc Suit-0'],
      equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Detached scout.'
    }),
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Zero-G-0', 'Slug Pistol-0', 'Admin-0'],
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
        commissionRoll: null,
        commissionPassed: null,
        advancementRoll: null,
        advancementPassed: null,
        canCommission: false,
        canAdvance: false,
        termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Pilot' }],
        anagathics: false,
        agingRoll: 0,
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

const reviewFlow = (): CharacterCreationFlow => completeFlow('review')

const basicTrainingFlow = (): CharacterCreationFlow => ({
  step: 'skills',
  draft: {
    ...completeFlow('skills').draft,
    skills: []
  }
})

const deathFlow = (): CharacterCreationFlow => {
  const flow = completeFlow('career')
  const plan = flow.draft.careerPlan
  if (!plan) throw new Error('Expected career plan')

  return {
    step: 'career',
    draft: {
      ...flow.draft,
      careerPlan: {
        ...plan,
        survivalRoll: 5,
        survivalPassed: false
      }
    }
  }
}

const characteristicFlow = (): CharacterCreationFlow => ({
  step: 'characteristics',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Iona Vesh',
    characteristics: {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: null,
      soc: null
    }
  })
})

const findNode = (
  node: TestNode,
  predicate: (candidate: TestNode) => boolean
): TestNode | null => {
  if (predicate(node)) return node
  for (const child of node.children) {
    const found = findNode(child, predicate)
    if (found) return found
  }
  return null
}

describe('character creation renderer', () => {
  it('renders the next-step review action through callbacks', async () => {
    const events: string[] = []
    const currentFlow = reviewFlow()
    const node = asNode(
      renderCharacterCreationNextStep(
        document,
        deriveCharacterCreationNextStepViewModel(currentFlow),
        {
          advanceStep: async () => {
            events.push('advance')
          },
          reportError: (message) => events.push(message),
          resolveBackgroundCascadeSkill: () => {}
        }
      )
    )

    assert.equal(node.className, 'creation-next-step')
    assert.equal(node.children[0]?.textContent, 'Review')
    assert.equal(node.children[3]?.className, 'creation-next-step-actions')
    node.children[3]?.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(events, ['advance'])
  })

  it('renders primary step actions for skills and equipment', async () => {
    const events: string[] = []
    for (const flow of [completeFlow('skills'), completeFlow('equipment')]) {
      const node = asNode(
        renderCharacterCreationNextStep(
          document,
          deriveCharacterCreationNextStepViewModel(flow),
          {
            advanceStep: async () => {
              events.push(flow.step)
            },
            reportError: (message) => events.push(message),
            resolveBackgroundCascadeSkill: () => {}
          }
        )
      )

      const actions = findNode(
        node,
        (candidate) => candidate.className === 'creation-next-step-actions'
      )
      if (!actions) throw new Error('Expected next-step actions')
      actions.children[0]?.click()
      await Promise.resolve()
    }

    assert.deepEqual(events, ['skills', 'equipment'])
  })

  it('renders death restart controls when editable', async () => {
    const events: string[] = []
    const element = renderCharacterCreationDeath(document, deathFlow(), {
      readOnly: () => false,
      startNewCharacter: async () => {
        events.push('restart')
      },
      reportError: (message) => events.push(message)
    })
    if (!element) throw new Error('Expected death card')
    const node = asNode(element)

    assert.equal(node.className, 'creation-death-card')
    assert.equal(node.children[1]?.textContent, 'Killed in service')
    assert.equal(node.children[3]?.children[1]?.textContent, '5')
    node.children[4]?.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(events, ['restart'])
  })

  it('renders characteristic and basic training actions through callbacks', async () => {
    const events: string[] = []
    const characteristicElement =
      renderCharacterCreationCharacteristicRollButton(
        document,
        characteristicFlow(),
        {
          rollCharacteristic: async () => {
            events.push('characteristic')
          },
          reportError: (message) => events.push(message)
        }
      )
    if (!characteristicElement) {
      throw new Error('Expected characteristic roll button')
    }
    const characteristic = asNode(characteristicElement)
    assert.equal(characteristic.className, 'character-creation-roll-action')
    assert.equal(characteristic.children[0]?.textContent, 'Roll Str')
    characteristic.children[0]?.click()

    const trainingElement = renderCharacterCreationBasicTrainingButton(
      document,
      basicTrainingFlow(),
      {
        hasFlow: () => true,
        syncFields: () => events.push('sync'),
        completeBasicTraining: async () => {
          events.push('training')
        },
        reportError: (message) => events.push(`error:${message}`)
      }
    )
    if (!trainingElement) throw new Error('Expected basic training button')
    const training = asNode(trainingElement)
    assert.equal(training.className, 'character-creation-roll-action')
    assert.equal(training.children[0]?.textContent, 'Apply basic training')
    assert.equal(training.children[2]?.className, 'creation-training-skills')
    training.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(events, ['characteristic', 'sync', 'error:', 'training'])
  })

  it('suppresses repeated characteristic roll actions while a roll is pending', async () => {
    const events: string[] = []
    let resolveRoll: () => void = () => {}
    const characteristicElement =
      renderCharacterCreationCharacteristicRollButton(
        document,
        characteristicFlow(),
        {
          rollCharacteristic: () => {
            events.push('characteristic')
            return new Promise<void>((resolve) => {
              resolveRoll = resolve
            })
          },
          reportError: (message) => events.push(message)
        }
      )
    if (!characteristicElement) {
      throw new Error('Expected characteristic roll button')
    }

    const characteristic = asNode(characteristicElement)
    const button = characteristic.children[0]
    button?.click()
    button?.click()

    assert.deepEqual(events, ['characteristic'])
    assert.equal(button?.disabled, true)

    resolveRoll()
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(button?.disabled, false)
    button?.click()

    assert.deepEqual(events, ['characteristic', 'characteristic'])
  })

  it('renders draft fields, skill review, and delegated actions', () => {
    const flow = completeFlow('skills')
    const fragment = renderCharacterCreationDraftFields(document, flow, {
      renderCharacteristicRollButton: () => null,
      renderCareerRollButton: () => null,
      renderBasicTrainingButton: () => {
        const button = document.createElement('button')
        button.textContent = 'Training'
        return button
      },
      renderMusteringOut: () => {
        const panel = document.createElement('section')
        panel.textContent = 'Mustering'
        return panel
      }
    })
    const node = asNode(fragment)

    assert.equal(
      findNode(
        node,
        (candidate) => candidate.dataset.characterCreationField === 'skills'
      )?.value,
      'Pilot-1\nVacc Suit-0'
    )
    assert.deepEqual(
      findNode(
        node,
        (candidate) => candidate.className === 'creation-skill-review-list'
      )?.children.map((child) => child.textContent),
      ['Pilot-1', 'Vacc Suit-0']
    )
    assert.equal(
      node.children[node.children.length - 1]?.textContent,
      'Training'
    )
  })
})
