import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createCareerCreationState,
  type CareerCreationEvent,
  type CareerCreationStatus,
  type CareerTerm
} from '../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import {
  asCharacterId,
  asEventId,
  asGameId,
  asNoteId,
  asUserId
} from '../../shared/ids'
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
  notes: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 1
})

const completedTerm = () => ({
  career: 'Scout',
  skills: ['Pilot-1'],
  skillsAndTraining: ['Pilot-1'],
  benefits: ['Low Passage'],
  complete: true,
  canReenlist: false,
  completedBasicTraining: true,
  musteringOut: true,
  anagathics: false
})

const mishapFact = (
  benefitEffect: 'forfeit_current_term' | 'lose_all'
): NonNullable<CareerTerm['facts']>['mishap'] => ({
  roll: {
    expression: '1d6' as const,
    rolls: [benefitEffect === 'lose_all' ? 4 : 2],
    total: benefitEffect === 'lose_all' ? 4 : 2
  },
  outcome: {
    career: 'Scout',
    roll: benefitEffect === 'lose_all' ? 4 : 2,
    id:
      benefitEffect === 'lose_all'
        ? 'dishonorable_discharge'
        : 'honorable_discharge',
    description:
      benefitEffect === 'lose_all'
        ? 'Dishonorably discharged from the service. Lose all benefits.'
        : 'Honorably discharged from the service.',
    discharge: benefitEffect === 'lose_all' ? 'dishonorable' : 'honorable',
    benefitEffect,
    debtCredits: 0,
    extraServiceYears: 0,
    injury: null
  }
})

const runCommand = (
  command: Parameters<typeof deriveEventsForCommand>[0],
  creation: CharacterCreationProjection | null,
  contextOverrides: Partial<Pick<CommandContext, 'gameSeed' | 'nextSeq'>> = {}
) => {
  const context: CommandContext = {
    state: createState(creation),
    currentSeq: 1,
    nextSeq: 2,
    gameSeed: 1234,
    ruleset: CEPHEUS_SRD_RULESET,
    ...contextOverrides
  }

  return deriveEventsForCommand(command, context)
}

const finalizeCommand = () => ({
  type: 'FinalizeCharacterCreation' as const,
  gameId,
  actorId,
  characterId,
  notes: 'client notes',
  age: 99,
  characteristics: {
    str: 15,
    dex: 15,
    end: 15,
    int: 15,
    edu: 15,
    soc: 15
  },
  skills: ['Impossible-9'],
  equipment: [{ name: 'Yacht', quantity: 1, notes: 'Forged' }],
  credits: 999999
})

describe('deriveEventsForCommand error categories', () => {
  it('derives referee-owned note lifecycle events', () => {
    const noteId = asNoteId('note-1')
    const create = runCommand(
      {
        type: 'CreateNote',
        gameId,
        actorId,
        noteId,
        title: 'Patron Lead',
        body: '',
        visibility: 'PLAYERS'
      },
      null
    )

    assert.equal(create.ok, true)
    if (!create.ok) return
    assert.deepEqual(create.value, [
      {
        type: 'NoteCreated',
        noteId,
        title: 'Patron Lead',
        body: '',
        visibility: 'PLAYERS',
        ownerId: actorId
      }
    ])

    const state = createState(null)
    state.notes = {
      [noteId]: {
        id: noteId,
        title: 'Patron Lead',
        body: '',
        visibility: 'PLAYERS',
        ownerId: actorId,
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        updatedBy: actorId
      }
    }

    const update = deriveEventsForCommand(
      {
        type: 'UpdateNote',
        gameId,
        actorId,
        noteId,
        body: 'Meet at the downport.'
      },
      {
        state,
        currentSeq: 1,
        nextSeq: 2,
        gameSeed: 1234,
        ruleset: CEPHEUS_SRD_RULESET
      }
    )

    assert.equal(update.ok, true)
    if (!update.ok) return
    assert.deepEqual(update.value, [
      {
        type: 'NoteUpdated',
        noteId,
        body: 'Meet at the downport.'
      }
    ])
  })

  it('rejects note changes from non-referee actors', () => {
    const result = deriveEventsForCommand(
      {
        type: 'CreateNote',
        gameId,
        actorId: asUserId('player-1'),
        noteId: asNoteId('note-denied'),
        title: 'Hidden clue',
        body: '',
        visibility: 'REFEREE'
      },
      {
        state: createState(null),
        currentSeq: 1,
        nextSeq: 2,
        gameSeed: 1234,
        ruleset: CEPHEUS_SRD_RULESET
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'not_allowed')
  })

  it('emits semantic characteristic completion after the final stat roll', () => {
    const creation = createCreation('CHARACTERISTICS')
    const state = createState(creation)
    state.characters[characterId].characteristics = {
      str: 7,
      dex: 8,
      end: 6,
      int: 9,
      edu: 8,
      soc: null
    }

    const result = deriveEventsForCommand(
      {
        type: 'RollCharacterCreationCharacteristic',
        gameId,
        actorId,
        characterId,
        characteristic: 'soc'
      },
      {
        state,
        currentSeq: 1,
        nextSeq: 2,
        gameSeed: 1234,
        ruleset: CEPHEUS_SRD_RULESET
      }
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
      result.value.map((event) => event.type),
      [
        'DiceRolled',
        'CharacterCreationCharacteristicRolled',
        'CharacterCreationCharacteristicsCompleted'
      ]
    )
    const roll = result.value[0]
    const rolledCharacteristic = result.value[1]
    const completion = result.value.at(-1)
    assert.equal(roll?.type, 'DiceRolled')
    if (roll?.type !== 'DiceRolled') return
    assert.equal(
      rolledCharacteristic?.type,
      'CharacterCreationCharacteristicRolled'
    )
    if (
      rolledCharacteristic?.type !== 'CharacterCreationCharacteristicRolled'
    ) {
      return
    }
    assert.equal(rolledCharacteristic.characterId, characterId)
    assert.equal(rolledCharacteristic.rollEventId, asEventId('game-1:2'))
    assert.equal(rolledCharacteristic.characteristic, 'soc')
    assert.equal(rolledCharacteristic.value, roll.total)
    assert.equal(rolledCharacteristic.characteristicsComplete, true)
    assert.equal(completion?.type, 'CharacterCreationCharacteristicsCompleted')
    if (completion?.type !== 'CharacterCreationCharacteristicsCompleted') return
    assert.equal(completion.characterId, characterId)
    assert.equal(completion.rollEventId, asEventId('game-1:2'))
    assert.equal(completion.state.status, 'HOMEWORLD')
    assert.equal(completion.creationComplete, false)
  })

  it('blocks creation completion while aging decisions remain unresolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      createCreation('ACTIVE', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Pilot-1'],
            benefits: ['Low Passage'],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'CREATION_COMPLETE is blocked by unresolved character creation decisions'
    )
  })

  it('finalizes active creation through the legal completion action', () => {
    const result = runCommand(
      finalizeCommand(),
      createCreation('ACTIVE', {
        terms: [completedTerm()],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.length, 2)
    assert.deepEqual(result.value[0], {
      type: 'CharacterCreationCompleted',
      characterId,
      state: createCareerCreationState('PLAYABLE'),
      creationComplete: true
    })
    assert.equal(result.value[1]?.type, 'CharacterCreationFinalized')
    if (result.value[1]?.type !== 'CharacterCreationFinalized') return
    assert.equal(result.value[1].age, null)
    assert.deepEqual(result.value[1].characteristics, {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(result.value[1].skills, ['Pilot-1'])
    assert.deepEqual(result.value[1].equipment, [])
    assert.equal(result.value[1].credits, 0)
    assert.equal(result.value[1].notes.includes('Rules source'), true)
  })

  it('derives finalization term notes from projected survival facts', () => {
    const result = runCommand(
      finalizeCommand(),
      createCreation('ACTIVE', {
        terms: [
          {
            ...completedTerm(),
            survival: undefined,
            facts: {
              survival: {
                passed: true,
                canCommission: false,
                canAdvance: true,
                survival: {
                  expression: '2d6',
                  rolls: [4, 4],
                  total: 8,
                  characteristic: 'end',
                  modifier: 0,
                  target: 7,
                  success: true
                }
              }
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[1]?.type, 'CharacterCreationFinalized')
    if (result.value[1]?.type !== 'CharacterCreationFinalized') return
    assert.equal(
      result.value[1].notes.includes('Term 1: Scout, survived.'),
      true
    )
  })

  it('keeps legacy completion from creating playable characters without a final sheet', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      createCreation('ACTIVE', {
        terms: [completedTerm()],
        careers: [{ name: 'Scout', rank: 0 }],
        history: [{ type: 'COMPLETE_SKILLS' }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
      result.value.map((event) => event.type),
      ['CharacterCreationCompleted', 'CharacterCreationFinalized']
    )
  })

  it('rejects finalization after creation has already become playable', () => {
    const result = runCommand(
      finalizeCommand(),
      createCreation('PLAYABLE', {
        terms: [completedTerm()],
        creationComplete: true
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'CREATION_COMPLETE is blocked by unresolved character creation decisions'
    )
  })

  it('blocks mustering completion until projected SRD benefits are resolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationMustering',
        gameId,
        actorId,
        characterId
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Pilot-1'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'FINISH_MUSTERING is blocked by unresolved character creation decisions'
    )
  })

  it('blocks mustering benefit rolls for a forfeited mishap term', () => {
    const result = runCommand(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'material'
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            ...completedTerm(),
            benefits: [],
            facts: { mishap: mishapFact('forfeit_current_term') }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'No remaining mustering benefits for Scout'
    )
  })

  it('blocks mustering benefit rolls when a mishap loses all career benefits', () => {
    const result = runCommand(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'material'
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            ...completedTerm(),
            benefits: [],
            facts: {}
          },
          {
            ...completedTerm(),
            benefits: [],
            facts: { mishap: mishapFact('lose_all') }
          }
        ],
        careers: [{ name: 'Scout', rank: 5 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'No remaining mustering benefits for Scout'
    )
  })

  it('rejects generic mustering completion after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'FINISH_MUSTERING' }
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Pilot-1'],
            benefits: ['Low Passage'],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects generic characteristic completion after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'SET_CHARACTERISTICS' }
      },
      createCreation('CHARACTERISTICS')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects generic career selection after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'SELECT_CAREER', isNewCareer: true }
      },
      createCreation('CAREER_SELECTION')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects generic mustering benefit facts after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: {
          type: 'FINISH_MUSTERING',
          musteringBenefit: {
            career: 'Scout',
            kind: 'cash',
            roll: { expression: '2d6', rolls: [4, 4], total: 8 },
            modifier: 1,
            tableRoll: 9,
            value: '50000',
            credits: 50000
          }
        }
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Pilot-1'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('emits a semantic mustering benefit event with server-derived roll facts', () => {
    const result = runCommand(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Aerospace',
        kind: 'material'
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Aerospace',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        careers: [{ name: 'Aerospace', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Aerospace material mustering benefit',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationMusteringBenefitRolled',
        characterId,
        rollEventId: 'game-1:2',
        musteringBenefit: {
          career: 'Aerospace',
          kind: 'material',
          roll: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8
          },
          modifier: 0,
          tableRoll: 8,
          value: '+1 Soc',
          credits: 0,
          materialItem: null
        },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks semantic cash mustering benefits after the SRD cash limit', () => {
    const result = runCommand(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'cash'
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: ['5000', '10000', '50000'],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Cash mustering benefit limit has been reached'
    )
  })

  it('blocks semantic cash mustering benefits from projected facts without legacy benefit strings', () => {
    const cashBenefits = [1000, 5000, 10000].map((credits, index) => ({
      career: 'Scout',
      kind: 'cash' as const,
      roll: {
        expression: '2d6' as const,
        rolls: [index + 1, index + 2],
        total: index * 2 + 3
      },
      modifier: 0,
      tableRoll: index + 3,
      value: String(credits),
      credits,
      materialItem: null
    }))
    const result = runCommand(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'cash'
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            facts: { musteringBenefits: cashBenefits },
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          ...Array.from({ length: 3 }, () => ({
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            facts: {},
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }))
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Cash mustering benefit limit has been reached'
    )
  })

  it('emits a semantic mustering completion event once benefits are resolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationMustering',
        gameId,
        actorId,
        characterId
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Pilot-1'],
            benefits: ['Low Passage'],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationMusteringCompleted',
        characterId,
        state: {
          status: 'ACTIVE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

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
        type: 'CompleteCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      createCreation('PLAYABLE', { homeworld })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'CREATION_COMPLETE is blocked by unresolved character creation decisions'
    )
  })

  it('emits a semantic basic training completion event when choices are resolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId
      },
      createCreation('BASIC_TRAINING', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationBasicTrainingCompleted',
        characterId,
        trainingSkills: ['Vacc Suit-0'],
        state: {
          status: 'SURVIVAL',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks semantic basic training completion while training choices are unresolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId
      },
      createCreation('BASIC_TRAINING', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Choose one valid basic training skill for this career term'
    )
  })

  it('emits semantic basic training completion with a selected later-career skill', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId,
        skill: 'Broker'
      },
      createCreation('BASIC_TRAINING', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationBasicTrainingCompleted',
        characterId,
        trainingSkills: ['Broker-0'],
        state: {
          status: 'SURVIVAL',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('rejects invalid later-career basic training skill selections', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId,
        skill: 'Recon'
      },
      createCreation('BASIC_TRAINING', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false
          },
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Choose one valid basic training skill for this career term'
    )
  })

  it('blocks semantic basic training completion while basic training choices are unresolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId
      },
      createCreation('BASIC_TRAINING', {
        pendingDecisions: [{ key: 'basicTrainingSkillSelection' }],
        terms: [
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'COMPLETE_BASIC_TRAINING is blocked by unresolved character creation decisions'
    )
  })

  it('blocks semantic basic training completion outside basic training', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId
      },
      createCreation('SURVIVAL')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'COMPLETE_BASIC_TRAINING is not valid from SURVIVAL'
    )
  })

  it('rejects generic basic training completion after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'COMPLETE_BASIC_TRAINING' }
      },
      createCreation('BASIC_TRAINING', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('emits a semantic homeworld completion event when setup is resolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId
      },
      createCreation('HOMEWORLD', {
        homeworld,
        backgroundSkills: ['Zero-G-0', 'Admin-0', 'Broker-0'],
        pendingCascadeSkills: []
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationHomeworldCompleted',
        characterId,
        state: {
          status: 'CAREER_SELECTION',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('rejects generic homeworld completion after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'COMPLETE_HOMEWORLD' }
      },
      createCreation('HOMEWORLD', {
        homeworld,
        backgroundSkills: ['Zero-G-0', 'Admin-0', 'Broker-0'],
        pendingCascadeSkills: []
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('emits requested and accepted career facts for semantic term start', () => {
    const result = runCommand(
      {
        type: 'StartCharacterCareerTerm',
        gameId,
        actorId,
        characterId,
        career: ' Scout ',
        drafted: true
      },
      createCreation('CAREER_SELECTION')
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Draft',
        acceptedCareer: 'Scout',
        career: 'Scout',
        drafted: true,
        state: createCareerCreationState('BASIC_TRAINING'),
        creationComplete: false
      }
    ])
  })

  it('rejects direct career term starts from character owners who are not referees', () => {
    const playerId = asUserId('player-1')
    const refereeId = asUserId('referee-1')
    const state = createState(createCreation('CAREER_SELECTION'))
    const character = state.characters[characterId]
    assert.equal(Boolean(character), true)
    if (!character) return
    state.ownerId = refereeId
    state.characters[characterId] = {
      ...character,
      ownerId: playerId
    }

    const result = deriveEventsForCommand(
      {
        type: 'StartCharacterCareerTerm',
        gameId,
        actorId: playerId,
        characterId,
        career: 'Scout'
      },
      {
        state,
        currentSeq: 1,
        nextSeq: 2,
        gameSeed: 1234,
        ruleset: CEPHEUS_SRD_RULESET
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'not_allowed')
    assert.equal(
      result.error.message,
      'Only the referee can start character career terms directly'
    )
  })

  it('emits semantic qualification roll facts from career selection', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationQualification',
        gameId,
        actorId,
        characterId,
        career: 'Scout'
      },
      createCreation('CAREER_SELECTION')
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[0]?.type, 'DiceRolled')
    assert.equal(
      result.value[1]?.type,
      'CharacterCreationQualificationResolved'
    )
    const qualification = result.value[1]
    if (qualification?.type !== 'CharacterCreationQualificationResolved') return
    assert.equal(qualification.characterId, characterId)
    assert.equal(qualification.rollEventId, 'game-1:2')
    assert.equal(qualification.career, 'Scout')
    assert.equal(qualification.qualification.expression, '2d6')
    assert.equal(qualification.qualification.success, qualification.passed)
    assert.equal(
      qualification.state.status,
      qualification.passed ? 'BASIC_TRAINING' : 'CAREER_SELECTION'
    )
  })

  it('blocks repeated qualification after failed qualification', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationQualification',
        gameId,
        actorId,
        characterId,
        career: 'Scout'
      },
      createCreation('CAREER_SELECTION', {
        failedToQualify: true,
        canEnterDraft: true
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Qualification is not available after failed qualification'
    )
  })

  it('emits semantic draft roll facts after failed qualification', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationDraft',
        gameId,
        actorId,
        characterId
      },
      createCreation('CAREER_SELECTION', {
        failedToQualify: true,
        canEnterDraft: true
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[0]?.type, 'DiceRolled')
    assert.equal(result.value[1]?.type, 'CharacterCreationDraftResolved')
    const draft = result.value[1]
    if (draft?.type !== 'CharacterCreationDraftResolved') return
    assert.equal(draft.characterId, characterId)
    assert.equal(draft.rollEventId, 'game-1:2')
    assert.equal(draft.draft.roll.expression, '1d6')
    assert.equal(draft.state.status, 'BASIC_TRAINING')
  })

  it('emits semantic Drifter fallback without a roll', () => {
    const result = runCommand(
      {
        type: 'EnterCharacterCreationDrifter',
        gameId,
        actorId,
        characterId,
        option: 'Drifter'
      },
      createCreation('CAREER_SELECTION', {
        failedToQualify: true,
        canEnterDraft: true
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationDrifterEntered',
        characterId,
        acceptedCareer: 'Drifter',
        state: createCareerCreationState('BASIC_TRAINING'),
        creationComplete: false
      }
    ])
  })

  it('emits a semantic survival pass event with server-derived roll facts', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      createCreation('SURVIVAL', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout survival',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationSurvivalResolved',
        characterId,
        rollEventId: 'game-1:2',
        passed: true,
        survival: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: 'end',
          modifier: 0,
          target: 7,
          success: true
        },
        canCommission: false,
        canAdvance: false,
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('emits a semantic survival failure event with server-derived roll facts', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      createCreation('SURVIVAL', {
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: ['Vacc Suit-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      }),
      { gameSeed: 2 }
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout survival',
        rolls: [4, 2],
        total: 6
      },
      {
        type: 'CharacterCreationSurvivalResolved',
        characterId,
        rollEventId: 'game-1:2',
        passed: false,
        survival: {
          expression: '2d6',
          rolls: [4, 2],
          total: 6,
          characteristic: 'end',
          modifier: 0,
          target: 7,
          success: false
        },
        canCommission: false,
        canAdvance: false,
        state: {
          status: 'DECEASED',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks semantic survival resolution outside survival', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      createCreation('BASIC_TRAINING')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'SURVIVAL is not valid from BASIC_TRAINING'
    )
  })

  it('emits a semantic commission event with server-derived roll facts', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationCommission',
        gameId,
        actorId,
        characterId
      },
      createCreation('COMMISSION', {
        state: createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: false
        }),
        terms: [
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: ['Broker-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 7
          }
        ],
        careers: [{ name: 'Merchant', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Merchant commission',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationCommissionResolved',
        characterId,
        rollEventId: 'game-1:2',
        passed: true,
        commission: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: 'int',
          modifier: 0,
          target: 5,
          success: true
        },
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks semantic commission resolution outside commission', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationCommission',
        gameId,
        actorId,
        characterId
      },
      createCreation('SURVIVAL')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'COMMISSION is not valid from SURVIVAL')
  })

  it('emits a semantic commission skip event', () => {
    const result = runCommand(
      {
        type: 'SkipCharacterCreationCommission',
        gameId,
        actorId,
        characterId
      },
      createCreation('COMMISSION', {
        state: createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: true
        })
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationCommissionSkipped',
        characterId,
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: true,
            canAdvance: true
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks generic commission skip commands', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'SKIP_COMMISSION' }
      },
      createCreation('COMMISSION', {
        state: createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: true
        })
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects generic commission roll facts after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: {
          type: 'COMPLETE_COMMISSION',
          commission: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8,
            characteristic: 'int',
            modifier: 0,
            target: 5,
            success: true
          }
        }
      },
      createCreation('COMMISSION', {
        state: createCareerCreationState('COMMISSION', {
          canCommission: true,
          canAdvance: true
        })
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('emits a semantic advancement event with server-derived roll and rank facts', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      createCreation('ADVANCEMENT', {
        state: createCareerCreationState('ADVANCEMENT', {
          canCommission: false,
          canAdvance: true
        }),
        terms: [
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: ['Broker-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 7
          }
        ],
        careers: [{ name: 'Merchant', rank: 1 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Merchant advancement',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationAdvancementResolved',
        characterId,
        rollEventId: 'game-1:2',
        passed: true,
        advancement: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: 'edu',
          modifier: 0,
          target: 8,
          success: true
        },
        rank: {
          career: 'Merchant',
          previousRank: 1,
          newRank: 2,
          title: 'Fourth Officer',
          bonusSkill: null
        },
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: true
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks semantic advancement resolution outside advancement', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      createCreation('SURVIVAL')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'ADVANCEMENT is not valid from SURVIVAL')
  })

  it('emits a semantic advancement skip event', () => {
    const result = runCommand(
      {
        type: 'SkipCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      createCreation('ADVANCEMENT', {
        state: createCareerCreationState('ADVANCEMENT', {
          canCommission: false,
          canAdvance: true
        })
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationAdvancementSkipped',
        characterId,
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: true
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks generic advancement skip commands', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'SKIP_ADVANCEMENT' }
      },
      createCreation('ADVANCEMENT', {
        state: createCareerCreationState('ADVANCEMENT', {
          canCommission: false,
          canAdvance: true
        })
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('emits a semantic aging event with server-derived roll facts', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAging',
        gameId,
        actorId,
        characterId
      },
      createCreation('AGING', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8,
            facts: {
              anagathicsDecision: {
                useAnagathics: false,
                termIndex: 0
              }
            }
          }
        ],
        history: []
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout aging',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationAgingResolved',
        characterId,
        rollEventId: 'game-1:2',
        aging: {
          roll: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8
          },
          modifier: -1,
          age: 22,
          characteristicChanges: []
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('uses cumulative terms and anagathics for semantic aging modifiers', () => {
    const scoutTerm = {
      career: 'Scout',
      skills: ['Vacc Suit-1'],
      skillsAndTraining: ['Vacc Suit-1'],
      benefits: [],
      complete: true,
      canReenlist: true,
      completedBasicTraining: true,
      musteringOut: false,
      anagathics: false,
      survival: 8
    }
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAging',
        gameId,
        actorId,
        characterId
      },
      createCreation('AGING', {
        terms: [
          scoutTerm,
          { ...scoutTerm },
          { ...scoutTerm, anagathics: true },
          {
            ...scoutTerm,
            complete: false,
            facts: {
              anagathicsDecision: {
                useAnagathics: false,
                termIndex: 3
              }
            }
          }
        ],
        history: []
      }),
      { gameSeed: 18 }
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[1]?.type, 'CharacterCreationAgingResolved')
    if (result.value[1]?.type !== 'CharacterCreationAgingResolved') return
    assert.deepEqual(result.value[1].aging, {
      roll: {
        expression: '2d6',
        rolls: [1, 1],
        total: 2
      },
      modifier: -3,
      age: 34,
      characteristicChanges: [
        { type: 'PHYSICAL', modifier: -1 },
        { type: 'PHYSICAL', modifier: -1 }
      ]
    })
  })

  it('blocks semantic aging until anagathics is decided for the active term', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAging',
        gameId,
        actorId,
        characterId
      },
      createCreation('AGING', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AGING is blocked by unresolved character creation decisions'
    )
  })

  it('blocks semantic aging while another pending decision accompanies anagathics', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAging',
        gameId,
        actorId,
        characterId
      },
      createCreation('AGING', {
        pendingCascadeSkills: ['Jack of all Trades'],
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AGING is blocked by unresolved character creation decisions'
    )
  })

  it('blocks anagathics decisions while another pending decision remains', () => {
    const result = runCommand(
      {
        type: 'DecideCharacterCreationAnagathics',
        gameId,
        actorId,
        characterId,
        useAnagathics: true
      },
      createCreation('AGING', {
        pendingCascadeSkills: ['Jack of all Trades'],
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'ANAGATHICS_DECISION is blocked by unresolved character creation decisions'
    )
  })

  it('emits a semantic anagathics decision event for the active term', () => {
    const result = runCommand(
      {
        type: 'DecideCharacterCreationAnagathics',
        gameId,
        actorId,
        characterId,
        useAnagathics: true
      },
      createCreation('AGING', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout anagathics survival',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'DiceRolled',
        expression: '1d6',
        reason: 'Scout anagathics cost',
        rolls: [1],
        total: 1
      },
      {
        type: 'CharacterCreationAnagathicsDecided',
        characterId,
        rollEventId: 'game-1:3',
        useAnagathics: true,
        termIndex: 0,
        passed: true,
        survival: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: 'end',
          modifier: 0,
          target: 7,
          success: true
        },
        cost: 2500,
        costRoll: {
          expression: '1d6',
          rolls: [1],
          total: 1
        },
        state: {
          status: 'AGING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('rejects generic aging completion after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'COMPLETE_AGING' }
      },
      createCreation('AGING', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('blocks semantic aging resolution outside aging', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAging',
        gameId,
        actorId,
        characterId
      },
      createCreation('SKILLS_TRAINING')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AGING is not valid from SKILLS_TRAINING'
    )
  })

  it('emits semantic aging loss resolution with server-derived characteristic changes', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAgingLosses',
        gameId,
        actorId,
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' },
          { type: 'PHYSICAL', modifier: -1, characteristic: 'dex' }
        ]
      },
      createCreation('REENLISTMENT', {
        characteristicChanges: [
          { type: 'PHYSICAL', modifier: -1 },
          { type: 'PHYSICAL', modifier: -1 }
        ],
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationAgingLossesResolved',
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' },
          { type: 'PHYSICAL', modifier: -1, characteristic: 'dex' }
        ],
        characteristicPatch: {
          str: 0,
          dex: 0
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('rejects stale aging loss resolution commands', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAgingLosses',
        gameId,
        actorId,
        characterId,
        expectedSeq: 0,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' }
        ]
      },
      createCreation('REENLISTMENT', {
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'stale_command')
  })

  it('rejects aging loss selections that do not exactly match pending losses', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAgingLosses',
        gameId,
        actorId,
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -2, characteristic: 'str' }
        ]
      },
      createCreation('REENLISTMENT', {
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Selected aging losses must match pending aging losses'
    )
  })

  it('rejects aging loss selections with invalid target groups or duplicate targets', () => {
    const invalidGroup = runCommand(
      {
        type: 'ResolveCharacterCreationAgingLosses',
        gameId,
        actorId,
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'int' }
        ]
      },
      createCreation('REENLISTMENT', {
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      })
    )

    assert.equal(invalidGroup.ok, false)
    if (invalidGroup.ok) return
    assert.equal(invalidGroup.error.code, 'invalid_command')
    assert.equal(
      invalidGroup.error.message,
      'int cannot receive a PHYSICAL aging loss'
    )

    const duplicate = runCommand(
      {
        type: 'ResolveCharacterCreationAgingLosses',
        gameId,
        actorId,
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' },
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' }
        ]
      },
      createCreation('REENLISTMENT', {
        characteristicChanges: [
          { type: 'PHYSICAL', modifier: -1 },
          { type: 'PHYSICAL', modifier: -1 }
        ]
      })
    )

    assert.equal(duplicate.ok, false)
    if (duplicate.ok) return
    assert.equal(duplicate.error.code, 'invalid_command')
    assert.equal(
      duplicate.error.message,
      'str cannot receive more than one PHYSICAL aging loss'
    )
  })

  it('rejects aging loss resolution when no pending losses exist', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationAgingLosses',
        gameId,
        actorId,
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' }
        ]
      },
      createCreation('REENLISTMENT')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'No pending aging losses to resolve')
  })

  it('emits semantic mishap resolution with server-derived transition', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationMishap',
        gameId,
        actorId,
        characterId
      },
      createCreation('MISHAP', {
        pendingDecisions: [{ key: 'mishapResolution' }],
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 3
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '1d6',
        reason: 'Scout mishap',
        rolls: [4],
        total: 4
      },
      {
        type: 'CharacterCreationMishapResolved',
        characterId,
        rollEventId: 'game-1:2',
        mishap: {
          roll: {
            expression: '1d6',
            rolls: [4],
            total: 4
          },
          outcome: {
            career: 'Scout',
            roll: 4,
            id: 'dishonorable_discharge',
            description:
              'Dishonorably discharged from the service. Lose all benefits.',
            discharge: 'dishonorable',
            benefitEffect: 'lose_all',
            debtCredits: 0,
            extraServiceYears: 0,
            injury: null
          }
        },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks mishap resolution when death confirmation is the projected outcome', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationMishap',
        gameId,
        actorId,
        characterId
      },
      createCreation('MISHAP', {
        pendingDecisions: [{ key: 'survivalResolution' }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'MISHAP_RESOLVED is blocked by unresolved character creation decisions'
    )
  })

  it('emits semantic injury resolution with server-derived losses', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationInjury',
        gameId,
        actorId,
        characterId,
        primaryCharacteristic: 'str'
      },
      createCreation('MISHAP', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 3,
            facts: {
              mishap: {
                roll: { expression: '1d6', rolls: [1], total: 1 },
                outcome: {
                  career: 'Scout',
                  roll: 1,
                  id: 'injured_in_action',
                  description:
                    'Injured in action. Treat as injury table result 2, or roll twice and take the lower result.',
                  discharge: 'honorable',
                  benefitEffect: 'forfeit_current_term',
                  debtCredits: 0,
                  extraServiceYears: 0,
                  injury: {
                    type: 'fixed',
                    injuryRoll: 2,
                    alternative: 'roll_twice_take_lower'
                  }
                }
              }
            }
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '1d6',
        reason: 'Scout injury',
        rolls: [4],
        total: 4
      },
      {
        type: 'CharacterCreationInjuryResolved',
        characterId,
        rollEventId: 'game-1:2',
        method: 'fixed_result',
        severityRoll: {
          expression: '1d6',
          rolls: [4],
          total: 4
        },
        outcome: {
          career: 'Scout',
          roll: 2,
          id: 'severely_injured',
          description:
            'Severely injured. Reduce one physical characteristic by 1D6.',
          crisisRisk: true
        },
        selectedLosses: [{ characteristic: 'str', modifier: -4 }],
        characteristicPatch: { str: 0 },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('supports injured-in-action roll-twice injury resolution', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationInjury',
        gameId,
        actorId,
        characterId,
        method: 'roll_twice_take_lower',
        primaryCharacteristic: 'dex',
        secondaryChoice: { mode: 'both_other_physical' }
      },
      createCreation('MISHAP', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 3,
            facts: {
              mishap: {
                roll: { expression: '1d6', rolls: [1], total: 1 },
                outcome: {
                  career: 'Scout',
                  roll: 1,
                  id: 'injured_in_action',
                  description:
                    'Injured in action. Treat as injury table result 2, or roll twice and take the lower result.',
                  discharge: 'honorable',
                  benefitEffect: 'forfeit_current_term',
                  debtCredits: 0,
                  extraServiceYears: 0,
                  injury: {
                    type: 'fixed',
                    injuryRoll: 2,
                    alternative: 'roll_twice_take_lower'
                  }
                }
              }
            }
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '3d6',
        reason: 'Scout injury',
        rolls: [4, 1, 4],
        total: 9
      },
      {
        type: 'CharacterCreationInjuryResolved',
        characterId,
        rollEventId: 'game-1:2',
        method: 'roll_twice_take_lower',
        injuryRoll: {
          expression: '2d6',
          rolls: [4, 1],
          total: 1
        },
        severityRoll: {
          expression: '1d6',
          rolls: [4],
          total: 4
        },
        outcome: {
          career: 'Scout',
          roll: 1,
          id: 'nearly_killed',
          description:
            'Nearly killed. Reduce one physical characteristic by 1D6, and reduce both other physical characteristics by 2 or one by 4.',
          crisisRisk: true
        },
        selectedLosses: [
          { characteristic: 'dex', modifier: -4 },
          { characteristic: 'str', modifier: -2 },
          { characteristic: 'end', modifier: -2 }
        ],
        characteristicPatch: { dex: 0, str: 0, end: 0 },
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('rejects injury resolution without required player choices', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationInjury',
        gameId,
        actorId,
        characterId
      },
      createCreation('MISHAP', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 3,
            facts: {
              mishap: {
                roll: { expression: '1d6', rolls: [1], total: 1 },
                outcome: {
                  career: 'Scout',
                  roll: 1,
                  id: 'injured_in_action',
                  description:
                    'Injured in action. Treat as injury table result 2, or roll twice and take the lower result.',
                  discharge: 'honorable',
                  benefitEffect: 'forfeit_current_term',
                  debtCredits: 0,
                  extraServiceYears: 0,
                  injury: {
                    type: 'fixed',
                    injuryRoll: 2,
                    alternative: 'roll_twice_take_lower'
                  }
                }
              }
            }
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'Choose the injured characteristic')
  })

  it('emits semantic death confirmation with server-derived transition', () => {
    const result = runCommand(
      {
        type: 'ConfirmCharacterCreationDeath',
        gameId,
        actorId,
        characterId
      },
      createCreation('MISHAP', {
        pendingDecisions: [{ key: 'survivalResolution' }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationDeathConfirmed',
        characterId,
        state: {
          status: 'DECEASED',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks death confirmation when mishap resolution is the projected outcome', () => {
    const result = runCommand(
      {
        type: 'ConfirmCharacterCreationDeath',
        gameId,
        actorId,
        characterId
      },
      createCreation('MISHAP', {
        pendingDecisions: [{ key: 'mishapResolution' }]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'DEATH_CONFIRMED is blocked by unresolved character creation decisions'
    )
  })

  it('rejects generic mishap and death transitions', () => {
    const cases = [
      [
        { type: 'MISHAP_RESOLVED' as const },
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      ],
      [
        { type: 'DEATH_CONFIRMED' as const },
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      ]
    ] as const

    for (const [creationEvent, message] of cases) {
      const result = runCommand(
        {
          type: 'AdvanceCharacterCreation',
          gameId,
          actorId,
          characterId,
          creationEvent
        },
        createCreation('MISHAP')
      )

      assert.equal(result.ok, false)
      if (result.ok) continue
      assert.equal(result.error.code, 'invalid_command')
      assert.equal(result.error.message, message)
    }
  })

  it('emits a semantic reenlistment event with server-derived roll facts', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationReenlistment',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout reenlistment',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationReenlistmentResolved',
        characterId,
        rollEventId: 'game-1:2',
        outcome: 'allowed',
        reenlistment: {
          expression: '2d6',
          rolls: [4, 4],
          total: 8,
          characteristic: null,
          modifier: 0,
          target: 6,
          success: true,
          outcome: 'allowed'
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('emits a forced semantic reenlistment outcome on natural 12', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationReenlistment',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      }),
      { gameSeed: 75 }
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[1]?.type, 'CharacterCreationReenlistmentResolved')
    if (result.value[1]?.type !== 'CharacterCreationReenlistmentResolved') {
      return
    }
    assert.equal(result.value[1].outcome, 'forced')
    assert.equal(result.value[1].reenlistment.total, 12)
    assert.equal(result.value[1].reenlistment.outcome, 'forced')
  })

  it('blocks semantic reenlistment resolution outside reenlistment', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationReenlistment',
        gameId,
        actorId,
        characterId
      },
      createCreation('AGING')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'REENLISTMENT is not valid from AGING')
  })

  it('rejects generic reenlistment roll facts after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: {
          type: 'RESOLVE_REENLISTMENT',
          reenlistment: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8,
            characteristic: null,
            modifier: 0,
            target: 6,
            success: true,
            outcome: 'allowed'
          }
        }
      },
      createCreation('REENLISTMENT')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects generic reenlist decisions that carry roll facts', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: {
          type: 'REENLIST',
          reenlistment: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8,
            characteristic: null,
            modifier: 0,
            target: 6,
            success: true
          }
        }
      },
      createCreation('REENLISTMENT')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(Object.hasOwn(result, 'value'), false)
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects generic career lifecycle decisions after semantic migration', () => {
    for (const creationEvent of [
      { type: 'REENLIST' as const },
      { type: 'FORCED_REENLIST' as const },
      { type: 'LEAVE_CAREER' as const },
      { type: 'REENLIST_BLOCKED' as const },
      { type: 'CONTINUE_CAREER' as const }
    ] as const) {
      const result = runCommand(
        {
          type: 'AdvanceCharacterCreation',
          gameId,
          actorId,
          characterId,
          creationEvent
        },
        createCreation(
          creationEvent.type === 'CONTINUE_CAREER'
            ? 'MUSTERING_OUT'
            : 'REENLISTMENT'
        )
      )

      assert.equal(result.ok, false)
      if (result.ok) return
      assert.equal(result.error.code, 'invalid_command')
      assert.equal(
        result.error.message,
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      )
    }
  })

  it('emits a semantic career reenlistment event from projected allowed outcome', () => {
    const result = runCommand(
      {
        type: 'ReenlistCharacterCreationCareer',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8,
            reEnlistment: 8
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationCareerReenlisted',
        characterId,
        outcome: 'allowed',
        career: 'Scout',
        forced: false,
        state: {
          status: 'SURVIVAL',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('emits a forced semantic career reenlistment event from projection', () => {
    const result = runCommand(
      {
        type: 'ReenlistCharacterCreationCareer',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8,
            reEnlistment: 12
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[0]?.type, 'CharacterCreationCareerReenlisted')
    if (result.value[0]?.type !== 'CharacterCreationCareerReenlisted') return
    assert.equal(result.value[0].outcome, 'forced')
    assert.equal(result.value[0].forced, true)
  })

  it('emits semantic career leave events for blocked and retirement outcomes', () => {
    const blocked = runCommand(
      {
        type: 'LeaveCharacterCreationCareer',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8,
            reEnlistment: 4
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(blocked.ok, true)
    if (!blocked.ok) return
    assert.deepEqual(blocked.value, [
      {
        type: 'CharacterCreationCareerLeft',
        characterId,
        outcome: 'blocked',
        retirement: false,
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])

    const retirement = runCommand(
      {
        type: 'LeaveCharacterCreationCareer',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: Array.from({ length: 7 }, () => ({
          career: 'Scout',
          skills: ['Vacc Suit-1'],
          skillsAndTraining: ['Vacc Suit-1'],
          benefits: [],
          complete: true,
          canReenlist: true,
          completedBasicTraining: true,
          musteringOut: false,
          anagathics: false,
          survival: 8
        })),
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(retirement.ok, true)
    if (!retirement.ok) return
    assert.equal(retirement.value[0]?.type, 'CharacterCreationCareerLeft')
    if (retirement.value[0]?.type !== 'CharacterCreationCareerLeft') return
    assert.equal(retirement.value[0].outcome, 'retire')
    assert.equal(retirement.value[0].retirement, true)
  })

  it('emits a semantic post-mustering continuation event from projection', () => {
    const result = runCommand(
      {
        type: 'ContinueCharacterCreationAfterMustering',
        gameId,
        actorId,
        characterId
      },
      createCreation('MUSTERING_OUT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: ['Low Passage'],
            complete: true,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: true,
            anagathics: false,
            survival: 8
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationAfterMusteringContinued',
        characterId,
        state: {
          status: 'CAREER_SELECTION',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks semantic reenlistment resolution after the roll is resolved', () => {
    const result = runCommand(
      {
        type: 'ResolveCharacterCreationReenlistment',
        gameId,
        actorId,
        characterId
      },
      createCreation('REENLISTMENT', {
        terms: [
          {
            career: 'Scout',
            skills: ['Vacc Suit-1'],
            skillsAndTraining: ['Vacc Suit-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 8,
            reEnlistment: 8
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'REENLISTMENT is blocked by unresolved character creation decisions'
    )
  })

  it('emits a semantic term skill event with a server-derived skill roll', () => {
    const result = runCommand(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      createCreation('SKILLS_TRAINING', {
        state: createCareerCreationState('SKILLS_TRAINING', {
          canCommission: true,
          canAdvance: false
        }),
        terms: [
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: ['Broker-0'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 7
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.length, 2)
    assert.equal(result.value[0]?.type, 'DiceRolled')
    if (result.value[0]?.type !== 'DiceRolled') return
    assert.equal(result.value[0].expression, '1d6')
    assert.equal(result.value[0].reason, 'Merchant serviceSkills')
    assert.equal(result.value[1]?.type, 'CharacterCreationTermSkillRolled')
    if (result.value[1]?.type !== 'CharacterCreationTermSkillRolled') return
    assert.equal(result.value[1].rollEventId, 'game-1:2')
    assert.equal(result.value[1].termSkill.career, 'Merchant')
    assert.equal(result.value[1].termSkill.table, 'serviceSkills')
    assert.equal(result.value[1].termSkill.roll.expression, '1d6')
    assert.equal(result.value[1].termSkill.roll.rolls.length, 1)
    assert.equal(
      result.value[1].termSkill.tableRoll,
      result.value[1].termSkill.roll.total
    )
    assert.equal(
      result.value[1].state.status,
      result.value[1].pendingCascadeSkills.length > 0
        ? 'SKILLS_TRAINING'
        : 'AGING'
    )
    assert.equal(result.value[1].skillsAndTraining.length >= 2, true)
  })

  it('emits a semantic skills completion event after required skill rolls', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationSkills',
        gameId,
        actorId,
        characterId
      },
      createCreation('SKILLS_TRAINING', {
        state: createCareerCreationState('SKILLS_TRAINING', {
          canCommission: true,
          canAdvance: false
        }),
        terms: [
          {
            career: 'Merchant',
            skills: ['Pilot-1'],
            skillsAndTraining: ['Broker-0', 'Pilot-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 7
          }
        ]
      })
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'CharacterCreationSkillsCompleted',
        characterId,
        state: {
          status: 'AGING',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('rejects generic skills completion after semantic migration', () => {
    const result = runCommand(
      {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent: { type: 'COMPLETE_SKILLS' }
      },
      createCreation('SKILLS_TRAINING', {
        state: createCareerCreationState('SKILLS_TRAINING', {
          canCommission: true,
          canAdvance: false
        }),
        terms: [
          {
            career: 'Merchant',
            skills: ['Pilot-1'],
            skillsAndTraining: ['Broker-0', 'Pilot-1'],
            benefits: [],
            complete: false,
            canReenlist: true,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            survival: 7
          }
        ]
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
  })

  it('rejects remaining generic skill and anagathics facts after semantic migration', () => {
    const cases: [CareerCreationEvent, CareerCreationStatus, string][] = [
      [
        {
          type: 'ROLL_TERM_SKILL' as const,
          termSkill: {
            career: 'Merchant',
            table: 'serviceSkills',
            roll: {
              expression: '1d6',
              rolls: [1],
              total: 1
            },
            tableRoll: 1,
            rawSkill: 'Pilot',
            skill: 'Pilot-1',
            characteristic: null,
            pendingCascadeSkill: null
          }
        },
        'SKILLS_TRAINING' as const,
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      ],
      [
        {
          type: 'RESOLVE_TERM_CASCADE_SKILL' as const,
          cascadeSkill: 'Gun Combat',
          selection: 'Slug Pistol'
        },
        'SKILLS_TRAINING' as const,
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      ],
      [
        {
          type: 'DECIDE_ANAGATHICS' as const,
          useAnagathics: false,
          termIndex: 0
        },
        'AGING' as const,
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      ],
      [
        { type: 'RESET' as const },
        'SURVIVAL' as const,
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      ]
    ]

    for (const [creationEvent, status, message] of cases) {
      const result = runCommand(
        {
          type: 'AdvanceCharacterCreation',
          gameId,
          actorId,
          characterId,
          creationEvent
        },
        createCreation(status, {
          state: createCareerCreationState(status, {
            canCommission: true,
            canAdvance: false
          }),
          terms: [
            {
              career: 'Merchant',
              skills: ['Pilot-1'],
              skillsAndTraining: ['Broker-0', 'Pilot-1'],
              benefits: [],
              complete: false,
              canReenlist: true,
              completedBasicTraining: true,
              musteringOut: false,
              anagathics: false,
              survival: 7
            }
          ]
        })
      )

      assert.equal(result.ok, false)
      if (result.ok) continue
      assert.equal(result.error.code, 'invalid_command')
      assert.equal(result.error.message, message)
    }
  })

  it('blocks semantic term skill rolls outside skills training', () => {
    const result = runCommand(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      createCreation('SURVIVAL')
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'TERM_SKILL is not valid from SURVIVAL')
  })

  it('blocks advanced education term skill rolls without EDU 8+', () => {
    const creation = createCreation('SKILLS_TRAINING', {
      terms: [
        {
          career: 'Merchant',
          skills: [],
          skillsAndTraining: [],
          benefits: [],
          complete: false,
          canReenlist: true,
          completedBasicTraining: true,
          musteringOut: false,
          anagathics: false,
          survival: 7
        }
      ]
    })
    const state = createState(creation)
    state.characters[characterId].characteristics.edu = 7
    const result = deriveEventsForCommand(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'advancedEducation'
      },
      {
        state,
        currentSeq: 1,
        nextSeq: 2,
        gameSeed: 1234,
        ruleset: CEPHEUS_SRD_RULESET
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Advanced education requires EDU 8 or higher'
    )
  })

  it('blocks semantic homeworld completion while background choices are unresolved', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId
      },
      createCreation('HOMEWORLD', {
        homeworld,
        backgroundSkills: ['Zero-G-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Background choices must be complete before career selection'
    )
  })

  it('blocks semantic homeworld completion outside homeworld setup', () => {
    const result = runCommand(
      {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId
      },
      createCreation('CAREER_SELECTION', { homeworld })
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'COMPLETE_HOMEWORLD is not valid from CAREER_SELECTION'
    )
  })
})
