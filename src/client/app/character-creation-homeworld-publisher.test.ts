import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterCreationProjection, GameState } from '../../shared/state'
import type { CharacterCreationCommand } from './app-command-router'
import {
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import { createCharacterCreationHomeworldPublisher } from './character-creation-homeworld-publisher'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')
const characterId = asCharacterId('char-1')

const creation = (
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: {
    status: 'HOMEWORLD',
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
  history: [],
  ...overrides
})

const stateWithCreation = (projected: CharacterCreationProjection): GameState => ({
  id: gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: actorId,
  players: {},
  characters: {
    [characterId]: {
      id: characterId,
      ownerId: actorId,
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: null,
      characteristics: {
        str: 7,
        dex: 7,
        end: 7,
        int: 7,
        edu: 8,
        soc: 7
      },
      skills: [],
      equipment: [],
      credits: 0,
      creation: projected
    }
  },
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 1
})

const homeworldFlow = (): CharacterCreationFlow => ({
  step: 'homeworld',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Scout',
    characteristics: {
      str: 7,
      dex: 7,
      end: 7,
      int: 7,
      edu: 8,
      soc: 7
    },
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Zero-G-0', 'Admin-0', 'Broker-0'],
    pendingCascadeSkills: []
  })
})

describe('character creation homeworld publisher', () => {
  it('ignores unavailable or read-only flows', async () => {
    const commands: CharacterCreationCommand[] = []
    const publisher = createCharacterCreationHomeworldPublisher({
      getState: () => stateWithCreation(creation()),
      isReadOnly: () => true,
      commandIdentity: () => ({ gameId, actorId }),
      ensurePublished: async () => {
        throw new Error('should not publish')
      },
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
      },
      requestId: (scope) => scope,
      setError: () => {
        throw new Error('should not report')
      }
    })

    await publisher.publishProgress(null)
    await publisher.publishProgress(homeworldFlow())

    assert.deepEqual(commands, [])
  })

  it('publishes homeworld progress and completes when projected choices are ready', async () => {
    const roomState = stateWithCreation(creation())
    const commands: CharacterCreationCommand[] = []
    const publisher = createCharacterCreationHomeworldPublisher({
      getState: () => roomState,
      isReadOnly: () => false,
      commandIdentity: () => ({ gameId, actorId }),
      ensurePublished: async () => {},
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        const projected = roomState.characters[characterId]?.creation
        if (!projected) return
        if (command.type === 'SetCharacterCreationHomeworld') {
          projected.homeworld = command.homeworld
        }
        if (command.type === 'SelectCharacterCreationBackgroundSkill') {
          projected.backgroundSkills = [
            ...(projected.backgroundSkills ?? []),
            command.skill
          ]
        }
      },
      requestId: (scope) => scope,
      setError: (message) => {
        throw new Error(message)
      }
    })

    await publisher.publishProgress(homeworldFlow())

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'SetCharacterCreationHomeworld',
        'SelectCharacterCreationBackgroundSkill',
        'SelectCharacterCreationBackgroundSkill',
        'SelectCharacterCreationBackgroundSkill',
        'CompleteCharacterCreationHomeworld'
      ]
    )
  })

  it('resolves pending cascade skills and republishes progress', async () => {
    const projected = creation({
      homeworld: {
        name: null,
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      },
      pendingCascadeSkills: ['Gun Combat-0']
    })
    const roomState = stateWithCreation(projected)
    const commands: CharacterCreationCommand[] = []
    const publisher = createCharacterCreationHomeworldPublisher({
      getState: () => roomState,
      isReadOnly: () => false,
      commandIdentity: () => ({ gameId, actorId }),
      ensurePublished: async () => {},
      postCharacterCreationCommand: async (command) => {
        commands.push(command)
        if (command.type === 'ResolveCharacterCreationCascadeSkill') {
          projected.pendingCascadeSkills = []
          projected.backgroundSkills = ['Slug Rifle-0', 'Admin-0', 'Broker-0']
        }
      },
      requestId: (scope) => scope,
      setError: (message) => {
        throw new Error(message)
      }
    })

    await publisher.publishCascadeResolution(
      homeworldFlow(),
      'Gun Combat-0',
      'Slug Rifle'
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'ResolveCharacterCreationCascadeSkill',
        'CompleteCharacterCreationHomeworld'
      ]
    )
  })
})
