import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterCreationCommandController } from './character-creation-command-controller'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  createCharacterCreationRenderController,
  type CharacterCreationRenderControllerElements,
  type CharacterCreationRenderControllerDeps
} from './character-creation-render-controller'
import { asNode, TestDocument, TestNode } from './test-dom.test-helper'

const flow = (): CharacterCreationFlow => ({
  step: 'review',
  draft: createInitialCharacterDraft(asCharacterId('render-controller-1'), {
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
    skills: ['Pilot-1'],
    equipment: [],
    credits: 1200,
    notes: 'Detached scout.'
  })
})

const elements = (): CharacterCreationRenderControllerElements => ({
  backCharacterWizard: new TestNode('button') as unknown as HTMLButtonElement,
  nextCharacterWizard: new TestNode('button') as unknown as HTMLButtonElement,
  creatorActions: new TestNode('div') as unknown as HTMLElement,
  characterCreationStatus: new TestNode('div') as unknown as HTMLElement,
  characterCreationSteps: new TestNode('div') as unknown as HTMLElement,
  characterCreationFields: new TestNode('div') as unknown as HTMLElement,
  characterCreationWizard: new TestNode('div') as unknown as HTMLElement
})

const renderDocument = (): CharacterCreationRenderControllerDeps['document'] =>
  new TestDocument() as unknown as CharacterCreationRenderControllerDeps['document']

const commandController = (): CharacterCreationCommandController => ({
  publishTermCascadeResolution: async () => {},
  rollCharacteristic: async () => {},
  resolveCareerQualification: async () => {},
  resolveFailedQualificationOption: async () => {},
  completeBasicTraining: async () => {},
  rollTermSkill: async () => {},
  rollMusteringBenefit: async () => {},
  rollReenlistment: async () => {},
  decideAnagathics: async () => {},
  rollAging: async () => {},
  resolveAgingLoss: async () => {},
  rollCareerCheck: async () => {}
})

describe('character creation render controller', () => {
  it('resets wizard controls without depending on app shell state', () => {
    const els = elements()
    asNode(els.characterCreationStatus).append(new TestNode('span'))
    const controller = createCharacterCreationRenderController({
      document: renderDocument(),
      elements: els,
      controller: {
        currentProjection: () => null,
        flow: () => null,
        readOnly: () => false,
        reconcileEditableWithProjection: () => null,
        setFlow: (nextFlow) => nextFlow
      },
      panel: {
        render: () => false,
        scrollToTop: () => {}
      },
      wizard: {
        advance: async () => {},
        autoAdvanceSetup: () => false,
        startNew: async () => {},
        syncFields: () => {}
      },
      homeworldPublisher: {
        publishBackgroundCascadeSelection: async () => {},
        publishProgress: async () => {},
        publishCascadeResolution: async () => {}
      },
      getCommandController: commandController,
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => ({}),
      commandIdentity: () => ({
        gameId: asGameId('game-1'),
        actorId: asUserId('actor-1')
      }),
      reportError: () => {}
    })

    controller.renderWizardControls()

    assert.equal(els.backCharacterWizard.disabled, true)
    assert.equal(els.nextCharacterWizard.hidden, true)
    assert.equal(els.creatorActions?.hidden, true)
    assert.equal(asNode(els.characterCreationStatus).children.length, 0)
  })

  it('renders the wizard from controller flow through the panel facade', () => {
    const els = elements()
    const currentFlow = flow()
    const calls: string[] = []
    const controller = createCharacterCreationRenderController({
      document: renderDocument(),
      elements: els,
      controller: {
        currentProjection: () => null,
        flow: () => currentFlow,
        readOnly: () => false,
        reconcileEditableWithProjection: () => {
          calls.push('reconcile')
          return currentFlow
        },
        setFlow: (nextFlow) => nextFlow
      },
      panel: {
        render: (panelFlow) => {
          assert.equal(panelFlow, currentFlow)
          calls.push('panel')
          return true
        },
        scrollToTop: () => {}
      },
      wizard: {
        advance: async () => {},
        autoAdvanceSetup: () => {
          calls.push('advance-setup')
          return false
        },
        startNew: async () => {},
        syncFields: () => {}
      },
      homeworldPublisher: {
        publishBackgroundCascadeSelection: async () => {},
        publishProgress: async () => {},
        publishCascadeResolution: async () => {}
      },
      getCommandController: commandController,
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => ({}),
      commandIdentity: () => ({
        gameId: asGameId('game-1'),
        actorId: asUserId('actor-1')
      }),
      reportError: () => {}
    })

    controller.renderWizard()

    assert.deepEqual(calls, ['reconcile', 'advance-setup', 'panel'])
    assert.equal(els.characterCreationWizard.hidden, false)
    assert.equal(asNode(els.characterCreationSteps).children.length, 0)
    assert.equal(asNode(els.characterCreationFields).children.length, 2)
    assert.equal(
      asNode(els.characterCreationFields).children[0]?.className,
      'creation-next-step'
    )
    assert.equal(
      asNode(els.characterCreationFields).children[1]?.className,
      'character-creation-review'
    )
  })
})
