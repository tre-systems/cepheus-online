import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createCareerCreationState,
  type CareerCreationStatus
} from '../../shared/characterCreation'
import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import { asCharacterId, asEventId, asGameId, asUserId } from '../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState,
  GameState
} from '../../shared/state'
import { deriveCharacterCreationCommandEvents } from './character-creation-command-handlers'
import type { CommandContext } from './command-helpers'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')
const characterId = asCharacterId('char-1')
const homeworld = {
  name: 'Erit',
  lawLevel: 'Low Law',
  tradeCodes: ['Industrial']
}

const createCreation = (
  status: CareerCreationStatus = 'CHARACTERISTICS',
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: createCareerCreationState(status),
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
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

const context = (
  creation: CharacterCreationProjection | null,
  overrides: Partial<
    Pick<CommandContext, 'gameSeed' | 'nextSeq' | 'ruleset'>
  > = {}
): CommandContext => ({
  state: createState(creation),
  currentSeq: 1,
  nextSeq: 2,
  gameSeed: 1234,
  ruleset: CEPHEUS_SRD_RULESET,
  ...overrides
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

const factOnlyCompletedTerm = () => ({
  ...completedTerm(),
  skills: [],
  skillsAndTraining: [],
  facts: {
    basicTrainingSkills: ['Vacc Suit-0'],
    termSkillRolls: [
      {
        career: 'Scout',
        table: 'serviceSkills' as const,
        roll: { expression: '1d6' as const, rolls: [2], total: 2 },
        tableRoll: 2,
        rawSkill: 'Pilot',
        skill: 'Pilot-1',
        characteristic: null,
        pendingCascadeSkill: null
      }
    ]
  }
})

const survivalFact = (passed: boolean) => ({
  passed,
  canCommission: false,
  canAdvance: passed,
  survival: {
    expression: '2d6' as const,
    rolls: passed ? [4, 4] : [3, 2],
    total: passed ? 8 : 5,
    characteristic: 'end' as const,
    modifier: 0,
    target: 7,
    success: passed
  }
})

const activeScoutTerm = () => ({
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
})

describe('character creation setup command handlers', () => {
  it('starts a server-backed character creation projection', () => {
    const result = deriveCharacterCreationCommandEvents(
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
          timeline: []
        }
      }
    ])
  })

  it('rejects deprecated generic character creation advancement', () => {
    const result = deriveCharacterCreationCommandEvents(
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

  it('emits characteristic roll facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationCharacteristic',
        gameId,
        actorId,
        characterId,
        characteristic: 'str'
      },
      context(createCreation('CHARACTERISTICS'))
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'STR characteristic',
        rolls: [4, 4],
        total: 8
      },
      {
        type: 'CharacterCreationCharacteristicRolled',
        characterId,
        rollEventId: 'game-1:2',
        characteristic: 'str',
        value: 8,
        characteristicsComplete: false,
        state: {
          status: 'CHARACTERISTICS',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('blocks duplicate characteristic rolls', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationCharacteristic',
        gameId,
        actorId,
        characterId,
        characteristic: 'edu'
      },
      context(createCreation('CHARACTERISTICS'))
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'EDU has already been rolled')
  })

  it('rejects characteristic rolls blocked by projected pending decisions', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationCharacteristic',
        gameId,
        actorId,
        characterId,
        characteristic: 'str'
      },
      context(
        createCreation('CHARACTERISTICS', {
          pendingDecisions: [{ key: 'characteristicAssignment' }]
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('blocked'), true)
  })

  it('sets a normalized homeworld and derives background skill allowance', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'SetCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        homeworld: {
          name: ' Erit ',
          lawLevel: ' Low Law ',
          tradeCodes: [' Industrial ', 'Industrial']
        }
      },
      context(createCreation('HOMEWORLD'))
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const event = result.value[0]
    assert.equal(event?.type, 'CharacterCreationHomeworldSet')
    if (event?.type !== 'CharacterCreationHomeworldSet') return
    assert.deepEqual(event.homeworld, homeworld)
    assert.equal(event.backgroundSkillAllowance, 3)
  })

  it('rejects homeworld reset while background choices are pending', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'SetCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        homeworld
      },
      context(
        createCreation('HOMEWORLD', {
          homeworld,
          pendingCascadeSkills: ['Gun Combat-0']
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('pending'), true)
  })

  it('selects and resolves background skills through semantic events', () => {
    const selected = deriveCharacterCreationCommandEvents(
      {
        type: 'SelectCharacterCreationBackgroundSkill',
        gameId,
        actorId,
        characterId,
        skill: 'Gun Combat*'
      },
      context(createCreation('HOMEWORLD', { homeworld }))
    )

    assert.equal(selected.ok, true)
    if (!selected.ok) return
    const selectedEvent = selected.value[0]
    assert.equal(
      selectedEvent?.type,
      'CharacterCreationBackgroundSkillSelected'
    )
    if (selectedEvent?.type !== 'CharacterCreationBackgroundSkillSelected') {
      return
    }
    assert.deepEqual(selectedEvent.backgroundSkills, [])
    assert.deepEqual(selectedEvent.pendingCascadeSkills, ['Gun Combat-0'])

    const resolved = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Pistol'
      },
      context(
        createCreation('HOMEWORLD', {
          homeworld,
          pendingCascadeSkills: ['Gun Combat-0']
        })
      )
    )

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    const resolvedEvent = resolved.value[0]
    assert.equal(resolvedEvent?.type, 'CharacterCreationCascadeSkillResolved')
    if (resolvedEvent?.type !== 'CharacterCreationCascadeSkillResolved') return
    assert.deepEqual(resolvedEvent.backgroundSkills, ['Slug Pistol-0'])
    assert.deepEqual(resolvedEvent.pendingCascadeSkills, [])
  })

  it('rejects background skill selection blocked by unrelated projected decisions', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'SelectCharacterCreationBackgroundSkill',
        gameId,
        actorId,
        characterId,
        skill: 'Admin'
      },
      context(
        createCreation('HOMEWORLD', {
          homeworld,
          pendingDecisions: [{ key: 'agingResolution' }]
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('blocked'), true)
  })

  it('rejects background cascade resolution blocked by unrelated projected decisions', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Pistol'
      },
      context(
        createCreation('HOMEWORLD', {
          homeworld,
          pendingCascadeSkills: ['Gun Combat-0'],
          pendingDecisions: [{ key: 'agingResolution' }]
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('blocked'), true)
  })

  it('completes homeworld setup when background choices are resolved', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('HOMEWORLD', {
          homeworld,
          backgroundSkills: ['Zero-G-0', 'Admin-0', 'Broker-0']
        })
      )
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

  it('completes basic training from the active career term', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('ignores stale legacy training when semantic basic training facts exist', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationBasicTraining',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('BASIC_TRAINING', {
          terms: [
            {
              career: 'Scout',
              skills: [],
              skillsAndTraining: ['Legacy Training-6'],
              benefits: [],
              facts: {
                basicTrainingSkills: []
              },
              complete: false,
              canReenlist: true,
              completedBasicTraining: false,
              musteringOut: false,
              anagathics: false
            }
          ]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const completed = result.value.find(
      (event) => event.type === 'CharacterCreationBasicTrainingCompleted'
    )
    assert.equal(completed?.type, 'CharacterCreationBasicTrainingCompleted')
    if (completed?.type !== 'CharacterCreationBasicTrainingCompleted') return
    assert.equal(completed.trainingSkills.includes('Legacy Training-6'), false)
    assert.equal(completed.trainingSkills.length > 1, true)
  })

  it('starts a career term with requested and accepted career facts', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'StartCharacterCareerTerm',
        gameId,
        actorId,
        characterId,
        career: ' Scout ',
        drafted: true
      },
      context(createCreation('CAREER_SELECTION'))
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

  it('rejects direct career term starts for unsupported careers', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'StartCharacterCareerTerm',
        gameId,
        actorId,
        characterId,
        career: 'Unsupported'
      },
      context(createCreation('CAREER_SELECTION'))
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'Career Unsupported is not supported')
  })

  it('rejects direct career term starts for careers unavailable after prior service', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'StartCharacterCareerTerm',
        gameId,
        actorId,
        characterId,
        career: 'Scout'
      },
      context(
        createCreation('CAREER_SELECTION', {
          terms: [completedTerm()],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Career Scout is not available after prior service'
    )
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

    const result = deriveCharacterCreationCommandEvents(
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

  it('rejects Drifter fallback when the active ruleset does not define Drifter', () => {
    const ruleset = structuredClone(CEPHEUS_SRD_RULESET)
    delete ruleset.careerBasics.Drifter
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'EnterCharacterCreationDrifter',
        gameId,
        actorId,
        characterId,
        option: 'Drifter'
      },
      context(
        createCreation('CAREER_SELECTION', {
          failedToQualify: true,
          failedQualification: {
            career: 'Scout',
            passed: false,
            qualification: {
              expression: '2d6',
              rolls: [2, 3],
              total: 5,
              characteristic: 'int',
              modifier: 0,
              target: 6,
              success: false
            },
            previousCareerCount: 0,
            failedQualificationOptions: ['Drifter']
          }
        }),
        { ruleset }
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'Career Drifter is not supported')
  })

  it('emits qualification roll facts from career selection', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationQualification',
        gameId,
        actorId,
        characterId,
        career: 'Scout'
      },
      context(createCreation('CAREER_SELECTION'))
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
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationQualification',
        gameId,
        actorId,
        characterId,
        career: 'Scout'
      },
      context(
        createCreation('CAREER_SELECTION', {
          failedToQualify: true,
          canEnterDraft: true
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Qualification is not available after failed qualification'
    )
  })

  it('emits draft roll facts after failed qualification', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationDraft',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('CAREER_SELECTION', {
          failedToQualify: true,
          canEnterDraft: true
        })
      )
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

  it('enters the Drifter fallback without a roll', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'EnterCharacterCreationDrifter',
        gameId,
        actorId,
        characterId,
        option: 'Drifter'
      },
      context(
        createCreation('CAREER_SELECTION', {
          failedToQualify: true,
          canEnterDraft: true
        })
      )
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

  it('emits survival pass facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('emits survival failure facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('uses projected rank facts for survival promotion options', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('SURVIVAL', {
          terms: [
            {
              ...activeScoutTerm(),
              career: 'Merchant',
              complete: true,
              facts: {
                advancement: {
                  skipped: false,
                  passed: true,
                  advancement: {
                    expression: '2d6',
                    rolls: [6, 6],
                    total: 12,
                    characteristic: 'edu',
                    modifier: 0,
                    target: 8,
                    success: true
                  },
                  rank: {
                    career: 'Merchant',
                    previousRank: 0,
                    newRank: 1,
                    title: 'Deck Cadet',
                    bonusSkill: null
                  }
                }
              }
            },
            {
              ...activeScoutTerm(),
              career: 'Merchant'
            }
          ],
          careers: [{ name: 'Merchant', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const resolved = result.value.find(
      (event) => event.type === 'CharacterCreationSurvivalResolved'
    )
    assert.equal(resolved?.type, 'CharacterCreationSurvivalResolved')
    if (resolved?.type !== 'CharacterCreationSurvivalResolved') return
    assert.equal(resolved.canCommission, false)
    assert.equal(resolved.canAdvance, true)
  })

  it('blocks survival resolution outside survival', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationSurvival',
        gameId,
        actorId,
        characterId
      },
      context(createCreation('BASIC_TRAINING'))
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'SURVIVAL is not valid from BASIC_TRAINING'
    )
  })

  it('emits commission roll facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationCommission',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('blocks commission resolution outside commission', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationCommission',
        gameId,
        actorId,
        characterId
      },
      context(createCreation('SURVIVAL'))
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'COMMISSION is not valid from SURVIVAL')
  })

  it('skips commission with a semantic transition event', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'SkipCharacterCreationCommission',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('COMMISSION', {
          state: createCareerCreationState('COMMISSION', {
            canCommission: true,
            canAdvance: true
          })
        })
      )
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

  it('emits advancement roll and rank facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('uses projected rank facts for advancement rank progression', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ADVANCEMENT', {
          state: createCareerCreationState('ADVANCEMENT', {
            canCommission: false,
            canAdvance: true
          }),
          terms: [
            {
              ...activeScoutTerm(),
              career: 'Merchant',
              complete: true,
              facts: {
                advancement: {
                  skipped: false,
                  passed: true,
                  advancement: {
                    expression: '2d6',
                    rolls: [6, 6],
                    total: 12,
                    characteristic: 'edu',
                    modifier: 0,
                    target: 8,
                    success: true
                  },
                  rank: {
                    career: 'Merchant',
                    previousRank: 0,
                    newRank: 1,
                    title: 'Deck Cadet',
                    bonusSkill: null
                  }
                }
              }
            },
            {
              ...activeScoutTerm(),
              career: 'Merchant',
              survival: 7
            }
          ],
          careers: [{ name: 'Merchant', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const resolved = result.value.find(
      (event) => event.type === 'CharacterCreationAdvancementResolved'
    )
    assert.equal(resolved?.type, 'CharacterCreationAdvancementResolved')
    if (resolved?.type !== 'CharacterCreationAdvancementResolved') return
    assert.deepEqual(resolved.rank, {
      career: 'Merchant',
      previousRank: 1,
      newRank: 2,
      title: 'Fourth Officer',
      bonusSkill: null
    })
  })

  it('blocks advancement resolution outside advancement', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      context(createCreation('SURVIVAL'))
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'ADVANCEMENT is not valid from SURVIVAL')
  })

  it('skips advancement with a semantic transition event', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'SkipCharacterCreationAdvancement',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ADVANCEMENT', {
          state: createCareerCreationState('ADVANCEMENT', {
            canCommission: false,
            canAdvance: true
          })
        })
      )
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

  it('emits aging roll facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationAging',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('AGING', {
          terms: [
            {
              ...activeScoutTerm(),
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

  it('emits anagathics decisions for the active term', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'DecideCharacterCreationAnagathics',
        gameId,
        actorId,
        characterId,
        useAnagathics: true
      },
      context(
        createCreation('AGING', {
          terms: [activeScoutTerm()]
        })
      )
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

  it('routes failed anagathics survival into the mishap branch', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'DecideCharacterCreationAnagathics',
        gameId,
        actorId,
        characterId,
        useAnagathics: true
      },
      context(
        createCreation('AGING', {
          terms: [activeScoutTerm()]
        }),
        { gameSeed: 2 }
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value, [
      {
        type: 'DiceRolled',
        expression: '2d6',
        reason: 'Scout anagathics survival',
        rolls: [4, 2],
        total: 6
      },
      {
        type: 'CharacterCreationAnagathicsDecided',
        characterId,
        rollEventId: 'game-1:2',
        useAnagathics: true,
        termIndex: 0,
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
        pendingDecisions: [{ key: 'mishapResolution' }],
        state: {
          status: 'MISHAP',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }
    ])
  })

  it('emits aging loss choices as characteristic patches', () => {
    const result = deriveCharacterCreationCommandEvents(
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
      context(
        createCreation('REENLISTMENT', {
          characteristicChanges: [
            { type: 'PHYSICAL', modifier: -1 },
            { type: 'PHYSICAL', modifier: -1 }
          ],
          terms: [activeScoutTerm()]
        })
      )
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

  it('emits reenlistment roll facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationReenlistment',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('REENLISTMENT', {
          terms: [activeScoutTerm()],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
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

  it('emits term skill roll facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      context(
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
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[0]?.type, 'DiceRolled')
    assert.equal(result.value[1]?.type, 'CharacterCreationTermSkillRolled')
    if (result.value[0]?.type !== 'DiceRolled') return
    if (result.value[1]?.type !== 'CharacterCreationTermSkillRolled') return
    assert.equal(result.value[0].expression, '1d6')
    assert.equal(result.value[0].reason, 'Merchant serviceSkills')
    assert.equal(result.value[1].rollEventId, 'game-1:2')
    assert.equal(result.value[1].termSkill.career, 'Merchant')
    assert.equal(result.value[1].termSkill.table, 'serviceSkills')
    assert.equal(result.value[1].skillsAndTraining.length >= 2, true)
  })

  it('allows term skill rolls from projected survival facts without legacy survival fields', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      context(
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
              facts: {
                survival: {
                  passed: true,
                  canCommission: true,
                  canAdvance: false,
                  survival: {
                    expression: '2d6',
                    rolls: [4, 3],
                    total: 7,
                    characteristic: 'int',
                    modifier: 0,
                    target: 5,
                    success: true
                  }
                }
              },
              complete: false,
              canReenlist: true,
              completedBasicTraining: true,
              musteringOut: false,
              anagathics: false
            }
          ]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value[1]?.type, 'CharacterCreationTermSkillRolled')
  })

  it('uses projected term skill facts instead of legacy aggregate skills for term roll gates', () => {
    const termSkillRoll = {
      career: 'Merchant',
      table: 'serviceSkills' as const,
      roll: { expression: '1d6' as const, rolls: [2], total: 2 },
      tableRoll: 2,
      rawSkill: 'Broker',
      skill: 'Broker-1',
      characteristic: null,
      pendingCascadeSkill: null
    }
    const creation = createCreation('SKILLS_TRAINING', {
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
          facts: {
            survival: survivalFact(true),
            termSkillRolls: [termSkillRoll]
          },
          complete: false,
          canReenlist: true,
          completedBasicTraining: true,
          musteringOut: false,
          anagathics: false,
          survival: 7
        }
      ]
    })

    const extraRoll = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      context(creation)
    )
    const completion = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationSkills',
        gameId,
        actorId,
        characterId
      },
      context(creation)
    )

    assert.equal(extraRoll.ok, false)
    if (extraRoll.ok) return
    assert.equal(extraRoll.error.code, 'invalid_command')
    assert.equal(extraRoll.error.message.includes('complete'), true)
    assert.equal(completion.ok, true)
  })

  it('builds semantic term skill aggregates from facts before legacy fields', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      context(
        createCreation('SKILLS_TRAINING', {
          state: createCareerCreationState('SKILLS_TRAINING', {
            canCommission: true,
            canAdvance: false
          }),
          requiredTermSkillCount: 2,
          terms: [
            {
              career: 'Merchant',
              skills: ['Legacy Skill-6'],
              skillsAndTraining: ['Legacy Training-6'],
              benefits: [],
              facts: {
                basicTrainingSkills: ['Broker-0'],
                survival: survivalFact(true)
              },
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
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const rolled = result.value.find(
      (event) => event.type === 'CharacterCreationTermSkillRolled'
    )
    assert.equal(rolled?.type, 'CharacterCreationTermSkillRolled')
    if (rolled?.type !== 'CharacterCreationTermSkillRolled') return
    assert.equal(rolled.termSkills.includes('Legacy Skill-6'), false)
    assert.equal(rolled.skillsAndTraining.includes('Legacy Training-6'), false)
    assert.equal(rolled.skillsAndTraining.includes('Broker-0'), true)
  })

  it('rejects term skill rolls blocked by unrelated projected decisions', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      context(
        createCreation('SKILLS_TRAINING', {
          state: createCareerCreationState('SKILLS_TRAINING', {
            canCommission: true,
            canAdvance: false
          }),
          pendingDecisions: [{ key: 'agingResolution' }],
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
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('blocked'), true)
  })

  it('uses projected required term skill count for roll and completion gates', () => {
    const termSkillRoll = {
      career: 'Merchant',
      table: 'serviceSkills' as const,
      roll: { expression: '1d6' as const, rolls: [2], total: 2 },
      tableRoll: 2,
      rawSkill: 'Broker',
      skill: 'Broker-1',
      characteristic: null,
      pendingCascadeSkill: null
    }
    const creation = createCreation('SKILLS_TRAINING', {
      state: createCareerCreationState('SKILLS_TRAINING', {
        canCommission: true,
        canAdvance: false
      }),
      requiredTermSkillCount: 2,
      terms: [
        {
          career: 'Merchant',
          skills: ['Broker-1'],
          skillsAndTraining: ['Broker-0', 'Broker-1'],
          benefits: [],
          facts: {
            survival: survivalFact(true),
            termSkillRolls: [termSkillRoll]
          },
          complete: false,
          canReenlist: true,
          completedBasicTraining: true,
          musteringOut: false,
          anagathics: false,
          survival: 7
        }
      ]
    })

    const extraRoll = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationTermSkill',
        gameId,
        actorId,
        characterId,
        table: 'serviceSkills'
      },
      context(creation)
    )
    const completion = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationSkills',
        gameId,
        actorId,
        characterId
      },
      context(creation)
    )

    assert.equal(extraRoll.ok, true)
    assert.equal(completion.ok, false)
    if (completion.ok) return
    assert.equal(completion.error.code, 'invalid_command')
    assert.equal(completion.error.message.includes('blocked'), true)
  })

  it('rejects term cascade resolution blocked by unrelated projected decisions', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationTermCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Pistol'
      },
      context(
        createCreation('SKILLS_TRAINING', {
          pendingCascadeSkills: ['Gun Combat-0'],
          pendingDecisions: [{ key: 'agingResolution' }],
          terms: [
            {
              career: 'Merchant',
              skills: ['Gun Combat-0'],
              skillsAndTraining: ['Broker-0', 'Gun Combat-0'],
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
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message.includes('blocked'), true)
  })

  it('emits skills completion after required term skills', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationSkills',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('emits mustering benefit roll facts from server dice', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'material'
      },
      context(
        createCreation('MUSTERING_OUT', {
          terms: [
            {
              ...activeScoutTerm(),
              complete: true,
              canReenlist: false,
              musteringOut: true
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
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
        rollEventId: 'game-1:2',
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

  it('uses projected term skill facts for cash benefit gambling modifiers', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'cash'
      },
      context(
        createCreation('MUSTERING_OUT', {
          terms: [
            {
              ...activeScoutTerm(),
              skills: [],
              skillsAndTraining: [],
              facts: {
                termSkillRolls: [
                  {
                    career: 'Scout',
                    table: 'serviceSkills',
                    roll: { expression: '1d6', rolls: [5], total: 5 },
                    tableRoll: 5,
                    rawSkill: 'Gambling',
                    skill: 'Gambling-1',
                    characteristic: null,
                    pendingCascadeSkill: null
                  }
                ]
              },
              complete: true,
              canReenlist: false,
              musteringOut: true
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const benefit = result.value.find(
      (event) => event.type === 'CharacterCreationMusteringBenefitRolled'
    )
    assert.equal(benefit?.type, 'CharacterCreationMusteringBenefitRolled')
    if (benefit?.type !== 'CharacterCreationMusteringBenefitRolled') return
    assert.equal(benefit.musteringBenefit.modifier, 1)
    assert.equal(benefit.musteringBenefit.tableRoll, 9)
    assert.equal(benefit.musteringBenefit.credits, 50000)
  })

  it('ignores stale legacy term skills for cash benefit gambling modifiers on semantic terms', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'cash'
      },
      context(
        createCreation('MUSTERING_OUT', {
          terms: [
            {
              ...activeScoutTerm(),
              skills: ['Gambling-1'],
              skillsAndTraining: ['Gambling-1'],
              facts: {
                survival: survivalFact(true)
              },
              complete: true,
              canReenlist: false,
              musteringOut: true
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const benefit = result.value.find(
      (event) => event.type === 'CharacterCreationMusteringBenefitRolled'
    )
    assert.equal(benefit?.type, 'CharacterCreationMusteringBenefitRolled')
    if (benefit?.type !== 'CharacterCreationMusteringBenefitRolled') return
    assert.equal(benefit.musteringBenefit.modifier, 0)
    assert.equal(benefit.musteringBenefit.tableRoll, 8)
    assert.equal(benefit.musteringBenefit.credits, 50000)
  })

  it('ignores stale legacy benefit fields on semantic terms when mustering', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'cash'
      },
      context(
        createCreation('MUSTERING_OUT', {
          terms: [
            {
              ...activeScoutTerm(),
              benefits: ['1000', '2000', '3000'],
              facts: {
                survival: survivalFact(true)
              },
              complete: true,
              canReenlist: false,
              musteringOut: true
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const benefit = result.value.find(
      (event) => event.type === 'CharacterCreationMusteringBenefitRolled'
    )
    assert.equal(benefit?.type, 'CharacterCreationMusteringBenefitRolled')
    if (benefit?.type !== 'CharacterCreationMusteringBenefitRolled') return
    assert.equal(benefit.musteringBenefit.kind, 'cash')
  })

  it('uses projected rank facts for material mustering modifiers', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'material'
      },
      context(
        createCreation('MUSTERING_OUT', {
          terms: [
            {
              ...activeScoutTerm(),
              facts: {
                advancement: {
                  skipped: false,
                  passed: true,
                  advancement: {
                    expression: '2d6',
                    rolls: [6, 6],
                    total: 12,
                    characteristic: 'int',
                    modifier: 0,
                    target: 8,
                    success: true
                  },
                  rank: {
                    career: 'Scout',
                    previousRank: 4,
                    newRank: 5,
                    title: 'Senior Scout',
                    bonusSkill: null
                  }
                }
              },
              complete: true,
              canReenlist: false,
              musteringOut: true
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const benefit = result.value.find(
      (event) => event.type === 'CharacterCreationMusteringBenefitRolled'
    )
    assert.equal(benefit?.type, 'CharacterCreationMusteringBenefitRolled')
    if (benefit?.type !== 'CharacterCreationMusteringBenefitRolled') return
    assert.equal(benefit.musteringBenefit.modifier, 1)
    assert.equal(benefit.musteringBenefit.tableRoll, 9)
  })

  it('ignores stale legacy career rank for semantic material mustering modifiers', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'material'
      },
      context(
        createCreation('MUSTERING_OUT', {
          terms: [
            {
              ...activeScoutTerm(),
              facts: {
                basicTrainingSkills: ['Comms-0']
              },
              complete: true,
              canReenlist: false,
              musteringOut: true
            }
          ],
          careers: [{ name: 'Scout', rank: 5 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const benefit = result.value.find(
      (event) => event.type === 'CharacterCreationMusteringBenefitRolled'
    )
    assert.equal(benefit?.type, 'CharacterCreationMusteringBenefitRolled')
    if (benefit?.type !== 'CharacterCreationMusteringBenefitRolled') return
    assert.equal(benefit.musteringBenefit.modifier, 0)
    assert.equal(benefit.musteringBenefit.tableRoll, 8)
  })

  it('emits mustering completion and continuation events', () => {
    const creation = createCreation('MUSTERING_OUT', {
      terms: [
        {
          ...activeScoutTerm(),
          benefits: ['Low Passage'],
          complete: true,
          canReenlist: false,
          musteringOut: true
        }
      ],
      careers: [{ name: 'Scout', rank: 0 }]
    })

    const completion = deriveCharacterCreationCommandEvents(
      {
        type: 'CompleteCharacterCreationMustering',
        gameId,
        actorId,
        characterId
      },
      context(creation)
    )
    const continuation = deriveCharacterCreationCommandEvents(
      {
        type: 'ContinueCharacterCreationAfterMustering',
        gameId,
        actorId,
        characterId
      },
      context(creation)
    )

    assert.equal(completion.ok, true)
    if (!completion.ok) return
    assert.equal(continuation.ok, true)
    if (!continuation.ok) return
    assert.equal(
      completion.value[0]?.type,
      'CharacterCreationMusteringCompleted'
    )
    assert.equal(
      continuation.value[0]?.type,
      'CharacterCreationAfterMusteringContinued'
    )
  })

  it('emits mishap resolution with server-derived transition', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationMishap',
        gameId,
        actorId,
        characterId
      },
      context(
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

  it('blocks mishap resolution when death confirmation is projected', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ResolveCharacterCreationMishap',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('MISHAP', {
          pendingDecisions: [{ key: 'survivalResolution' }]
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'MISHAP_RESOLVED is blocked by unresolved character creation decisions'
    )
  })

  it('emits death confirmation with server-derived transition', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ConfirmCharacterCreationDeath',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('MISHAP', {
          pendingDecisions: [{ key: 'survivalResolution' }]
        })
      )
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

  it('blocks death confirmation when mishap resolution is projected', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'ConfirmCharacterCreationDeath',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('MISHAP', {
          pendingDecisions: [{ key: 'mishapResolution' }]
        })
      )
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'DEATH_CONFIRMED is blocked by unresolved character creation decisions'
    )
  })

  it('finalizes a server-derived character sheet', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ACTIVE', {
          terms: [completedTerm()],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
      result.value.map((event) => event.type),
      ['CharacterCreationCompleted', 'CharacterCreationFinalized']
    )
    const finalized = result.value[1]
    assert.equal(finalized?.type, 'CharacterCreationFinalized')
    if (finalized?.type !== 'CharacterCreationFinalized') return
    assert.equal(finalized.age, null)
    assert.deepEqual(finalized.skills, ['Pilot-1'])
    assert.deepEqual(finalized.equipment, [])
    assert.equal(finalized.credits, 0)
    assert.equal(finalized.notes.includes('Rules source'), true)
  })

  it('rejects finalization while creation dice are unrevealed', () => {
    const rollEventId = asEventId('survival-roll-1')
    const creation = createCreation('ACTIVE', {
      terms: [
        {
          ...completedTerm(),
          facts: {
            survival: {
              ...survivalFact(true),
              rollEventId
            }
          }
        }
      ],
      careers: [{ name: 'Scout', rank: 0 }]
    })
    const state = createState(creation)
    state.diceLog.push({
      id: rollEventId,
      actorId,
      createdAt: '2026-05-15T00:00:00.000Z',
      revealAt: '2999-01-01T00:00:00.000Z',
      expression: '2d6',
      reason: 'Survival',
      rolls: [4, 4],
      total: 8
    })

    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
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
      'Character creation cannot be finalized while creation dice are unrevealed'
    )
  })

  it('rejects finalization while evicted creation dice are still unrevealed', () => {
    const rollEventId = asEventId('survival-roll-1')
    const creation = createCreation('ACTIVE', {
      terms: [
        {
          ...completedTerm(),
          facts: {
            survival: {
              ...survivalFact(true),
              rollEventId
            }
          }
        }
      ],
      careers: [{ name: 'Scout', rank: 0 }],
      timeline: [
        {
          eventId: asEventId('game-1:4'),
          seq: 4,
          createdAt: '2026-05-15T00:00:00.000Z',
          eventType: 'CharacterCreationSurvivalResolved',
          rollEventId
        }
      ]
    })

    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      {
        state: createState(creation),
        currentSeq: 1,
        nextSeq: 2,
        gameSeed: 1234,
        createdAt: '2026-05-15T00:00:01.000Z',
        ruleset: CEPHEUS_SRD_RULESET
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'Character creation cannot be finalized while creation dice are unrevealed'
    )
  })

  it('finalizes term notes from facts-only survival results', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ACTIVE', {
          terms: [
            {
              ...completedTerm(),
              survival: undefined,
              facts: { survival: survivalFact(false) }
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const finalized = result.value[1]
    assert.equal(finalized?.type, 'CharacterCreationFinalized')
    if (finalized?.type !== 'CharacterCreationFinalized') return
    assert.equal(finalized.notes.includes('Term 1: Scout, mishap.'), true)
  })

  it('finalizes term notes from survival facts over conflicting aggregates', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ACTIVE', {
          terms: [
            {
              ...completedTerm(),
              survival: 5,
              facts: { survival: survivalFact(false) }
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const finalized = result.value[1]
    assert.equal(finalized?.type, 'CharacterCreationFinalized')
    if (finalized?.type !== 'CharacterCreationFinalized') return
    assert.equal(finalized.notes.includes('Term 1: Scout, mishap.'), true)
  })

  it('finalizes skills from projected term facts before legacy aggregates', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ACTIVE', {
          terms: [factOnlyCompletedTerm()],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const finalized = result.value[1]
    assert.equal(finalized?.type, 'CharacterCreationFinalized')
    if (finalized?.type !== 'CharacterCreationFinalized') return
    assert.deepEqual(finalized.skills, ['Vacc Suit-0', 'Pilot-1'])
  })

  it('ignores stale legacy term skills when finalizing semantic terms without skill facts', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ACTIVE', {
          terms: [
            {
              ...completedTerm(),
              skills: ['Admin-6'],
              skillsAndTraining: ['Admin-6'],
              facts: { survival: survivalFact(true) }
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const finalized = result.value[1]
    assert.equal(finalized?.type, 'CharacterCreationFinalized')
    if (finalized?.type !== 'CharacterCreationFinalized') return
    assert.deepEqual(finalized.skills, [])
  })

  it('finalizes resolved term cascade skills from projected facts', () => {
    const result = deriveCharacterCreationCommandEvents(
      {
        type: 'FinalizeCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      context(
        createCreation('ACTIVE', {
          terms: [
            {
              ...completedTerm(),
              skills: ['Legacy Skill-5'],
              skillsAndTraining: ['Legacy Training-5'],
              facts: {
                termSkillRolls: [
                  {
                    career: 'Scout',
                    table: 'serviceSkills',
                    roll: { expression: '1d6', rolls: [2], total: 2 },
                    tableRoll: 2,
                    rawSkill: 'Gun Combat*',
                    skill: null,
                    characteristic: null,
                    pendingCascadeSkill: 'Gun Combat-1'
                  }
                ],
                termCascadeSelections: [
                  {
                    cascadeSkill: 'Gun Combat-1',
                    selection: 'Slug Rifle'
                  }
                ]
              }
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    const finalized = result.value[1]
    assert.equal(finalized?.type, 'CharacterCreationFinalized')
    if (finalized?.type !== 'CharacterCreationFinalized') return
    assert.deepEqual(finalized.skills, ['Slug Rifle-1'])
  })
})
