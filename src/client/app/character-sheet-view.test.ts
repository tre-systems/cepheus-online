import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  BoardId,
  CharacterId,
  GameId,
  PieceId,
  UserId
} from '../../shared/ids'
import type { CharacterState, GameState, PieceState } from '../../shared/state'
import {
  characterSheetEmptyLabels,
  characterSheetTabLabels,
  characterSheetTitle,
  characteristicRows,
  equipmentDisplayItems,
  equipmentFromText,
  equipmentText,
  selectedCharacter,
  skillRollReason
} from './character-sheet-view'

const characterId = 'scout-character' as CharacterId

const character = (
  overrides: Partial<CharacterState> = {}
): CharacterState => ({
  id: characterId,
  ownerId: null,
  type: 'PLAYER',
  name: 'Scout',
  active: true,
  notes: '',
  age: null,
  characteristics: {
    str: 6,
    dex: 8,
    end: null,
    int: 9,
    edu: 10,
    soc: null
  },
  skills: [],
  equipment: [],
  credits: 0,
  ...overrides
})

const piece = (overrides: Partial<PieceState> = {}): PieceState => ({
  id: 'scout-token' as PieceId,
  boardId: 'main-board' as BoardId,
  characterId,
  imageAssetId: null,
  name: 'Scout Token',
  x: 0,
  y: 0,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED',
  ...overrides
})

const gameState = (characters: GameState['characters']): GameState => ({
  id: 'game' as GameId,
  slug: 'game',
  name: 'Game',
  ownerId: 'owner' as UserId,
  players: {},
  characters,
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 0
})

describe('character sheet view helpers', () => {
  it('looks up the selected linked character from state and piece', () => {
    const scout = character()
    const state = gameState({ [characterId]: scout })

    assert.equal(selectedCharacter(state, piece()), scout)
  })

  it('falls back to null when the piece is unlinked or missing its character', () => {
    assert.equal(
      selectedCharacter(gameState({ [characterId]: character() }), null),
      null
    )
    assert.equal(
      selectedCharacter(gameState({}), piece({ characterId: characterId })),
      null
    )
    assert.equal(
      selectedCharacter(
        gameState({ [characterId]: character() }),
        piece({ characterId: null })
      ),
      null
    )
  })

  it('builds characteristic and equipment display values', () => {
    assert.deepEqual(characteristicRows(character()), [
      { key: 'str', label: 'Str', value: '6', inputValue: '6' },
      { key: 'dex', label: 'Dex', value: '8', inputValue: '8' },
      { key: 'end', label: 'End', value: '8', inputValue: '' },
      { key: 'int', label: 'Int', value: '9', inputValue: '9' },
      { key: 'edu', label: 'Edu', value: '10', inputValue: '10' },
      { key: 'soc', label: 'Soc', value: '6', inputValue: '' }
    ])

    const equipment = [
      { name: 'Laser Pistol', quantity: 1, notes: '3D6' },
      { name: 'Mesh', quantity: 2, notes: 'AR 5', carried: false }
    ]

    assert.deepEqual(equipmentDisplayItems(equipment), [
      {
        name: 'Laser Pistol',
        quantity: 1,
        notes: '3D6',
        carried: undefined,
        meta: 'x1'
      },
      {
        name: 'Mesh',
        quantity: 2,
        notes: 'AR 5',
        carried: false,
        meta: 'x2 stowed'
      }
    ])
    assert.equal(
      equipmentText(equipment),
      'Laser Pistol | 1 | 3D6\nMesh | 2 | AR 5'
    )
    assert.deepEqual(
      equipmentFromText('Laser Pistol | nope | 3D6\n\nMesh | 2'),
      [
        { name: 'Laser Pistol', quantity: 1, notes: '3D6' },
        { name: 'Mesh', quantity: 2, notes: '' }
      ]
    )
  })

  it('returns title, empty, tab, and roll reason labels', () => {
    assert.equal(characterSheetTitle(piece(), character()), 'Scout')
    assert.equal(characterSheetTitle(piece(), null), 'Scout Token')
    assert.equal(characterSheetTitle(null, null), 'No piece')
    assert.equal(characterSheetTabLabels.items, 'Items')
    assert.equal(characterSheetEmptyLabels.noActiveToken, 'No active token')
    assert.equal(
      characterSheetEmptyLabels.noEquipmentListed,
      'No equipment listed'
    )
    assert.equal(
      skillRollReason(piece(), character(), 'Recon-0'),
      'Scout: Recon-0'
    )
  })
})
