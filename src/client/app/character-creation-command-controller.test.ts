import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asGameId, asUserId } from '../../shared/ids'
import type { DiceRollState, GameState } from '../../shared/state'
import type { CharacterCreationCommand } from './app-command-router'
import { createCharacterCreationCommandController } from './character-creation-command-controller'
import {
  createManualCharacterCreationFlow,
  nextCharacterCreationWizardStep,
  type CharacterCreationFlow
} from './character-creation-flow'

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

const characteristicFlow = (): CharacterCreationFlow =>
  nextCharacterCreationWizardStep(
    createManualCharacterCreationFlow({ name: 'Iona Vesh' })
  ).flow

describe('character creation command controller', () => {
  it('does not publish when no editable flow exists', async () => {
    const commands: CharacterCreationCommand[] = []
    const controller = createCharacterCreationCommandController({
      getFlow: () => null,
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
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
      setError: () => {},
      isReadOnly: () => false,
      syncFields: () => {},
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
      setError: (message) => {
        errors.push(message)
      },
      isReadOnly: () => false,
      syncFields: () => {},
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
})
