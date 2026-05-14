import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCareerCreationState } from '../../shared/characterCreation'
import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterCreationProjection, CharacterState, GameState } from '../../shared/state'
import { deriveCharacterCreationSetupEvents } from './character-creation-command-handlers'
import type { CommandContext } from './command-helpers'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')
const characterId = asCharacterId('char-1')

const createCreation = (): CharacterCreationProjection => ({
  state: createCareerCreationState(),
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

const createCharacter = (
  creation: CharacterCreationProjection | null
): CharacterState => ({
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
    edu: 8,
    soc: null
  },
  skills: [],
  equipment: [],
  credits: 0,
  creation
})

const createState = (
  creation: CharacterCreationProjection | null
): GameState => ({
  id: gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: actorId,
  players: {},
  characters: {
    [characterId]: createCharacter(creation)
  },
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 1
})

const context = (creation: CharacterCreationProjection | null): CommandContext => ({
  state: createState(creation),
  currentSeq: 1,
  nextSeq: 2,
  gameSeed: 1234
})

describe('character creation setup command handlers', () => {
  it('starts a server-backed character creation projection', () => {
    const result = deriveCharacterCreationSetupEvents(
      {
        type: 'StartCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(null)
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: createCareerCreationState(),
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
        }
      }
    ])
  })

  it('rejects deprecated generic character creation advancement', () => {
    const result = deriveCharacterCreationSetupEvents(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'COMPLETE_BASIC_TRAINING' }
      },
      context(createCreation())
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('deprecated'), true)
  })
})
