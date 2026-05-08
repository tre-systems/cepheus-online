import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterCreationProjection, GameState } from '../../shared/state'
import type { CharacterCreationCommand } from './app-command-router'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import { createCharacterCreationPublicationController } from './character-creation-publication-controller'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')
const characterId = asCharacterId('char-1')

const creation = (): CharacterCreationProjection => ({
  state: {
    status: 'CHARACTERISTICS',
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  homeworld: null,
  backgroundSkills: [],
  pendingCascadeSkills: [],
  history: []
})

const flow = (): CharacterCreationFlow => ({
  step: 'characteristics',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Scout'
  })
})

const gameState = ({
  hasCharacter = false,
  hasCreation = false
}: {
  hasCharacter?: boolean
  hasCreation?: boolean
} = {}): GameState => ({
  id: gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: actorId,
  players: {},
  characters: hasCharacter
    ? {
        [characterId]: {
          id: characterId,
          ownerId: actorId,
          type: 'PLAYER',
          name: 'Scout',
          active: true,
          notes: '',
          age: null,
          characteristics: {
            str: null,
            dex: null,
            end: null,
            int: null,
            edu: null,
            soc: null
          },
          skills: [],
          equipment: [],
          credits: 0,
          creation: hasCreation ? creation() : null
        }
      }
    : {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 1
})

const createHarness = ({
  currentFlow = flow(),
  currentState = gameState(),
  readOnly = false
}: {
  currentFlow?: CharacterCreationFlow | null
  currentState?: GameState | null
  readOnly?: boolean
} = {}) => {
  let activeFlow = currentFlow
  let activeState = currentState
  let createGameCount = 0
  let error = ''
  const posted: CharacterCreationCommand[][] = []
  const controller = createCharacterCreationPublicationController({
    getFlow: () => activeFlow,
    getState: () => activeState,
    isReadOnly: () => readOnly,
    identity: () => ({ gameId, actorId }),
    createGame: async () => {
      createGameCount += 1
      activeState = gameState()
    },
    postCharacterCreationCommands: async (commands) => {
      posted.push([...commands])
    },
    reportError: (message) => {
      error = message
    }
  })

  return {
    controller,
    posted,
    get createGameCount() {
      return createGameCount
    },
    get error() {
      return error
    },
    setFlow: (nextFlow: CharacterCreationFlow | null) => {
      activeFlow = nextFlow
    },
    setState: (nextState: GameState | null) => {
      activeState = nextState
    }
  }
}

describe('character creation publication controller', () => {
  it('does not publish when there is no editable flow', async () => {
    const noFlow = createHarness({ currentFlow: null })
    await noFlow.controller.ensurePublished()
    assert.equal(noFlow.posted.length, 0)

    const readOnly = createHarness({ readOnly: true })
    await readOnly.controller.ensurePublished()
    assert.equal(readOnly.posted.length, 0)
  })

  it('creates a missing game before deriving create and start commands', async () => {
    const harness = createHarness({ currentState: null })

    await harness.controller.ensurePublished()

    assert.equal(harness.createGameCount, 1)
    assert.deepEqual(
      harness.posted[0]?.map((command) => command.type),
      ['CreateCharacter', 'StartCharacterCreation']
    )
  })

  it('publishes only commands missing from the current character state', async () => {
    const missingCreation = createHarness({
      currentState: gameState({ hasCharacter: true })
    })
    await missingCreation.controller.ensurePublished()
    assert.deepEqual(
      missingCreation.posted[0]?.map((command) => command.type),
      ['StartCharacterCreation']
    )

    const complete = createHarness({
      currentState: gameState({ hasCharacter: true, hasCreation: true })
    })
    await complete.controller.ensurePublished()
    assert.equal(complete.posted.length, 0)
  })

  it('dedupes concurrent publication calls and clears the in-flight promise', async () => {
    let releasePost: () => void = () => {
      throw new Error('Post was not started')
    }
    const posted: CharacterCreationCommand[][] = []
    const controller = createCharacterCreationPublicationController({
      getFlow: () => flow(),
      getState: () => gameState(),
      isReadOnly: () => false,
      identity: () => ({ gameId, actorId }),
      createGame: async () => {},
      postCharacterCreationCommands: async (commands) => {
        posted.push([...commands])
        if (posted.length === 1) {
          await new Promise<void>((resolve) => {
            releasePost = resolve
          })
        }
      },
      reportError: () => {}
    })

    const first = controller.ensurePublished()
    const second = controller.ensurePublished()
    assert.equal(posted.length, 1)
    releasePost()
    await Promise.all([first, second])

    await controller.ensurePublished()

    assert.equal(posted.length, 2)
  })

  it('reports publication errors and permits retry', async () => {
    let attempts = 0
    let error = ''
    const controller = createCharacterCreationPublicationController({
      getFlow: () => flow(),
      getState: () => gameState(),
      isReadOnly: () => false,
      identity: () => ({ gameId, actorId }),
      createGame: async () => {},
      postCharacterCreationCommands: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('Publish failed')
      },
      reportError: (message) => {
        error = message
      }
    })

    let rejected = false
    try {
      await controller.ensurePublished()
    } catch (error) {
      rejected = error instanceof Error && /Publish failed/.test(error.message)
    }
    assert.equal(rejected, true)
    assert.equal(error, 'Publish failed')

    await controller.ensurePublished()

    assert.equal(attempts, 2)
  })
})
