import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Command } from '../../shared/commands'
import {
  createCareerCreationState,
  type CareerCreationStatus
} from '../../shared/characterCreation'
import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type {
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  CharacterState,
  GameState
} from '../../shared/state'
import { deriveEventsForCommand, type CommandContext } from './command'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')
const characterId = asCharacterId('char-1')

const homeworld: CharacterCreationHomeworld = {
  name: 'Regina',
  lawLevel: 'No Law',
  tradeCodes: ['Asteroid']
}

const createCreation = (
  status: CareerCreationStatus,
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: createCareerCreationState(status),
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: status === 'PLAYABLE',
  homeworld: null,
  backgroundSkills: [],
  pendingCascadeSkills: [],
  history: [],
  ...overrides
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

const runCommand = (
  command: Command,
  creation: CharacterCreationProjection | null
) => {
  const context: CommandContext = {
    state: createState(creation),
    currentSeq: 1,
    nextSeq: 2,
    gameSeed: 1234
  }

  return deriveEventsForCommand(command, context)
}

describe('deriveEventsForCommand error categories', () => {
  it('returns not_allowed when setting a homeworld after homeworld selection', () => {
    const result = runCommand(
      {
        type: 'SetCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        homeworld
      },
      createCreation('CAREER_SELECTION', { homeworld })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'not_allowed')
    assert.equal(
      result.error.message,
      'Homeworld cannot be set from CAREER_SELECTION'
    )
  })

  it('returns not_allowed when selecting background skills before a homeworld exists', () => {
    const result = runCommand(
      {
        type: 'SelectCharacterCreationBackgroundSkill',
        gameId,
        actorId,
        characterId,
        skill: 'Vacc Suit'
      },
      createCreation('HOMEWORLD')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'not_allowed')
    assert.equal(
      result.error.message,
      'Homeworld must be set before background choices'
    )
  })

  it('returns not_allowed when resolving background choices outside homeworld', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Pistol'
      },
      createCreation('CAREER_SELECTION', {
        homeworld,
        pendingCascadeSkills: ['Gun Combat-0']
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'not_allowed')
    assert.equal(
      result.error.message,
      'Background choices cannot change from CAREER_SELECTION'
    )
  })

  it('returns not_allowed for terminal character creation transitions', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'CREATION_COMPLETE' }
      },
      createCreation('PLAYABLE', { homeworld })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'not_allowed')
    assert.equal(
      result.error.message,
      'CREATION_COMPLETE is not valid from PLAYABLE'
    )
  })
})
