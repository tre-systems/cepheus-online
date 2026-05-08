import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { CharacterId } from '../../shared/ids'
import type { CharacterState, GameState } from '../../shared/state'
import {
  activeCreationSummaries,
  createCreationPresenceDock
} from './creation-presence-dock'
import { TestNode, testDocument } from './test-dom.test-helper'

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
  creation: CharacterState['creation'],
  ownerId = 'owner'
): CharacterState => ({
  id: asCharacterId(id),
  ownerId: asUserId(ownerId),
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

  it('auto-opens a single remote active creation read-only', () => {
    const active = character(
      'active',
      {
        state: { status: 'CHARACTERISTICS', context: creationContext },
        terms: [],
        careers: [],
        canEnterDraft: false,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false
      },
      'remote-player'
    )
    const opened: Array<{
      characterId: CharacterId
      readOnly: boolean
    }> = []
    const dock = new TestNode('section') as unknown as HTMLElement
    const characterCreator = new TestNode('aside') as unknown as HTMLElement
    const sheet = new TestNode('aside') as unknown as HTMLElement
    characterCreator.hidden = true

    const controller = createCreationPresenceDock({
      elements: {
        dock,
        characterCreator,
        sheet
      },
      getRoomId: () => 'game',
      getActorId: () => 'local-user',
      openCharacterCreationFollow: (characterId, options) => {
        opened.push({ characterId, readOnly: options.readOnly })
      },
      localStorage: new MapStorage()
    })

    controller.render(gameState({ active }))

    assert.deepEqual(opened, [
      {
        characterId: asCharacterId('active'),
        readOnly: true
      }
    ])
    assert.equal(dock.hidden, true)
  })

  it('keeps local or ambiguous creations in the clickable dock', () => {
    const previousDocument = globalThis.document
    globalThis.document = testDocument as unknown as Document
    const local = character(
      'local',
      {
        state: { status: 'CHARACTERISTICS', context: creationContext },
        terms: [],
        careers: [],
        canEnterDraft: false,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: false
      },
      'local-user'
    )
    const opened: CharacterId[] = []
    const dock = new TestNode('section') as unknown as HTMLElement
    const characterCreator = new TestNode('aside') as unknown as HTMLElement
    const sheet = new TestNode('aside') as unknown as HTMLElement
    characterCreator.hidden = true

    const controller = createCreationPresenceDock({
      elements: {
        dock,
        characterCreator,
        sheet
      },
      getRoomId: () => 'game',
      getActorId: () => 'local-user',
      openCharacterCreationFollow: (characterId) => opened.push(characterId),
      localStorage: new MapStorage()
    })

    try {
      controller.render(gameState({ local }))

      assert.deepEqual(opened, [])
      assert.equal(dock.hidden, false)
    } finally {
      globalThis.document = previousDocument
    }
  })
})

class MapStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}
