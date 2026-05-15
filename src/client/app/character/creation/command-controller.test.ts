import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId, asUserId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState,
  DiceRollState,
  GameState
} from '../../../../shared/state'
import type { CharacterCreationCommand } from '../../core/command-router'
import { createCharacterCreationCommandController } from './command-controller'
import {
  createManualCharacterCreationFlow,
  nextCharacterCreationWizardStep,
  type CharacterCreationFlow
} from './flow'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')

const diceRoll = (total = 9): DiceRollState => ({
  id: 'roll-1',
  actorId,
  createdAt: '2026-01-01T00:00:00.000Z',
  revealAt: '2026-01-01T00:00:01.000Z',
  expression: '2d6',
  reason: 'Characteristic roll',
  rolls: [4, total - 4],
  total
})

const stateWithDice = (roll: DiceRollState): GameState => ({
  id: gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: actorId,
  players: {
    [actorId]: { userId: actorId, role: 'REFEREE' }
  },
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [roll],
  selectedBoardId: null,
  eventSeq: 1
})

const stateWithDiceAndCharacter = (
  roll: DiceRollState,
  character: CharacterState
): GameState => ({
  ...stateWithDice(roll),
  characters: {
    [character.id]: character
  }
})

const characteristicFlow = (): CharacterCreationFlow =>
  nextCharacterCreationWizardStep(
    createManualCharacterCreationFlow({ name: 'Iona Vesh' })
  ).flow

const careerFlow = (): CharacterCreationFlow => {
  const flow = createManualCharacterCreationFlow({ name: 'Iona Vesh' })
  return {
    step: 'career',
    draft: {
      ...flow.draft,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      homeworld: {
        lawLevel: 'Low Law',
        tradeCodes: ['Industrial']
      },
      backgroundSkills: ['Admin-0', 'Gun Combat-0']
    }
  }
}

const failedQualificationFlow = (): CharacterCreationFlow => {
  const flow = careerFlow()
  return {
    step: 'career',
    draft: {
      ...flow.draft,
      careerPlan: {
        career: 'Rogue',
        drafted: false,
        qualificationRoll: 2,
        qualificationPassed: false,
        survivalRoll: null,
        survivalPassed: null,
        canCommission: null,
        commissionRoll: null,
        commissionPassed: null,
        canAdvance: null,
        advancementRoll: null,
        advancementPassed: null,
        termSkillRolls: []
      }
    }
  }
}

const projectedDraftCharacter = (
  flow: CharacterCreationFlow,
  creation: CharacterCreationProjection
): CharacterState => ({
  id: flow.draft.characterId,
  ownerId: actorId,
  type: 'PLAYER',
  name: flow.draft.name,
  active: true,
  notes: '',
  age: flow.draft.age,
  characteristics: flow.draft.characteristics,
  skills: [],
  equipment: [],
  credits: 0,
  creation
})

const projectedDraftCreation = (): CharacterCreationProjection => ({
  state: {
    status: 'BASIC_TRAINING',
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [
    {
      career: 'Navy',
      skills: [],
      skillsAndTraining: [],
      benefits: [],
      complete: false,
      canReenlist: true,
      completedBasicTraining: false,
      musteringOut: false,
      anagathics: false,
      draft: 1
    }
  ],
  careers: [{ name: 'Navy', rank: 0 }],
  canEnterDraft: false,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  homeworld: null,
  backgroundSkills: [],
  pendingCascadeSkills: [],
  history: [
    {
      type: 'SELECT_CAREER',
      isNewCareer: true,
      drafted: true
    }
  ]
})

const musteringFlow = (): CharacterCreationFlow => {
  const flow = careerFlow()
  return {
    step: 'career',
    draft: {
      ...flow.draft,
      completedTerms: [
        {
          career: 'Scout',
          drafted: false,
          age: 22,
          rank: 0,
          qualificationRoll: 8,
          survivalRoll: 9,
          survivalPassed: true,
          canCommission: false,
          commissionRoll: null,
          commissionPassed: null,
          canAdvance: false,
          advancementRoll: null,
          advancementPassed: null,
          termSkillRolls: []
        }
      ],
      skills: ['Vacc Suit-1'],
      musteringBenefits: []
    }
  }
}

const agingLossFlow = (): CharacterCreationFlow => {
  const flow = careerFlow()
  return {
    step: 'career',
    draft: {
      ...flow.draft,
      pendingAgingChanges: [{ type: 'PHYSICAL', modifier: -1 }],
      careerPlan: {
        career: 'Scout',
        drafted: false,
        qualificationRoll: 8,
        qualificationPassed: true,
        survivalRoll: 9,
        survivalPassed: true,
        canCommission: false,
        commissionRoll: null,
        commissionPassed: null,
        canAdvance: false,
        advancementRoll: null,
        advancementPassed: null,
        termSkillRolls: [
          {
            table: 'serviceSkills',
            roll: 1,
            skill: 'Pilot-1'
          },
          {
            table: 'personalDevelopment',
            roll: 2,
            skill: 'Vacc Suit-1'
          }
        ],
        anagathics: false,
        agingRoll: 3,
        agingMessage: '1 characteristic change',
        agingSelections: [],
        reenlistmentRoll: null,
        reenlistmentOutcome: null
      }
    }
  }
}

describe('character creation command controller', () => {
  it('does not publish when no editable flow exists', async () => {
    const commands: CharacterCreationCommand[] = []
    const controller = createCharacterCreationCommandController({
      getFlow: () => null,
      setFlow: () => {},
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        return { state: null }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {},
      scrollToTop: () => {}
    })

    await controller.rollCharacteristic()

    assert.deepEqual(commands, [])
  })

  it('syncs completed term choices from the accepted projection', async () => {
    const flow = careerFlow()
    const commands: CharacterCreationCommand[] = []
    const synced: Array<{
      state: GameState | null
      characterId: string
      fallbackFlow: CharacterCreationFlow
    }> = []
    let rendered = 0
    let scrolled = 0

    const responseState: GameState = {
      ...stateWithDice(diceRoll()),
      characters: {
        [flow.draft.characterId]: projectedDraftCharacter(flow, {
          ...projectedDraftCreation(),
          state: {
            status: 'MUSTERING_OUT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          history: []
        })
      }
    }

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: () => {},
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        return { state: responseState }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: (state, characterId, fallbackFlow) => {
        synced.push({ state, characterId, fallbackFlow })
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        rendered += 1
      },
      scrollToTop: () => {
        scrolled += 1
      }
    })

    await controller.completeTerm(false)

    assert.equal(commands[0]?.type, 'LeaveCharacterCreationCareer')
    assert.equal(synced[0]?.state, responseState)
    assert.equal(synced[0]?.characterId, flow.draft.characterId)
    assert.equal(synced[0]?.fallbackFlow, flow)
    assert.equal(rendered, 1)
    assert.equal(scrolled, 1)
  })

  it('completes skills after resolving the final term cascade skill', async () => {
    const flow = careerFlow()
    const commands: CharacterCreationCommand[] = []
    const syncedStates: Array<GameState | null> = []
    const stateAfterCascade: GameState = {
      ...stateWithDice(diceRoll()),
      characters: {
        [flow.draft.characterId]: projectedDraftCharacter(flow, {
          state: {
            status: 'SKILLS_TRAINING',
            context: {
              canCommission: true,
              canAdvance: false
            }
          },
          terms: [
            {
              career: 'Rogue',
              skills: ['Natural Weapons-0'],
              skillsAndTraining: ['Natural Weapons-0'],
              benefits: [],
              complete: false,
              canReenlist: true,
              completedBasicTraining: true,
              musteringOut: false,
              anagathics: false,
              survival: 8
            }
          ],
          careers: [{ name: 'Rogue', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          pendingCascadeSkills: [],
          history: []
        })
      }
    }
    const creationAfterCascade =
      stateAfterCascade.characters[flow.draft.characterId].creation
    if (!creationAfterCascade) {
      throw new Error('Expected cascade fixture to include creation state')
    }
    const stateAfterComplete: GameState = {
      ...stateAfterCascade,
      characters: {
        [flow.draft.characterId]: {
          ...stateAfterCascade.characters[flow.draft.characterId],
          creation: {
            ...creationAfterCascade,
            state: {
              status: 'AGING',
              context: {
                canCommission: true,
                canAdvance: false
              }
            }
          }
        }
      }
    }
    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: () => {},
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        return {
          state:
            command.type === 'CompleteCharacterCreationSkills'
              ? stateAfterComplete
              : stateAfterCascade
        }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: (state) => {
        syncedStates.push(state)
        return flow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {},
      scrollToTop: () => {}
    })

    await controller.publishTermCascadeResolution(
      flow,
      'Melee Combat',
      'Natural Weapons',
      flow
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'ResolveCharacterCreationTermCascadeSkill',
        'CompleteCharacterCreationSkills'
      ]
    )
    assert.equal(
      syncedStates[0]?.characters[flow.draft.characterId]?.creation?.state
        .status,
      'AGING'
    )
  })

  it('rolls a characteristic, waits for reveal, and syncs fallback flow', async () => {
    let flow: CharacterCreationFlow | null = characteristicFlow()
    const commands: CharacterCreationCommand[] = []
    const waitedFor: string[] = []
    const syncedFallbacks: CharacterCreationFlow[] = []
    let renderCount = 0
    let scrollCount = 0
    const roll = diceRoll(10)

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        return { state: stateWithDice(roll) }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async (nextRoll) => {
        waitedFor.push(nextRoll.id)
      },
      syncFlowFromRoomState: (_state, _characterId, fallbackFlow) => {
        syncedFallbacks.push(fallbackFlow)
        flow = fallbackFlow
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        renderCount += 1
      },
      scrollToTop: () => {
        scrollCount += 1
      }
    })

    await controller.rollCharacteristic('str')

    assert.equal(commands[0]?.type, 'RollCharacterCreationCharacteristic')
    assert.equal(
      commands[0]?.type === 'RollCharacterCreationCharacteristic'
        ? commands[0].characteristic
        : null,
      'str'
    )
    assert.deepEqual(waitedFor, ['roll-1'])
    assert.equal(syncedFallbacks[0]?.draft.characteristics.str, 10)
    assert.equal(renderCount, 1)
    assert.equal(scrollCount, 1)
  })

  it('reports accepted characteristic commands without dice results', async () => {
    const errors: string[] = []
    const controller = createCharacterCreationCommandController({
      getFlow: characteristicFlow,
      setFlow: () => {},
      setError: (message) => {
        errors.push(message)
      },
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => ({ state: null }),
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {},
      scrollToTop: () => {}
    })

    await controller.rollCharacteristic('str')

    assert.deepEqual(errors, [
      '',
      'Characteristic roll did not return a dice result'
    ])
  })

  it('resolves career qualification, waits for reveal, and applies the fallback flow', async () => {
    let flow: CharacterCreationFlow | null = careerFlow()
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const waitedFor: string[] = []
    const roll = diceRoll(7)
    let published = 0
    let flushed = 0
    let renderCount = 0
    let scrollCount = 0

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {
        flushed += 1
      },
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: stateWithDice(roll) }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async (nextRoll) => {
        waitedFor.push(nextRoll.id)
      },
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        renderCount += 1
      },
      scrollToTop: () => {
        scrollCount += 1
      }
    })

    await controller.resolveCareerQualification('Merchant')

    assert.equal(flushed, 1)
    assert.equal(published, 1)
    assert.equal(commands[0]?.type, 'ResolveCharacterCreationQualification')
    assert.equal(
      commands[0]?.type === 'ResolveCharacterCreationQualification'
        ? commands[0].career
        : null,
      'Merchant'
    )
    assert.deepEqual(requestIds, ['resolve-character-qualification'])
    assert.deepEqual(waitedFor, ['roll-1'])
    assert.equal(flow?.draft.careerPlan?.career, 'Merchant')
    assert.equal(flow?.draft.careerPlan?.qualificationRoll, 7)
    assert.equal(flow?.draft.careerPlan?.qualificationPassed, true)
    assert.equal(renderCount, 1)
    assert.equal(scrollCount, 1)
  })

  it('keeps failed qualification fallback actions after dice reveal', async () => {
    let flow: CharacterCreationFlow | null = careerFlow()
    const roll = diceRoll(2)
    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => ({
        state: stateWithDice(roll)
      }),
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {},
      scrollToTop: () => {}
    })

    await controller.resolveCareerQualification('Rogue')

    assert.equal(flow?.draft.careerPlan?.career, 'Rogue')
    assert.equal(flow?.draft.careerPlan?.qualificationRoll, 2)
    assert.equal(flow?.draft.careerPlan?.qualificationPassed, false)
  })

  it('reports accepted qualification commands without dice results', async () => {
    const errors: string[] = []
    let waited = false
    let rendered = false
    let scrolled = false
    const controller = createCharacterCreationCommandController({
      getFlow: careerFlow,
      setFlow: () => {},
      setError: (message) => {
        errors.push(message)
      },
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => ({ state: null }),
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {
        waited = true
      },
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        rendered = true
      },
      scrollToTop: () => {
        scrolled = true
      }
    })

    await controller.resolveCareerQualification('Merchant')

    assert.deepEqual(errors, [
      '',
      'Qualification roll did not return a dice result'
    ])
    assert.equal(waited, false)
    assert.equal(rendered, false)
    assert.equal(scrolled, false)
  })

  it('syncs current room state and rerenders when qualification is rejected', async () => {
    const flow = careerFlow()
    const roomState = stateWithDice(diceRoll(6))
    const syncedFallbacks: CharacterCreationFlow[] = []
    let rendered = false
    let scrolled = false
    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: () => {},
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => roomState,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => {
        throw new Error('not allowed')
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: (state, characterId, fallbackFlow) => {
        assert.equal(state, roomState)
        assert.equal(characterId, flow.draft.characterId)
        syncedFallbacks.push(fallbackFlow)
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        rendered = true
      },
      scrollToTop: () => {
        scrolled = true
      }
    })

    let rejectedMessage = ''
    try {
      await controller.resolveCareerQualification('Merchant')
    } catch (error) {
      rejectedMessage = error instanceof Error ? error.message : String(error)
    }

    assert.equal(rejectedMessage, 'not allowed')
    assert.equal(syncedFallbacks[0], flow)
    assert.equal(rendered, true)
    assert.equal(scrolled, true)
  })

  it('enters Drifter after failed qualification and syncs rendered fallback flow', async () => {
    let flow: CharacterCreationFlow | null = failedQualificationFlow()
    const originalCharacterId = flow.draft.characterId
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const syncedFallbacks: CharacterCreationFlow[] = []
    let flushed = 0
    let published = 0
    let rendered = 0
    let scrolled = 0
    let waited = false

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {
        flushed += 1
      },
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: null }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {
        waited = true
      },
      syncFlowFromRoomState: (state, characterId, fallbackFlow) => {
        assert.equal(state, null)
        assert.equal(characterId, originalCharacterId)
        syncedFallbacks.push(fallbackFlow)
        flow = fallbackFlow
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        rendered += 1
      },
      scrollToTop: () => {
        scrolled += 1
      }
    })

    await controller.resolveFailedQualificationOption('Drifter')

    assert.equal(flushed, 1)
    assert.equal(published, 1)
    assert.deepEqual(commands[0], {
      type: 'EnterCharacterCreationDrifter',
      gameId,
      actorId,
      characterId: originalCharacterId,
      option: 'Drifter'
    })
    assert.deepEqual(requestIds, ['enter-character-drifter'])
    assert.equal(waited, false)
    assert.equal(syncedFallbacks[0]?.draft.careerPlan?.career, 'Drifter')
    assert.equal(
      syncedFallbacks[0]?.draft.careerPlan?.qualificationPassed,
      true
    )
    assert.equal(syncedFallbacks[0]?.draft.careerPlan?.drafted, false)
    assert.equal(flow?.draft.careerPlan?.career, 'Drifter')
    assert.equal(rendered, 1)
    assert.equal(scrolled, 1)
  })

  it('rolls Draft after failed qualification, waits for reveal, and syncs projected fallback flow', async () => {
    let flow: CharacterCreationFlow | null = failedQualificationFlow()
    const originalCharacterId = flow.draft.characterId
    const roll = diceRoll(4)
    const roomState = stateWithDiceAndCharacter(
      roll,
      projectedDraftCharacter(flow, projectedDraftCreation())
    )
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const waitedFor: string[] = []
    const syncedFallbacks: CharacterCreationFlow[] = []
    let flushed = 0
    let published = 0
    let rendered = 0
    let scrolled = 0

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {
        flushed += 1
      },
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: roomState }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async (nextRoll) => {
        waitedFor.push(nextRoll.id)
      },
      syncFlowFromRoomState: (state, characterId, fallbackFlow) => {
        assert.equal(state, roomState)
        assert.equal(characterId, originalCharacterId)
        syncedFallbacks.push(fallbackFlow)
        flow = fallbackFlow
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        rendered += 1
      },
      scrollToTop: () => {
        scrolled += 1
      }
    })

    await controller.resolveFailedQualificationOption('Draft')

    assert.equal(flushed, 1)
    assert.equal(published, 1)
    assert.deepEqual(commands[0], {
      type: 'ResolveCharacterCreationDraft',
      gameId,
      actorId,
      characterId: originalCharacterId
    })
    assert.deepEqual(requestIds, ['resolve-character-draft'])
    assert.deepEqual(waitedFor, ['roll-1'])
    assert.equal(
      roomState.characters[originalCharacterId]?.creation?.terms[0]?.career,
      'Navy'
    )
    assert.equal(syncedFallbacks[0]?.draft.careerPlan?.career, 'Navy')
    assert.equal(syncedFallbacks[0]?.draft.careerPlan?.qualificationRoll, 4)
    assert.equal(
      syncedFallbacks[0]?.draft.careerPlan?.qualificationPassed,
      true
    )
    assert.equal(syncedFallbacks[0]?.draft.careerPlan?.drafted, true)
    assert.equal(flow?.draft.careerPlan?.career, 'Navy')
    assert.equal(rendered, 1)
    assert.equal(scrolled, 1)
  })

  it('decides anagathics through the semantic command and syncs fallback flow', async () => {
    let flow: CharacterCreationFlow | null = {
      ...careerFlow(),
      draft: {
        ...careerFlow().draft,
        careerPlan: {
          career: 'Merchant',
          drafted: false,
          qualificationRoll: 7,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: false,
          commissionRoll: null,
          commissionPassed: null,
          canAdvance: false,
          advancementRoll: null,
          advancementPassed: null,
          termSkillRolls: [
            {
              table: 'serviceSkills',
              roll: 1,
              skill: 'Broker-1'
            },
            {
              table: 'personalDevelopment',
              roll: 2,
              skill: 'Dex +1'
            }
          ],
          anagathics: null,
          agingRoll: null,
          agingSelections: [],
          reenlistmentRoll: null,
          reenlistmentOutcome: null
        }
      }
    }
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const syncedFallbacks: CharacterCreationFlow[] = []
    let published = 0
    let renderCount = 0
    let scrollCount = 0

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: null }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: (_state, _characterId, fallbackFlow) => {
        syncedFallbacks.push(fallbackFlow)
        flow = fallbackFlow
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        renderCount += 1
      },
      scrollToTop: () => {
        scrollCount += 1
      }
    })

    await controller.decideAnagathics(false)

    assert.equal(published, 1)
    assert.deepEqual(commands[0], {
      type: 'DecideCharacterCreationAnagathics',
      gameId,
      actorId,
      characterId: flow?.draft.characterId,
      useAnagathics: false
    })
    assert.deepEqual(requestIds, ['anagathics-decision'])
    assert.equal(syncedFallbacks[0]?.draft.careerPlan?.anagathics, false)
    assert.equal(renderCount, 1)
    assert.equal(scrollCount, 1)
  })

  it('posts projected term skill rolls without locally vetoing the table', async () => {
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const errors: string[] = []
    let published = 0

    const controller = createCharacterCreationCommandController({
      getFlow: careerFlow,
      setFlow: () => {},
      setError: (message) => {
        errors.push(message)
      },
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: null }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {},
      scrollToTop: () => {}
    })

    await controller.rollTermSkill('serviceSkills')

    assert.equal(published, 1)
    assert.equal(commands[0]?.type, 'RollCharacterCreationTermSkill')
    assert.equal(
      commands[0]?.type === 'RollCharacterCreationTermSkill'
        ? commands[0].table
        : null,
      'serviceSkills'
    )
    assert.deepEqual(requestIds, ['term-skill-roll'])
    assert.deepEqual(errors, [
      '',
      'Term skill roll did not return a dice result'
    ])
  })

  it('submits aging loss choices through the semantic command without local mutation', async () => {
    let flow: CharacterCreationFlow | null = agingLossFlow()
    const originalFlow = flow
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const syncedFallbacks: CharacterCreationFlow[] = []
    let published = 0
    let renderCount = 0
    let scrollCount = 0

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: null }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: (_state, _characterId, fallbackFlow) => {
        syncedFallbacks.push(fallbackFlow)
        flow = fallbackFlow
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        renderCount += 1
      },
      scrollToTop: () => {
        scrollCount += 1
      }
    })

    await controller.resolveAgingLoss(0, 'str')

    const command = commands[0] as unknown as {
      type: string
      characterId: string
      selectedLosses: unknown[]
    }
    assert.equal(published, 1)
    assert.deepEqual(command, {
      type: 'ResolveCharacterCreationAgingLosses',
      gameId,
      actorId,
      characterId: originalFlow.draft.characterId,
      selectedLosses: [
        {
          type: 'PHYSICAL',
          modifier: -1,
          characteristic: 'str'
        }
      ]
    })
    assert.deepEqual(requestIds, ['aging-losses'])
    assert.equal(syncedFallbacks[0], originalFlow)
    assert.equal(flow?.draft.characteristics.str, 7)
    assert.deepEqual(flow?.draft.pendingAgingChanges, [
      { type: 'PHYSICAL', modifier: -1 }
    ])
    assert.deepEqual(flow?.draft.careerPlan?.agingSelections, [])
    assert.equal(renderCount, 1)
    assert.equal(scrollCount, 1)
  })

  it('collects aging loss choices locally before submitting all losses', async () => {
    let flow: CharacterCreationFlow | null = {
      ...agingLossFlow(),
      draft: {
        ...agingLossFlow().draft,
        pendingAgingChanges: [
          { type: 'PHYSICAL', modifier: -1 },
          { type: 'PHYSICAL', modifier: -1 }
        ]
      }
    }
    const commands: CharacterCreationCommand[] = []
    let renderCount = 0
    let published = 0

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        return { state: null }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {},
      syncFlowFromRoomState: () => flow,
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        renderCount += 1
      },
      scrollToTop: () => {}
    })

    await controller.resolveAgingLoss(0, 'str')

    assert.equal(published, 0)
    assert.deepEqual(commands, [])
    assert.equal(flow?.draft.characteristics.str, 7)
    assert.deepEqual(flow?.draft.pendingAgingChanges, [
      { type: 'PHYSICAL', modifier: -1 },
      { type: 'PHYSICAL', modifier: -1 }
    ])
    assert.deepEqual(flow?.draft.careerPlan?.agingSelections, [
      { type: 'PHYSICAL', modifier: -1, characteristic: 'str' }
    ])
    assert.equal(renderCount, 1)
  })

  it('rolls a semantic mustering benefit, waits for reveal, and syncs fallback flow', async () => {
    let flow: CharacterCreationFlow | null = musteringFlow()
    const commands: CharacterCreationCommand[] = []
    const requestIds: string[] = []
    const waitedFor: string[] = []
    const syncedFallbacks: CharacterCreationFlow[] = []
    const roll = diceRoll(7)
    let published = 0
    let renderCount = 0
    let scrollCount = 0

    const controller = createCharacterCreationCommandController({
      getFlow: () => flow,
      setFlow: (nextFlow) => {
        flow = nextFlow
      },
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {
        published += 1
      },
      postCharacterCreationCommand: async (command, requestId) => {
        commands.push(command)
        requestIds.push(requestId)
        return { state: stateWithDice(roll) }
      },
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async (nextRoll) => {
        waitedFor.push(nextRoll.id)
      },
      syncFlowFromRoomState: (_state, _characterId, fallbackFlow) => {
        syncedFallbacks.push(fallbackFlow)
        flow = fallbackFlow
        return fallbackFlow
      },
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        renderCount += 1
      },
      scrollToTop: () => {
        scrollCount += 1
      }
    })

    await controller.rollMusteringBenefit('material')

    assert.equal(published, 1)
    assert.equal(commands[0]?.type, 'RollCharacterCreationMusteringBenefit')
    assert.equal(
      commands[0]?.type === 'RollCharacterCreationMusteringBenefit'
        ? commands[0].career
        : null,
      'Scout'
    )
    assert.equal(
      commands[0]?.type === 'RollCharacterCreationMusteringBenefit'
        ? commands[0].kind
        : null,
      'material'
    )
    assert.deepEqual(requestIds, ['mustering-roll'])
    assert.deepEqual(waitedFor, ['roll-1'])
    assert.deepEqual(syncedFallbacks[0]?.draft.musteringBenefits, [
      {
        career: 'Scout',
        kind: 'material',
        roll: 7,
        value: '-',
        credits: 0
      }
    ])
    assert.equal(renderCount, 1)
    assert.equal(scrollCount, 1)
  })

  it('reports accepted mustering benefit commands without dice results', async () => {
    const errors: string[] = []
    let waited = false
    let rendered = false
    let scrolled = false
    const controller = createCharacterCreationCommandController({
      getFlow: musteringFlow,
      setFlow: () => {},
      setError: (message) => {
        errors.push(message)
      },
      isReadOnly: () => false,
      syncFields: () => {},
      getState: () => null,
      flushHomeworldProgress: async () => {},
      ensurePublished: async () => {},
      postCharacterCreationCommand: async () => ({ state: null }),
      commandIdentity: () => ({ gameId, actorId }),
      requestId: (scope) => scope,
      waitForDiceRevealOrDelay: async () => {
        waited = true
      },
      syncFlowFromRoomState: () => null,
      autoAdvanceSetup: () => false,
      renderWizard: () => {
        rendered = true
      },
      scrollToTop: () => {
        scrolled = true
      }
    })

    await controller.rollMusteringBenefit('cash')

    assert.deepEqual(errors, [
      '',
      'Mustering roll did not return a dice result'
    ])
    assert.equal(waited, false)
    assert.equal(rendered, false)
    assert.equal(scrolled, false)
  })
})
