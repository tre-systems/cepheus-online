import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import {
  advanceCharacterCreationStep,
  backCharacterCreationStep,
  characterCreationSteps,
  createCharacterCreationFlow,
  createInitialCharacterDraft,
  deriveCharacterCreationCommands,
  deriveCharacterSheetPatch,
  deriveCreateCharacterCommand,
  deriveUpdateCharacterSheetCommand,
  updateCharacterCreationDraft,
  updateCharacterCreationFields,
  validateCurrentCharacterCreationStep
} from './character-creation-flow'

const identity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('user-1')
}

const characterId = asCharacterId('mustering-out-scout')

const state = {
  id: identity.gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: identity.actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 12
} satisfies GameState

const completeDraft = () =>
  createInitialCharacterDraft(characterId, {
    name: 'Iona Vesh',
    age: 34,
    characteristics: {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    },
    skills: ['Pilot-1', 'Vacc Suit-0'],
    equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
    credits: 1200,
    notes: 'Detached scout.'
  })

describe('character creation flow', () => {
  it('creates a blank player draft at the basics step', () => {
    const flow = createCharacterCreationFlow(characterId)

    assert.equal(flow.step, 'basics')
    assert.equal(flow.draft.characterId, characterId)
    assert.equal(flow.draft.characterType, 'PLAYER')
    assert.equal(flow.draft.name, '')
    assert.deepEqual(flow.draft.characteristics, {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: null,
      soc: null
    })
    assert.deepEqual(characterCreationSteps(), [
      'basics',
      'characteristics',
      'skills',
      'equipment',
      'review'
    ])
  })

  it('updates draft fields without mutating the original draft', () => {
    const draft = createInitialCharacterDraft(characterId, {
      skills: ['Pilot-1']
    })
    const updated = updateCharacterCreationDraft(draft, {
      name: '  Iona Vesh  ',
      characteristics: { str: 7, dex: 8 },
      skills: ['Pilot-1', 'pilot-1', ' Vacc Suit-0 ', ''],
      equipment: [
        { name: ' Vacc Suit ', quantity: 1, notes: ' Carried ' },
        { name: '', quantity: 2, notes: 'ignored' },
        { name: 'Medkit', quantity: 0, notes: '' }
      ]
    })

    assert.equal(draft.name, '')
    assert.deepEqual(draft.characteristics, {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: null,
      soc: null
    })
    assert.equal(updated.name, '  Iona Vesh  ')
    assert.deepEqual(updated.characteristics, {
      str: 7,
      dex: 8,
      end: null,
      int: null,
      edu: null,
      soc: null
    })
    assert.deepEqual(updated.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.deepEqual(updated.equipment, [
      { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
      { name: 'Medkit', quantity: 1, notes: '' }
    ])
  })

  it('ignores undefined patch fields from sparse form updates', () => {
    const draft = createInitialCharacterDraft(characterId, {
      name: 'Iona Vesh',
      age: 34,
      credits: 1200,
      notes: 'Detached scout.'
    })
    const updated = updateCharacterCreationDraft(draft, {
      age: undefined,
      credits: undefined,
      notes: undefined
    })

    assert.equal(updated.age, 34)
    assert.equal(updated.credits, 1200)
    assert.equal(updated.notes, 'Detached scout.')
  })

  it('blocks advancement until the current step is valid', () => {
    const emptyFlow = createCharacterCreationFlow(characterId)

    assert.deepEqual(validateCurrentCharacterCreationStep(emptyFlow), {
      ok: false,
      step: 'basics',
      errors: ['Name is required']
    })
    assert.equal(advanceCharacterCreationStep(emptyFlow).step, 'basics')

    const withName = updateCharacterCreationFields(emptyFlow, {
      name: 'Iona Vesh'
    })
    assert.equal(advanceCharacterCreationStep(withName).step, 'characteristics')
  })

  it('walks forward and back across the creation steps', () => {
    let flow = createCharacterCreationFlow(characterId, {
      name: 'Iona Vesh'
    })

    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'characteristics')
    flow = updateCharacterCreationFields(flow, {
      characteristics: completeDraft().characteristics
    })
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'skills')
    flow = updateCharacterCreationFields(flow, { skills: ['Pilot-1'] })
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'equipment')
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'review')
    assert.equal(advanceCharacterCreationStep(flow).step, 'review')
    assert.equal(backCharacterCreationStep(flow).step, 'equipment')
  })

  it('validates the review step against the whole draft', () => {
    const flow = {
      step: 'review' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        credits: -1
      })
    }

    assert.deepEqual(validateCurrentCharacterCreationStep(flow), {
      ok: false,
      step: 'review',
      errors: [
        'STR is required',
        'DEX is required',
        'END is required',
        'INT is required',
        'EDU is required',
        'SOC is required',
        'At least one skill is required',
        'Credits must be a non-negative number'
      ]
    })
  })

  it('derives sequenced create and sheet update commands from a valid draft', () => {
    const draft = completeDraft()

    const createCommand = deriveCreateCharacterCommand(draft, {
      identity,
      state
    })
    assert.equal(createCommand.type, 'CreateCharacter')
    assert.equal(createCommand.gameId, identity.gameId)
    assert.equal(createCommand.actorId, identity.actorId)
    assert.equal(createCommand.characterId, characterId)
    assert.equal(createCommand.characterType, 'PLAYER')
    assert.equal(createCommand.name, 'Iona Vesh')
    assert.equal(createCommand.expectedSeq, 12)

    const updateCommand = deriveUpdateCharacterSheetCommand(draft, {
      identity,
      state
    })
    assert.equal(updateCommand.type, 'UpdateCharacterSheet')
    assert.equal(updateCommand.characterId, characterId)
    assert.equal(updateCommand.expectedSeq, 12)
    assert.deepEqual(updateCommand.characteristics, draft.characteristics)
    assert.deepEqual(updateCommand.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.deepEqual(updateCommand.equipment, [
      { name: 'Vacc Suit', quantity: 1, notes: 'Carried' }
    ])
  })

  it('derives a detached sheet patch copy', () => {
    const draft = completeDraft()
    const patch = deriveCharacterSheetPatch(draft)

    assert.deepEqual(patch, {
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot-1', 'Vacc Suit-0'],
      equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Detached scout.'
    })

    patch.skills?.push('Mechanic-0')
    assert.deepEqual(draft.skills, ['Pilot-1', 'Vacc Suit-0'])
  })

  it('derives both creation commands only when the full flow is valid', () => {
    const invalidCommands = deriveCharacterCreationCommands(
      createCharacterCreationFlow(characterId),
      { identity, state }
    )
    assert.deepEqual(invalidCommands, [])

    const commands = deriveCharacterCreationCommands(
      {
        step: 'review',
        draft: completeDraft()
      },
      { identity, state }
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      ['CreateCharacter', 'UpdateCharacterSheet']
    )
  })
})
