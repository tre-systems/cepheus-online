import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterState, GameState } from '../../shared/state'
import { activeCreationSummaries } from './creation-presence-dock'

const creationContext = {
  canCommission: false,
  canAdvance: false
}

const characteristics = {
  str: 8,
  dex: null,
  end: 7,
  int: null,
  edu: null,
  soc: null
}

const character = (
  id: string,
  creation: CharacterState['creation']
): CharacterState => ({
  id: asCharacterId(id),
  ownerId: asUserId('owner'),
  type: 'PLAYER',
  name: id,
  active: true,
  notes: '',
  age: null,
  characteristics,
  skills: [],
  equipment: [],
  credits: 0,
  creation
})

const gameState = (characters: Record<string, CharacterState>): GameState => ({
  id: asGameId('game'),
  slug: 'game',
  name: 'Game',
  ownerId: asUserId('owner'),
  players: {},
  characters,
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 0
})

describe('creation presence dock helpers', () => {
  it('summarizes active in-progress creation without completed characters', () => {
    const active = character('active', {
      state: { status: 'HOMEWORLD', context: creationContext },
      terms: [{ career: 'Scout' } as never],
      careers: [],
      canEnterDraft: false,
      failedToQualify: false,
      characteristicChanges: [],
      creationComplete: false
    })
    const complete = character('complete', {
      state: { status: 'PLAYABLE', context: creationContext },
      terms: [],
      careers: [],
      canEnterDraft: false,
      failedToQualify: false,
      characteristicChanges: [],
      creationComplete: true
    })

    const summaries = activeCreationSummaries(
      gameState({ active, complete }),
      new Set()
    )

    assert.deepEqual(summaries, [
      {
        id: asCharacterId('active'),
        name: 'active',
        ownerId: asUserId('owner'),
        status: 'HOMEWORLD',
        rolledCharacteristics: 2,
        terms: 1
      }
    ])
  })

  it('omits locally dismissed creation cards', () => {
    const active = character('active', {
      state: { status: 'CHARACTERISTICS', context: creationContext },
      terms: [],
      careers: [],
      canEnterDraft: false,
      failedToQualify: false,
      characteristicChanges: [],
      creationComplete: false
    })

    const summaries = activeCreationSummaries(
      gameState({ active }),
      new Set(['active'])
    )

    assert.deepEqual(summaries, [])
  })
})
