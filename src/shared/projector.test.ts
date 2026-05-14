import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  CareerCreationEvent,
  CareerCreationStatus
} from './characterCreation'
import type { EventEnvelope } from './events'
import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asPieceId,
  asUserId
} from './ids'
import { projectGameState } from './projector'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const envelope = (
  seq: number,
  event: EventEnvelope['event']
): EventEnvelope => ({
  version: 1,
  id: asEventId(`${gameId}:${seq}`),
  gameId,
  seq,
  actorId,
  createdAt: `2026-05-03T00:00:0${seq}.000Z`,
  event
})

describe('game state projection', () => {
  it('rejects unknown event types instead of ignoring them', () => {
    let thrown: unknown

    try {
      projectGameState([
        envelope(1, {
          type: 'UnknownEvent'
        } as unknown as EventEnvelope['event'])
      ])
    } catch (error) {
      thrown = error
    }

    if (!(thrown instanceof Error)) {
      throw new Error('Expected unknown event projection to throw')
    }
    assert.equal(/Unhandled event UnknownEvent/.test(thrown.message), true)
  })

  it('projects explicit board selection over the first created board', () => {
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'BoardCreated',
        boardId: asBoardId('board-2'),
        name: 'Starport',
        imageAssetId: null,
        url: null,
        width: 1200,
        height: 900,
        scale: 50
      }),
      envelope(4, {
        type: 'BoardSelected',
        boardId: asBoardId('board-2')
      })
    ])

    assert.equal(state?.selectedBoardId, asBoardId('board-2'))
    assert.deepEqual(state?.boards[asBoardId('board-1')]?.doors, {})
    assert.equal(state?.eventSeq, 4)
  })

  it('projects board door state changes by board and door id', () => {
    const boardId = asBoardId('board-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId,
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'DoorStateChanged',
        boardId,
        doorId: 'iris-1',
        open: true
      }),
      envelope(4, {
        type: 'DoorStateChanged',
        boardId,
        doorId: 'iris-1',
        open: false
      })
    ])

    assert.deepEqual(state?.boards[boardId]?.doors, {
      'iris-1': {
        id: 'iris-1',
        open: false
      }
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects default and partial manual character sheet fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        notes: 'Scout service term notes',
        age: 34,
        characteristics: {
          str: 7,
          dex: 9
        },
        skills: ['Pilot 1'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: ''
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        characteristics: {
          dex: null,
          edu: 8
        },
        credits: 900
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.creation, null)
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: 7,
      dex: null,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Pilot 1'])
    assert.deepEqual(character?.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: '' }
    ])
    assert.equal(character?.credits, 900)
  })

  it('projects character creation lifecycle events into character creation state', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: { type: 'SET_CHARACTERISTICS' },
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Scout',
        acceptedCareer: 'Scout',
        career: 'Scout',
        drafted: false
      }),
      envelope(6, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: { type: 'CREATION_COMPLETE' },
        state: {
          status: 'PLAYABLE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: true
      }),
      envelope(7, {
        type: 'CharacterCreationFinalized',
        characterId,
        notes: 'Final scout.',
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
        equipment: [{ name: 'Vacc suit', quantity: 1, notes: 'Carried' }],
        credits: 1200
      })
    ])

    const character = state?.characters[characterId]
    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'PLAYABLE')
    assert.equal(creation?.creationComplete, true)
    assert.deepEqual(
      creation?.terms.map((term) => term.career),
      ['Scout']
    )
    assert.deepEqual(creation?.careers, [{ name: 'Scout', rank: 0 }])
    assert.deepEqual(creation?.history, [
      { type: 'SET_CHARACTERISTICS' },
      { type: 'CREATION_COMPLETE' }
    ])
    assert.deepEqual(creation?.actionPlan, {
      status: 'PLAYABLE',
      pendingDecisions: [],
      legalActions: []
    })
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    })
    assert.deepEqual(character?.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.equal(character?.credits, 1200)
    assert.equal(state?.eventSeq, 7)
  })

  it('projects semantic characteristic rolls into the character sheet', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationCharacteristicRolled',
        characterId,
        rollEventId: asEventId('game-1:3'),
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
      }),
      envelope(5, {
        type: 'CharacterCreationCharacteristicRolled',
        characterId,
        rollEventId: asEventId('game-1:4'),
        characteristic: 'soc',
        value: 10,
        characteristicsComplete: true,
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(6, {
        type: 'CharacterCreationCharacteristicsCompleted',
        characterId,
        rollEventId: asEventId('game-1:4'),
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const character = state?.characters[characterId]
    const creation = state?.characters[characterId]?.creation
    assert.equal(character?.characteristics.str, 8)
    assert.equal(character?.characteristics.soc, 10)
    assert.equal(creation?.state.status, 'HOMEWORLD')
    assert.equal(creation?.creationComplete, false)
    assert.deepEqual(creation?.history, [{ type: 'SET_CHARACTERISTICS' }])
    assert.equal(state?.eventSeq, 6)
  })

  it('projects semantic character creation timeline entries without roll facts', () => {
    const characterId = asCharacterId('timeline-character')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Timeline Traveller'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationCharacteristicRolled',
        characterId,
        rollEventId: asEventId('dice-roll-1'),
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
      })
    ])

    assert.deepEqual(
      state?.characters[characterId]?.creation?.timeline?.map((entry) => ({
        eventType: entry.eventType,
        rollEventId: entry.rollEventId
      })),
      [
        {
          eventType: 'CharacterCreationStarted',
          rollEventId: undefined
        },
        {
          eventType: 'CharacterCreationCharacteristicRolled',
          rollEventId: asEventId('dice-roll-1')
        }
      ]
    )
  })

  it('projects legacy characteristic completion with legacy history', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationCharacteristicsCompleted',
        characterId,
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'HOMEWORLD')
    assert.equal(creation?.creationComplete, false)
    assert.deepEqual(creation?.history, [{ type: 'SET_CHARACTERISTICS' }])
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic basic training completion like the legacy transition', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'BASIC_TRAINING',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
          ],
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SURVIVAL')
    assert.equal(creation?.creationComplete, false)
    assert.deepEqual(creation?.history, [{ type: 'COMPLETE_BASIC_TRAINING' }])
    assert.deepEqual(creation?.terms[0]?.skillsAndTraining, ['Vacc Suit-0'])
    assert.equal(creation?.terms[0]?.completedBasicTraining, true)
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic survival resolution into history and the active term', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'SURVIVAL',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SKILLS_TRAINING')
    assert.equal(creation?.requiredTermSkillCount, 2)
    assert.deepEqual(creation?.actionPlan, {
      status: 'SKILLS_TRAINING',
      pendingDecisions: [{ key: 'skillTrainingSelection' }],
      legalActions: [
        {
          key: 'completeSkills',
          status: 'SKILLS_TRAINING',
          commandTypes: [
            'RollCharacterCreationTermSkill',
            'CompleteCharacterCreationSkills'
          ],
          rollRequirement: { key: 'termSkill', dice: '1d6' }
        }
      ]
    })
    assert.equal(creation?.terms[0]?.survival, 8)
    assert.deepEqual(creation?.history, [
      {
        type: 'SURVIVAL_PASSED',
        canCommission: false,
        canAdvance: false,
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
    ])
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic commission resolution into history', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Merchant'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'COMMISSION',
            context: {
              canCommission: true,
              canAdvance: false
            }
          },
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
          careers: [{ name: 'Merchant', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SKILLS_TRAINING')
    assert.deepEqual(creation?.history, [
      {
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
    ])
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic commission skip into history', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Merchant'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'COMMISSION',
            context: {
              canCommission: true,
              canAdvance: true
            }
          },
          terms: [],
          careers: [{ name: 'Merchant', rank: 1 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SKILLS_TRAINING')
    assert.deepEqual(creation?.history, [{ type: 'SKIP_COMMISSION' }])
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic advancement resolution into history, term, and career rank', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Merchant'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'ADVANCEMENT',
            context: {
              canCommission: false,
              canAdvance: true
            }
          },
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
          careers: [{ name: 'Merchant', rank: 1 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SKILLS_TRAINING')
    assert.equal(creation?.terms[0]?.advancement, 8)
    assert.deepEqual(creation?.careers, [{ name: 'Merchant', rank: 2 }])
    assert.deepEqual(creation?.history, [
      {
        type: 'COMPLETE_ADVANCEMENT',
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
        }
      }
    ])
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic advancement skip into history', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Merchant'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'ADVANCEMENT',
            context: {
              canCommission: false,
              canAdvance: true
            }
          },
          terms: [],
          careers: [{ name: 'Merchant', rank: 1 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SKILLS_TRAINING')
    assert.deepEqual(creation?.careers, [{ name: 'Merchant', rank: 1 }])
    assert.deepEqual(creation?.history, [{ type: 'SKIP_ADVANCEMENT' }])
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic term skill rolls into active term history', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Merchant'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'SKILLS_TRAINING',
            context: {
              canCommission: true,
              canAdvance: false
            }
          },
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
          careers: [{ name: 'Merchant', rank: 1 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationTermSkillRolled',
        characterId,
        termSkill: {
          career: 'Merchant',
          table: 'serviceSkills',
          roll: { expression: '1d6', rolls: [1], total: 1 },
          tableRoll: 1,
          rawSkill: 'Broker',
          skill: 'Broker-1',
          characteristic: null,
          pendingCascadeSkill: null
        },
        termSkills: ['Broker-1'],
        skillsAndTraining: ['Broker-0', 'Broker-1'],
        pendingCascadeSkills: [],
        state: {
          status: 'AGING',
          context: {
            canCommission: true,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'AGING')
    assert.deepEqual(creation?.terms[0]?.skills, ['Broker-1'])
    assert.deepEqual(creation?.terms[0]?.skillsAndTraining, [
      'Broker-0',
      'Broker-1'
    ])
    assert.deepEqual(creation?.history?.at(-1), {
      type: 'ROLL_TERM_SKILL',
      termSkill: {
        career: 'Merchant',
        table: 'serviceSkills',
        roll: { expression: '1d6', rolls: [1], total: 1 },
        tableRoll: 1,
        rawSkill: 'Broker',
        skill: 'Broker-1',
        characteristic: null,
        pendingCascadeSkill: null
      }
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic aging facts into character creation history', () => {
    const characterId = asCharacterId('char-1')
    const aging = {
      roll: { expression: '2d6' as const, rolls: [1, 1], total: 2 },
      modifier: -3,
      age: 34,
      characteristicChanges: [
        { type: 'PHYSICAL' as const, modifier: -1 },
        { type: 'PHYSICAL' as const, modifier: -1 }
      ]
    }
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'AGING',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationAgingResolved',
        characterId,
        aging,
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.age, 34)
    assert.equal(character?.creation?.state.status, 'REENLISTMENT')
    assert.deepEqual(character?.creation?.characteristicChanges, [
      { type: 'PHYSICAL', modifier: -1 },
      { type: 'PHYSICAL', modifier: -1 }
    ])
    assert.deepEqual(character?.creation?.history?.at(-1), {
      type: 'COMPLETE_AGING',
      aging
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic aging loss resolution into characteristics and clears pending losses', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      envelope(4, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'REENLISTMENT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [
            { type: 'PHYSICAL', modifier: -1 },
            { type: 'PHYSICAL', modifier: -1 }
          ],
          creationComplete: false,
          history: []
        }
      }),
      envelope(5, {
        type: 'CharacterCreationAgingLossesResolved',
        characterId,
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' },
          { type: 'PHYSICAL', modifier: -1, characteristic: 'dex' }
        ],
        characteristicPatch: {
          str: 6,
          dex: 7
        },
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      } as EventEnvelope['event'])
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.characteristics.str, 6)
    assert.equal(character?.characteristics.dex, 7)
    assert.equal(character?.characteristics.end, 7)
    assert.deepEqual(character?.creation?.characteristicChanges, [])
    assert.equal(character?.creation?.state.status, 'REENLISTMENT')
    assert.equal(state?.eventSeq, 5)
  })

  it('projects semantic anagathics decisions onto the active term', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'AGING',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'AGING')
    assert.equal(creation?.terms[0]?.anagathics, true)
    assert.deepEqual(creation?.history?.at(-1), {
      type: 'DECIDE_ANAGATHICS',
      useAnagathics: true,
      termIndex: 0
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic reenlistment facts onto the active term', () => {
    const characterId = asCharacterId('char-1')
    const reenlistment = {
      expression: '2d6' as const,
      rolls: [3, 4],
      total: 7,
      characteristic: null,
      modifier: 0,
      target: 6,
      success: true,
      outcome: 'allowed' as const
    }
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'REENLISTMENT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationReenlistmentResolved',
        characterId,
        outcome: 'allowed',
        reenlistment,
        state: {
          status: 'REENLISTMENT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.terms[0]?.reEnlistment, 7)
    assert.equal(creation?.terms[0]?.canReenlist, true)
    assert.equal(creation?.terms[0]?.musteringOut, false)
    assert.deepEqual(creation?.history?.at(-1), {
      type: 'RESOLVE_REENLISTMENT',
      reenlistment
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic career lifecycle events with legacy history entries', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'REENLISTMENT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [
            {
              career: 'Scout',
              skills: ['Vacc Suit-1'],
              skillsAndTraining: ['Vacc Suit-1'],
              benefits: ['Low Passage'],
              complete: false,
              canReenlist: true,
              completedBasicTraining: true,
              musteringOut: false,
              anagathics: false,
              survival: 8,
              reEnlistment: 8
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      }),
      envelope(5, {
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
      }),
      envelope(6, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.deepEqual(
      creation?.history?.map((event) => event.type),
      ['REENLIST', 'REENLIST_BLOCKED', 'CONTINUE_CAREER']
    )
    assert.deepEqual(
      creation?.terms.map((term) => ({
        career: term.career,
        complete: term.complete,
        musteringOut: term.musteringOut
      })),
      [
        { career: 'Scout', complete: true, musteringOut: false },
        { career: 'Scout', complete: true, musteringOut: true }
      ]
    )
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.equal(state?.eventSeq, 6)
  })

  it('projects semantic mustering benefits onto terms and starting assets', () => {
    const characterId = asCharacterId('char-1')
    const musteringBenefit = {
      career: 'Scout',
      kind: 'material' as const,
      roll: {
        expression: '2d6' as const,
        rolls: [1, 1],
        total: 2
      },
      modifier: 0,
      tableRoll: 2,
      value: 'Low Passage',
      credits: 0,
      materialItem: 'Low Passage'
    }
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'MUSTERING_OUT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationMusteringBenefitRolled',
        characterId,
        musteringBenefit,
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const character = state?.characters[characterId]
    assert.deepEqual(character?.creation?.terms[0]?.benefits, ['Low Passage'])
    assert.deepEqual(character?.equipment, [
      {
        name: 'Low Passage',
        quantity: 1,
        notes: 'Mustering benefit: Scout'
      }
    ])
    assert.deepEqual(character?.creation?.history?.at(-1), {
      type: 'FINISH_MUSTERING',
      musteringBenefit
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic mustering completion into active creation state', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'MUSTERING_OUT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
              anagathics: false
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'ACTIVE')
    assert.deepEqual(creation?.history?.at(-1), { type: 'FINISH_MUSTERING' })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects accepted career facts from semantic term start events', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CAREER_SELECTION',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Draft',
        acceptedCareer: 'Navy',
        career: 'Navy',
        drafted: true,
        state: {
          status: 'BASIC_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'BASIC_TRAINING')
    assert.deepEqual(
      creation?.terms.map((term) => ({
        career: term.career,
        draft: term.draft
      })),
      [{ career: 'Navy', draft: 1 }]
    )
    assert.deepEqual(creation?.careers, [{ name: 'Navy', rank: 0 }])
    assert.equal(creation?.canEnterDraft, false)
    assert.equal(state?.eventSeq, 4)
  })

  it('replays character creation homeworld and background decisions', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'HOMEWORLD',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationHomeworldSet',
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        },
        backgroundSkills: ['Zero-G-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }),
      envelope(5, {
        type: 'CharacterCreationBackgroundSkillSelected',
        characterId,
        skill: 'Admin-0',
        backgroundSkills: ['Zero-G-0', 'Admin-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }),
      envelope(6, {
        type: 'CharacterCreationCascadeSkillResolved',
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Rifle',
        backgroundSkills: ['Zero-G-0', 'Admin-0', 'Slug Rifle-0'],
        pendingCascadeSkills: []
      }),
      envelope(7, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.deepEqual(creation?.homeworld, {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    })
    assert.deepEqual(creation?.backgroundSkills, [
      'Zero-G-0',
      'Admin-0',
      'Slug Rifle-0'
    ])
    assert.deepEqual(creation?.pendingCascadeSkills, [])
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.deepEqual(creation?.history, [{ type: 'COMPLETE_HOMEWORLD' }])
    assert.equal(state?.eventSeq, 7)
  })

  it('replays semantic character creation milestone events in order', () => {
    const characterId = asCharacterId('char-1')
    const creationState = (
      status: CareerCreationStatus,
      canCommission = false,
      canAdvance = false
    ) => ({
      status,
      context: {
        canCommission,
        canAdvance
      }
    })
    const survival = {
      expression: '2d6' as const,
      rolls: [4, 4],
      total: 8,
      characteristic: 'end' as const,
      modifier: 0,
      target: 5,
      success: true
    }
    const commission = {
      expression: '2d6' as const,
      rolls: [3, 3],
      total: 6,
      characteristic: 'int' as const,
      modifier: 0,
      target: 5,
      success: true
    }
    const advancement = {
      expression: '2d6' as const,
      rolls: [5, 4],
      total: 9,
      characteristic: 'edu' as const,
      modifier: 0,
      target: 8,
      success: true
    }
    const rank = {
      career: 'Merchant',
      previousRank: 0,
      newRank: 1,
      title: 'Fourth Officer',
      bonusSkill: null
    }
    const termSkill = {
      career: 'Merchant',
      table: 'serviceSkills' as const,
      roll: { expression: '1d6' as const, rolls: [1], total: 1 },
      tableRoll: 1,
      rawSkill: 'Broker',
      skill: 'Broker-1',
      characteristic: null,
      pendingCascadeSkill: null
    }

    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Merchant'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: creationState('HOMEWORLD'),
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationHomeworldSet',
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        },
        backgroundSkills: ['Zero-G-0'],
        pendingCascadeSkills: []
      }),
      envelope(5, {
        type: 'CharacterCreationHomeworldCompleted',
        characterId,
        state: creationState('CAREER_SELECTION'),
        creationComplete: false
      }),
      envelope(6, {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Merchant',
        acceptedCareer: 'Merchant',
        career: 'Merchant',
        drafted: false
      }),
      envelope(7, {
        type: 'CharacterCreationBasicTrainingCompleted',
        characterId,
        trainingSkills: ['Broker-0'],
        state: creationState('SURVIVAL'),
        creationComplete: false
      }),
      envelope(8, {
        type: 'CharacterCreationSurvivalResolved',
        characterId,
        passed: true,
        survival,
        canCommission: true,
        canAdvance: true,
        state: creationState('COMMISSION', true, true),
        creationComplete: false
      }),
      envelope(9, {
        type: 'CharacterCreationCommissionResolved',
        characterId,
        passed: true,
        commission,
        state: creationState('ADVANCEMENT', false, true),
        creationComplete: false
      }),
      envelope(10, {
        type: 'CharacterCreationAdvancementResolved',
        characterId,
        passed: true,
        advancement,
        rank,
        state: creationState('SKILLS_TRAINING'),
        creationComplete: false
      }),
      envelope(11, {
        type: 'CharacterCreationTermSkillRolled',
        characterId,
        termSkill,
        termSkills: ['Broker-1'],
        skillsAndTraining: ['Broker-0', 'Broker-1'],
        pendingCascadeSkills: [],
        state: creationState('AGING'),
        creationComplete: false
      })
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'AGING')
    assert.equal(creation?.creationComplete, false)
    assert.deepEqual(creation?.history, [
      { type: 'COMPLETE_HOMEWORLD' },
      { type: 'COMPLETE_BASIC_TRAINING' },
      {
        type: 'SURVIVAL_PASSED',
        canCommission: true,
        canAdvance: true,
        survival
      },
      {
        type: 'COMPLETE_COMMISSION',
        commission
      },
      {
        type: 'COMPLETE_ADVANCEMENT',
        advancement,
        rank
      },
      {
        type: 'ROLL_TERM_SKILL',
        termSkill
      }
    ])
    assert.deepEqual(creation?.terms, [
      {
        career: 'Merchant',
        skills: ['Broker-1'],
        skillsAndTraining: ['Broker-0', 'Broker-1'],
        benefits: [],
        complete: false,
        canReenlist: true,
        completedBasicTraining: true,
        musteringOut: false,
        anagathics: false,
        survival: 8,
        advancement: 9
      }
    ])
    assert.deepEqual(creation?.careers, [{ name: 'Merchant', rank: 1 }])
    assert.deepEqual(creation?.homeworld, {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    })
    assert.equal(creation?.canEnterDraft, true)
    assert.equal(state?.eventSeq, 11)
  })

  it('projects reenlistment as a second career term', () => {
    const characterId = asCharacterId('char-1')
    const transition = (
      seq: number,
      creationEvent: CareerCreationEvent,
      status: CareerCreationStatus,
      creationComplete = false
    ) =>
      envelope(seq, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent,
        state: {
          status,
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete
      })

    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCareerTermStarted',
        characterId,
        requestedCareer: 'Scout',
        acceptedCareer: 'Scout',
        career: 'Scout',
        drafted: false
      }),
      transition(
        5,
        { type: 'SURVIVAL_PASSED', canCommission: false, canAdvance: false },
        'SURVIVAL'
      ),
      transition(6, { type: 'COMPLETE_SKILLS' }, 'SURVIVAL'),
      transition(7, { type: 'COMPLETE_AGING' }, 'REENLISTMENT'),
      transition(8, { type: 'REENLIST' }, 'SURVIVAL'),
      transition(
        9,
        { type: 'SURVIVAL_PASSED', canCommission: false, canAdvance: false },
        'SURVIVAL'
      ),
      transition(10, { type: 'COMPLETE_SKILLS' }, 'SURVIVAL'),
      transition(11, { type: 'COMPLETE_AGING' }, 'REENLISTMENT'),
      transition(12, { type: 'LEAVE_CAREER' }, 'MUSTERING_OUT'),
      transition(13, { type: 'FINISH_MUSTERING' }, 'ACTIVE'),
      transition(14, { type: 'CREATION_COMPLETE' }, 'PLAYABLE', true)
    ])

    const terms = state?.characters[characterId]?.creation?.terms
    assert.deepEqual(
      terms?.map((term) => term.career),
      ['Scout', 'Scout']
    )
    assert.equal(terms?.[0]?.complete, true)
    assert.equal(terms?.[1]?.complete, true)
    assert.equal(terms?.[1]?.musteringOut, true)
    assert.equal(
      state?.characters[characterId]?.creation?.state.status,
      'PLAYABLE'
    )
  })

  it('projects semantic mishap resolution with legacy history compatibility', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Mara Vale'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'MISHAP',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
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
          ],
          careers: [{ name: 'Scout', rank: 0 }],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationMishapResolved',
        characterId,
        state: {
          status: 'MUSTERING_OUT',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      })
    ])

    const creation = state?.characters[characterId]?.creation

    assert.deepEqual(creation?.history, [{ type: 'MISHAP_RESOLVED' }])
    assert.deepEqual(creation?.state.status, 'MUSTERING_OUT')
    assert.equal(creation?.terms[0]?.complete, true)
    assert.equal(creation?.terms[0]?.musteringOut, true)
    assert.equal(state?.eventSeq, 4)
  })

  it('projects semantic death confirmation with legacy history compatibility', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Mara Vale'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'MISHAP',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
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
      })
    ])

    const creation = state?.characters[characterId]?.creation

    assert.deepEqual(creation?.history, [{ type: 'DEATH_CONFIRMED' }])
    assert.deepEqual(creation?.state.status, 'DECEASED')
    assert.equal(state?.eventSeq, 4)
  })

  it('ignores character creation events for missing characters', () => {
    const missingCharacterId = asCharacterId('missing-character')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreationStarted',
        characterId: missingCharacterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false
        }
      })
    ])

    assert.deepEqual(state?.characters, {})
    assert.equal(state?.eventSeq, 1)
  })

  it('replaces manual character sheet skills without changing other fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        notes: 'Scout service term notes',
        age: 34,
        characteristics: {
          dex: 9,
          edu: 8
        },
        skills: ['Pilot 1', 'Vacc Suit 0'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: 'Tailored'
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        skills: ['Engineer 1']
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: null,
      dex: 9,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Engineer 1'])
    assert.deepEqual(character?.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: 'Tailored' }
    ])
    assert.equal(character?.credits, 1200)
  })

  it('replaces manual character sheet equipment without changing other fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        notes: 'Scout service term notes',
        age: 34,
        characteristics: {
          dex: 9,
          edu: 8
        },
        skills: ['Pilot 1', 'Vacc Suit 0'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: 'Tailored'
          },
          {
            name: 'Laser carbine',
            quantity: 1,
            notes: ''
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        equipment: [
          {
            name: 'Medkit',
            quantity: 2,
            notes: 'Field issue'
          }
        ]
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: null,
      dex: 9,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Pilot 1', 'Vacc Suit 0'])
    assert.deepEqual(character?.equipment, [
      { name: 'Medkit', quantity: 2, notes: 'Field issue' }
    ])
    assert.equal(character?.credits, 1200)
  })

  it('projects piece character links', () => {
    const characterId = asCharacterId('char-1')
    const pieceId = asPieceId('piece-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'PieceCreated',
        pieceId,
        boardId: asBoardId('board-1'),
        characterId,
        name: 'Scout',
        imageAssetId: null,
        x: 10,
        y: 20
      })
    ])

    assert.equal(state?.pieces[pieceId]?.characterId, characterId)
    assert.equal(state?.pieces[pieceId]?.width, 50)
    assert.equal(state?.pieces[pieceId]?.height, 50)
    assert.equal(state?.pieces[pieceId]?.scale, 1)
  })

  it('projects custom piece dimensions', () => {
    const pieceId = asPieceId('door-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'PieceCreated',
        pieceId,
        boardId: asBoardId('board-1'),
        characterId: null,
        name: 'Airlock',
        imageAssetId: null,
        x: 10,
        y: 20,
        width: 50,
        height: 100,
        scale: 1.5
      })
    ])

    assert.equal(state?.pieces[pieceId]?.width, 50)
    assert.equal(state?.pieces[pieceId]?.height, 100)
    assert.equal(state?.pieces[pieceId]?.scale, 1.5)
  })
})
