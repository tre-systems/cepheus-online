import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import {
  advanceCharacterCreationStep,
  applyParsedCharacterCreationDraftPatch,
  backCharacterCreationStep,
  backCharacterCreationWizardStep,
  characterCreationSteps,
  createCharacterCreationFlow,
  createInitialCharacterDraft,
  createManualCharacterCreationFlow,
  deriveCharacterCreationCommands,
  deriveCharacterSheetPatch,
  deriveCreateCharacterCommand,
  deriveInitialCharacterCreationStateCommands,
  deriveStartCharacterCareerTermCommand,
  deriveStartCharacterCreationCommand,
  deriveUpdateCharacterSheetCommand,
  nextCharacterCreationWizardStep,
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

  it('initializes a manual draft from room state and name defaults', () => {
    const existingCharacterId = asCharacterId('character-2')
    const roomState = {
      ...state,
      characters: {
        [existingCharacterId]: {
          id: existingCharacterId,
          ownerId: identity.actorId,
          type: 'PLAYER',
          name: 'Character 2',
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
          creation: null
        }
      }
    } satisfies GameState

    const defaultFlow = createManualCharacterCreationFlow({ state: roomState })
    assert.equal(defaultFlow.step, 'basics')
    assert.equal(defaultFlow.draft.name, 'Character 2')
    assert.equal(defaultFlow.draft.characterId, asCharacterId('character-2-2'))

    const namedFlow = createManualCharacterCreationFlow({
      state: roomState,
      name: '  Iona Vesh  ',
      characterType: 'NPC'
    })
    assert.equal(namedFlow.draft.name, 'Iona Vesh')
    assert.equal(namedFlow.draft.characterType, 'NPC')
    assert.equal(namedFlow.draft.characterId, asCharacterId('iona-vesh-2'))
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

  it('moves wizard steps with validation results', () => {
    const emptyFlow = createCharacterCreationFlow(characterId)
    const blocked = nextCharacterCreationWizardStep(emptyFlow)

    assert.equal(blocked.moved, false)
    assert.equal(blocked.flow.step, 'basics')
    assert.deepEqual(blocked.validation, {
      ok: false,
      step: 'basics',
      errors: ['Name is required']
    })

    const next = nextCharacterCreationWizardStep(
      updateCharacterCreationFields(emptyFlow, { name: 'Iona Vesh' })
    )
    assert.equal(next.moved, true)
    assert.equal(next.flow.step, 'characteristics')
    assert.deepEqual(next.validation, {
      ok: false,
      step: 'characteristics',
      errors: [
        'STR is required',
        'DEX is required',
        'END is required',
        'INT is required',
        'EDU is required',
        'SOC is required'
      ]
    })

    const back = backCharacterCreationWizardStep(next.flow)
    assert.equal(back.moved, true)
    assert.equal(back.flow.step, 'basics')
    assert.deepEqual(back.validation, {
      ok: true,
      step: 'basics',
      errors: []
    })
  })

  it('applies parsed draft patches with current-step validation', () => {
    const flow = createCharacterCreationFlow(characterId)
    const result = applyParsedCharacterCreationDraftPatch(flow, {
      name: 'Iona Vesh',
      age: 34,
      skills: ['Pilot-1', 'pilot-1', ' Vacc Suit-0 '],
      characteristics: { str: 7, dex: Number.NaN }
    })

    assert.equal(result.moved, false)
    assert.equal(result.flow.step, 'basics')
    assert.equal(result.flow.draft.name, 'Iona Vesh')
    assert.equal(result.flow.draft.age, 34)
    assert.deepEqual(result.flow.draft.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.deepEqual(result.validation, {
      ok: true,
      step: 'basics',
      errors: []
    })

    const characteristics = nextCharacterCreationWizardStep(result.flow)
    assert.deepEqual(characteristics.validation.errors, [
      'DEX must be a finite number',
      'END is required',
      'INT is required',
      'EDU is required',
      'SOC is required'
    ])
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

    const startCreationCommand = deriveStartCharacterCreationCommand(draft, {
      identity,
      state
    })
    assert.equal(startCreationCommand.type, 'StartCharacterCreation')
    assert.equal(startCreationCommand.characterId, characterId)
    assert.equal(startCreationCommand.expectedSeq, 12)

    const startTermCommand = deriveStartCharacterCareerTermCommand(draft, {
      identity,
      state
    })
    assert.equal(startTermCommand.type, 'StartCharacterCareerTerm')
    assert.equal(startTermCommand.characterId, characterId)
    assert.equal(startTermCommand.career, 'Scout')
    assert.equal(startTermCommand.expectedSeq, 12)
  })

  it('derives event-backed creation lifecycle commands with sequential expectedSeq', () => {
    assert.deepEqual(
      deriveInitialCharacterCreationStateCommands(completeDraft(), {
        identity,
        state: null
      }),
      []
    )

    const commands = deriveInitialCharacterCreationStateCommands(
      completeDraft(),
      {
        identity,
        state
      }
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation'
      ]
    )
    assert.deepEqual(
      commands.map((command) => command.expectedSeq),
      [12, 13, 14, 15, 16]
    )

    const events = commands
      .filter((command) => command.type === 'AdvanceCharacterCreation')
      .map((command) =>
        command.type === 'AdvanceCharacterCreation'
          ? command.creationEvent.type
          : null
      )
    assert.deepEqual(events, [
      'SET_CHARACTERISTICS',
      'COMPLETE_HOMEWORLD',
      'SELECT_CAREER'
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

    const unsequencedCommands = deriveCharacterCreationCommands(
      {
        step: 'review',
        draft: completeDraft()
      },
      { identity, state: null }
    )
    assert.deepEqual(unsequencedCommands, [])

    const commands = deriveCharacterCreationCommands(
      {
        step: 'review',
        draft: completeDraft()
      },
      { identity, state }
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'CreateCharacter',
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation',
        'UpdateCharacterSheet'
      ]
    )
    assert.deepEqual(
      commands.map((command) => command.expectedSeq),
      [12, 13, 14, 15, 16, 17, 18]
    )
  })
})
