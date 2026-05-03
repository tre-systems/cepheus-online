import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BoardId, GameId, PieceId, UserId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import {
  generateCharacterPreview,
  planCreatePlayableCharacterCommands,
  planGeneratePlayableCharacterCommands
} from './character-command-plan'

const identity = {
  gameId: 'demo-room' as GameId,
  actorId: 'local-user' as UserId
}

const board: BoardState = {
  id: 'main-board' as BoardId,
  name: 'Main Board',
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {}
}

const piece = (id: string): PieceState => ({
  id: id as PieceId,
  boardId: board.id,
  characterId: null,
  imageAssetId: null,
  name: id,
  x: 0,
  y: 0,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const state = (overrides: Partial<GameState> = {}): GameState => ({
  id: identity.gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: identity.actorId,
  players: {},
  characters: {},
  boards: {
    [board.id]: board
  },
  pieces: {},
  diceLog: [],
  selectedBoardId: board.id,
  eventSeq: 20,
  ...overrides
})

const validInput = (overrides = {}) => ({
  identity,
  state: state(),
  board,
  name: 'Mae',
  characterType: 'PLAYER' as const,
  age: 30,
  characteristics: {
    str: 7,
    dex: 8,
    end: 7,
    int: 9,
    edu: 8,
    soc: 6
  },
  skills: ['Gun Combat-0', 'Vacc Suit-0'],
  equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
  credits: 1200,
  notes: 'Ready for travel.',
  createLinkedPiece: true,
  existingPieceCount: 0,
  ...overrides
})

describe('character command planner', () => {
  it('builds a playable character command sequence with a linked token', () => {
    const plan = planCreatePlayableCharacterCommands(validInput())

    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.characterId, 'mae-1')
    assert.equal(plan.pieceId, 'mae-1')
    assert.deepEqual(
      plan.commands.map((command) => command.type),
      [
        'CreateCharacter',
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation',
        'UpdateCharacterSheet',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'CreatePiece'
      ]
    )
    assert.deepEqual(
      plan.commands.map((command) => command.expectedSeq),
      [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]
    )
    const finalCreationEventCommand = plan.commands.at(-2)
    assert.equal(finalCreationEventCommand?.type, 'AdvanceCharacterCreation')
    if (finalCreationEventCommand?.type !== 'AdvanceCharacterCreation') return
    assert.equal(
      finalCreationEventCommand.creationEvent.type,
      'CREATION_COMPLETE'
    )
    const pieceCommand = plan.commands.at(-1)
    assert.equal(pieceCommand?.type, 'CreatePiece')
    if (pieceCommand?.type !== 'CreatePiece') return
    assert.equal(pieceCommand.characterId, plan.characterId)
    assert.equal(pieceCommand.x, 160)
    assert.equal(pieceCommand.y, 140)
  })

  it('can create a playable character without a linked token', () => {
    const plan = planCreatePlayableCharacterCommands(
      validInput({ board: null, createLinkedPiece: false })
    )

    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.pieceId, null)
    assert.equal(plan.commands.at(-1)?.type, 'AdvanceCharacterCreation')
  })

  it('uses existing entity counts for ids and token placement', () => {
    const plan = planCreatePlayableCharacterCommands(
      validInput({
        state: state({
          pieces: {
            ['mae-1' as PieceId]: piece('mae-1')
          }
        }),
        existingPieceCount: 1
      })
    )

    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.characterId, 'mae-1')
    assert.equal(plan.pieceId, 'mae-2')
    const pieceCommand = plan.commands.at(-1)
    assert.equal(pieceCommand?.type, 'CreatePiece')
    if (pieceCommand?.type !== 'CreatePiece') return
    assert.equal(pieceCommand.x, 218)
  })

  it('rejects missing state, blank names, and empty skills', () => {
    assert.deepEqual(
      planCreatePlayableCharacterCommands(validInput({ state: null })),
      {
        ok: false,
        error: 'Open or create a room before creating a character',
        focus: null
      }
    )
    assert.deepEqual(
      planCreatePlayableCharacterCommands(validInput({ name: ' ' })),
      {
        ok: false,
        error: 'Character name is required',
        focus: 'name'
      }
    )
    assert.deepEqual(
      planCreatePlayableCharacterCommands(validInput({ skills: [] })),
      {
        ok: false,
        error: 'At least one skill is required',
        focus: 'skills'
      }
    )
  })

  it('generates a playable character from dice rolls and career tables', () => {
    const rolls = [
      0.5,
      0.5, // str 8
      0.5,
      0.5, // dex 8
      0.5,
      0.5, // end 8
      0.5,
      0.5, // int 8
      0.5,
      0.5, // edu 8
      0.5,
      0.5, // soc 8
      0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      0.5, // career shuffle
      0.5,
      0.5, // qualification
      0.5, // training table
      0.5, // training entry
      0.5,
      0.5, // survival
      0.5,
      0.5, // commission/advancement when present
      0.5 // cash
    ]
    let index = 0
    const plan = planGeneratePlayableCharacterCommands(
      validInput({
        name: '',
        rng: () => rolls[index++] ?? 0.5
      })
    )

    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.generated.age, 22)
    assert.equal(plan.generated.characteristics.str, 8)
    assert.equal(plan.generated.skills.length > 0, true)
    assert.equal(plan.generated.notes.includes('Generated by'), true)
    assert.equal(plan.commands[0]?.type, 'CreateCharacter')
    const termCommand = plan.commands.find(
      (command) => command.type === 'StartCharacterCareerTerm'
    )
    assert.equal(termCommand?.type, 'StartCharacterCareerTerm')
    if (termCommand?.type !== 'StartCharacterCareerTerm') return
    assert.equal(termCommand.career, plan.generated.career)
    assert.equal(plan.commands.at(-1)?.type, 'CreatePiece')
  })

  it('can accept a previously rolled character preview without rerolling', () => {
    const generated = generateCharacterPreview({
      state: state(),
      name: 'Preview Scout',
      rng: () => 0.5
    })
    const plan = planGeneratePlayableCharacterCommands(
      validInput({
        name: 'Ignored Name',
        generated,
        rng: () => {
          throw new Error('preview should not be rerolled')
        }
      })
    )

    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.generated.name, 'Preview Scout')
    const createCommand = plan.commands[0]
    assert.equal(createCommand?.type, 'CreateCharacter')
    if (createCommand?.type !== 'CreateCharacter') return
    assert.equal(createCommand.name, 'Preview Scout')
  })
})
