import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameCommand } from '../../shared/commands'
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
  command: GameCommand,
  creation: CharacterCreationProjection | null,
  contextOverrides: Partial<Pick<CommandContext, 'gameSeed' | 'nextSeq'>> = {}
) => {
  const context: CommandContext = {
    state: createState(creation),
    currentSeq: 1,
    nextSeq: 2,
    gameSeed: 1234,
    ...contextOverrides
  }

  return deriveEventsForCommand(command, context)
}

describe('deriveEventsForCommand error categories', () => {
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

  it('blocks mustering completion until projected SRD benefits are resolved', () => {
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

  it('emits a semantic mustering benefit event with server-derived roll facts', () => {
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

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout material mustering benefit',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationMusteringBenefitRolled',
        characterId,
        musteringBenefit: {
          career: 'Scout',
          kind: 'material',
          roll: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8
          },
          modifier: 0,
          tableRoll: 8,
          value: '-',
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
        careers: [{ name: 'Scout', rank: 0 }],
        history: [
          {
            type: 'FINISH_MUSTERING',
            musteringBenefit: {
              career: 'Scout',
              kind: 'cash',
              roll: { expression: '2d6', rolls: [1, 1], total: 2 },
              modifier: 0,
              tableRoll: 2,
              value: '5000',
              credits: 5000
            }
          },
          {
            type: 'FINISH_MUSTERING',
            musteringBenefit: {
              career: 'Scout',
              kind: 'cash',
              roll: { expression: '2d6', rolls: [2, 2], total: 4 },
              modifier: 0,
              tableRoll: 4,
              value: '10000',
              credits: 10000
            }
          },
          {
            type: 'FINISH_MUSTERING',
            musteringBenefit: {
              career: 'Scout',
              kind: 'cash',
              roll: { expression: '2d6', rolls: [3, 3], total: 6 },
              modifier: 0,
              tableRoll: 6,
              value: '50000',
              credits: 50000
            }
          }
        ]
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
      'COMPLETE_BASIC_TRAINING must use CompleteCharacterCreationBasicTraining'
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
      'COMPLETE_HOMEWORLD must use CompleteCharacterCreationHomeworld'
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
        drafted: true
      }
    ])
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
    assert.equal(qualification.career, 'Scout')
    assert.equal(qualification.qualification.expression, '2d6')
    assert.equal(qualification.qualification.success, qualification.passed)
    assert.equal(
      qualification.state.status,
      qualification.passed ? 'BASIC_TRAINING' : 'CAREER_SELECTION'
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
      'SKIP_COMMISSION must use SkipCharacterCreationCommission'
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
      'SKIP_ADVANCEMENT must use SkipCharacterCreationAdvancement'
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
            survival: 8
          }
        ],
        history: [
          { type: 'DECIDE_ANAGATHICS', useAnagathics: false, termIndex: 0 }
        ]
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
          { ...scoutTerm, complete: false }
        ],
        history: [
          { type: 'DECIDE_ANAGATHICS', useAnagathics: false, termIndex: 3 }
        ]
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
        type: 'CharacterCreationAnagathicsDecided',
        characterId,
        useAnagathics: true,
        termIndex: 0,
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
      'COMPLETE_AGING must use ResolveCharacterCreationAging'
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
      'COMPLETE_SKILLS must use CompleteCharacterCreationSkills'
    )
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
        gameSeed: 1234
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
