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
import { deriveCharacterCreationViewModel } from './character-creation-view-model'
import type { CharacterCreationNextStepViewModel } from './character-creation-view'
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
        setFlow: (nextFlow) => nextFlow,
        viewModel: () =>
          deriveCharacterCreationViewModel({
            flow: null,
            projection: null,
            readOnly: false
          })
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
        setFlow: (nextFlow) => nextFlow,
        viewModel: () =>
          deriveCharacterCreationViewModel({
            flow: currentFlow,
            projection: null,
            readOnly: false
          })
      },
      panel: {
        render: (panelViewModel) => {
          assert.equal(panelViewModel.title, 'Iona Vesh')
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

  it('renders the next-step panel from the controller view model', () => {
    const els = elements()
    const currentFlow = flow()
    const baseViewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: null,
      readOnly: false
    })
    const sentinelNextStep = {
      ...baseViewModel.wizard?.nextStep,
      phase: 'Sentinel phase',
      prompt: 'Sentinel prompt'
    } as CharacterCreationNextStepViewModel
    const controller = createCharacterCreationRenderController({
      document: renderDocument(),
      elements: els,
      controller: {
        currentProjection: () => null,
        flow: () => currentFlow,
        readOnly: () => false,
        reconcileEditableWithProjection: () => currentFlow,
        setFlow: (nextFlow) => nextFlow,
        viewModel: () => ({
          ...baseViewModel,
          wizard: baseViewModel.wizard
            ? {
                ...baseViewModel.wizard,
                nextStep: sentinelNextStep
              }
            : null
        })
      },
      panel: {
        render: () => true,
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

    controller.renderWizard()

    const nextStep = asNode(els.characterCreationFields).children[0]
    assert.equal(nextStep?.children[0]?.textContent, 'Sentinel phase')
    assert.equal(nextStep?.children[1]?.textContent, 'Sentinel prompt')
  })

  it('renders the characteristic grid from the controller view model', () => {
    const els = elements()
    const currentFlow = {
      ...flow(),
      step: 'characteristics',
      draft: createInitialCharacterDraft(asCharacterId('render-sentinel'), {
        name: 'Sentinel',
        characteristics: {
          str: null,
          dex: null,
          end: null,
          int: null,
          edu: null,
          soc: null
        }
      })
    } satisfies CharacterCreationFlow
    const baseViewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: null,
      readOnly: false
    })
    const controller = createCharacterCreationRenderController({
      document: renderDocument(),
      elements: els,
      controller: {
        currentProjection: () => null,
        flow: () => currentFlow,
        readOnly: () => false,
        reconcileEditableWithProjection: () => currentFlow,
        setFlow: (nextFlow) => nextFlow,
        viewModel: () => ({
          ...baseViewModel,
          wizard: baseViewModel.wizard
            ? {
                ...baseViewModel.wizard,
                characteristics: {
                  open: true,
                  stats: [
                    {
                      key: 'str',
                      label: 'Sentinel Str',
                      value: '11',
                      modifier: '+1',
                      missing: false,
                      errors: [],
                      rollLabel: 'Roll sentinel'
                    }
                  ]
                }
              }
            : null
        })
      },
      panel: {
        render: () => true,
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

    controller.renderWizard()

    const fields = asNode(els.characterCreationFields)
    const grid = fields.children[1]?.children[0]
    assert.equal(grid?.className, 'creation-stat-grid dice-stat-grid')
    assert.equal(grid?.children.length, 1)
    assert.equal(grid?.children[0]?.children[0]?.textContent, 'Sentinel Str')
    assert.equal(grid?.children[0]?.children[1]?.children[0]?.textContent, '11')
  })

  it('renders homeworld fields from the controller view model', () => {
    const els = elements()
    const currentFlow = {
      ...flow(),
      step: 'homeworld',
      draft: createInitialCharacterDraft(asCharacterId('render-homeworld'), {
        name: 'Homeworld Sentinel',
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        }
      })
    } satisfies CharacterCreationFlow
    const baseViewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: null,
      readOnly: false
    })
    const controller = createCharacterCreationRenderController({
      document: renderDocument(),
      elements: els,
      controller: {
        currentProjection: () => null,
        flow: () => currentFlow,
        readOnly: () => false,
        reconcileEditableWithProjection: () => currentFlow,
        setFlow: (nextFlow) => nextFlow,
        viewModel: () => ({
          ...baseViewModel,
          wizard: baseViewModel.wizard
            ? {
                ...baseViewModel.wizard,
                homeworld: baseViewModel.wizard.homeworld
                  ? {
                      ...baseViewModel.wizard.homeworld,
                      fields: [
                        {
                          key: 'homeworld.lawLevel',
                          label: 'Sentinel law',
                          kind: 'text',
                          step: 'homeworld',
                          value: 'Sentinel Law',
                          required: true,
                          errors: []
                        }
                      ],
                      lawLevelOptions: [
                        {
                          value: 'Sentinel Law',
                          label: 'Sentinel Law',
                          selected: true
                        }
                      ],
                      tradeCodeOptions: []
                    }
                  : null
              }
            : null
        })
      },
      panel: {
        render: () => true,
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

    controller.renderWizard()

    const homeworld = asNode(els.characterCreationFields).children[1]
      ?.children[0]
    const fieldGrid = homeworld?.children[0]
    const lawField = fieldGrid?.children[0]
    assert.equal(homeworld?.className, 'creation-homeworld')
    assert.equal(lawField?.children[0]?.textContent, 'Sentinel law *')
    assert.equal(
      lawField?.children[1]?.children[1]?.textContent,
      'Sentinel Law'
    )
  })

  it('disables local-only wizard actions for read-only spectator flows', () => {
    const els = elements()
    const currentFlow = {
      ...flow(),
      step: 'basics'
    } satisfies CharacterCreationFlow
    const controller = createCharacterCreationRenderController({
      document: renderDocument(),
      elements: els,
      controller: {
        currentProjection: () => null,
        flow: () => currentFlow,
        readOnly: () => true,
        reconcileEditableWithProjection: () => currentFlow,
        setFlow: (nextFlow) => nextFlow,
        viewModel: () =>
          deriveCharacterCreationViewModel({
            flow: currentFlow,
            projection: null,
            readOnly: true
          })
      },
      panel: {
        render: () => true,
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

    controller.renderWizard()

    const controls = asNode(els.characterCreationFields).querySelectorAll(
      'button, input, select, textarea'
    )
    assert.equal(controls.length > 0, true)
    assert.deepEqual(
      controls.map((control) => control.disabled),
      controls.map(() => true)
    )
    assert.equal(
      asNode(els.characterCreationWizard).classList.contains('read-only'),
      true
    )
  })
})
